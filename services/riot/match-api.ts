import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { CompetitiveMMRResponse, ValorantSessionResponse } from "~/services/riot/api-types";
import type { RiotPlayerRequestOptions } from "~/services/riot/loadout-api";
import { extraHeaders, getPlayerResourceKey, getRiotClientVersionForRequests, logValorantApiDebug, logValorantApiResponse, maskSecretForLog, setRiotClientVersionOverride } from "~/services/riot/request-context";

// Tên người chơi theo name-service: Subject = PUUID, GameName + TagLine hiển thị.
type PlayerName = { Subject: string; GameName: string; TagLine: string };

// TTL cache tên người chơi: 1 giờ — tên hiếm khi đổi nên cache dài là an toàn.
const PLAYER_NAME_CACHE_TTL_MS = 60 * 60 * 1000;

// Trần cache tên (LRU): giữ 500 entry gần dùng nhất, chống phình bộ nhớ.
const PLAYER_NAME_CACHE_MAX_SIZE = 500;

// Cache tên (memory only): key "region|subject" → { value, expiresAt, lastAccessed }.
const playerNameCache = new Map<
  string,
  { value: PlayerName; expiresAt: number; lastAccessed: number }
>();

// Request tên đang bay theo TỪNG subject: các consumer có danh sách chỉ
// trùng một phần vẫn dùng chung request — không bắn trùng PUT /name-service.
const playerNameRequests = new Map<string, Promise<void>>();

/** Lấy lịch sử trận (match-history v1) — phân trang theo startIndex/endIndex.
 *  @param params - startIndex/endIndex (endIndex INCLUSIVE) và queue lọc
 *  (vd "competitive"); bỏ qua sẽ lấy toàn bộ queue.
 *  @returns MatchHistoryResponse (History, Total, EndIndex). Throw khi HTTP
 *  lỗi — caller (useMatchStore) đã bọc try/catch. */
export async function playerMatchHistory(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
): Promise<MatchHistoryResponse> {
  logValorantApiDebug("MatchHistory request", {
    region,
    userId: maskSecretForLog(userId),
    params,
  });
  const res = await axios.request<MatchHistoryResponse>({
    url: buildRiotApiUrl({ name: "match-history", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  logValorantApiDebug("MatchHistory response", {
    status: res.status,
    params,
    beginIndex: res.data.BeginIndex,
    endIndex: res.data.EndIndex,
    total: res.data.Total,
    matchCount: res.data.History?.length ?? 0,
  });
  logValorantApiResponse("MatchHistory", res.data);
  return res.data;
}

/** Lấy session Valorant hiện tại (glz session/v1/sessions/:userId).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ. @param userId - PUUID.
 *  @returns Session (clientVersion, state...) khi HTTP 200; null khi khác. */
export async function getValorantSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<ValorantSessionResponse>({
    url: buildRiotApiUrl({ name: "session", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : null;
}

/** Đồng bộ phiên bản Riot client dùng cho header X-Riot-ClientVersion:
 *  đọc clientVersion từ session rồi set override toàn cục (request-context).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ. @param userId - PUUID.
 *  @returns Phiên bản đã set; null nếu session thiếu clientVersion hoặc
 *  request thất bại (lỗi được nuốt — không ảnh hưởng luồng gọi). */
export async function hydrateRiotClientVersionFromSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const session = await getValorantSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  ).catch(() => null);
  const sessionVersion = session?.clientVersion?.trim();

  if (!sessionVersion) {
    return null;
  }

  return setRiotClientVersionOverride(sessionVersion);
}

// getCompetitiveMMR: MMR competitive (rank, RR, leaderboard info của player).
// Cache 5 phút + dedup in-flight theo "region|userId"; force=true bỏ qua cache.
// Tự retry 1 lần sau khi hydrate client version từ session nếu lần đầu lỗi.
// Returns: CompetitiveMMRResponse khi OK; {} (object rỗng) khi thất bại.
type CompetitiveMMRResult =
  | CompetitiveMMRResponse
  | Record<string, never>;

// TTL cache MMR: 5 phút — đủ ngắn để bắt thay đổi RR sau mỗi trận competitive.
const COMPETITIVE_MMR_CACHE_TTL_MS = 5 * 60 * 1000;

// Cache MMR (memory only): key "region|userId" → { value, expiresAt }.
const competitiveMmrCache = new Map<
  string,
  { value: CompetitiveMMRResponse; expiresAt: number }
>();

// Request MMR đang bay theo "region|userId" — caller sau join promise này.
const competitiveMmrRequests = new Map<
  string,
  Promise<CompetitiveMMRResult>
>();

/**
 * Lấy MMR competitive của người chơi (có cache 5 phút + dedup in-flight).
 * @param accessToken - Bearer token xác thực Riot.
 * @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 * @param region - Shard hợp lệ. @param userId - PUUID.
 * @param options - { force?: boolean } để bỏ qua cache (pull-to-refresh).
 * @returns CompetitiveMMRResponse hoặc {} — object rỗng nghĩa là thất bại.
 */
export async function getCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions = {}
): Promise<CompetitiveMMRResult> {
  const cacheKey = getPlayerResourceKey(region, userId);
  const cached = competitiveMmrCache.get(cacheKey);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingRequest = competitiveMmrRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = requestCompetitiveMMR(
    accessToken,
    entitlementsToken,
    region,
    userId
  )
    .then((response) => {
      if (Object.keys(response).length > 0) {
        competitiveMmrCache.set(cacheKey, {
          value: response as CompetitiveMMRResponse,
          expiresAt: Date.now() + COMPETITIVE_MMR_CACHE_TTL_MS,
        });
      }
      return response;
    })
    .finally(() => {
      competitiveMmrRequests.delete(cacheKey);
    });

  competitiveMmrRequests.set(cacheKey, request);
  return request;
}

/** Nội bộ: request MMR và retry khi client version lệch với session. */
async function requestCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<CompetitiveMMRResult> {
  // Wrapper request MMR (tái dùng cho cả lần đầu và lần retry).
  const requestMmr = () => axios.request<CompetitiveMMRResponse>({
    url: buildRiotApiUrl({ name: "mmr", region: region, userId: userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  logValorantApiDebug("MMR_FetchPlayer request", {
    region,
    userId: maskSecretForLog(userId),
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await requestMmr();
  logValorantApiDebug("MMR_FetchPlayer response", {
    status: res.status,
    statusText: res.statusText,
    data: res.data,
  });

  // HTTP 200 ngay lần đầu → trả data, không cần hydrate client version.
  if (res.status === 200) {
    return res.data;
  }

  // Thất bại → lấy client version từ session; khác version hiện tại thì retry.
  const currentVersion = getRiotClientVersionForRequests();
  const sessionVersion = await hydrateRiotClientVersionFromSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  );

  if (sessionVersion && sessionVersion !== currentVersion) {
    const retryRes = await requestMmr();
    logValorantApiDebug("MMR_FetchPlayer retry response", {
      status: retryRes.status,
      statusText: retryRes.statusText,
      data: retryRes.data,
    });
    return retryRes.status === 200 ? retryRes.data : {};
  }

  return {};
}

/** Lấy chi tiết đầy đủ của MỘT trận (match-details v1) — players, teams,
 *  roundResults: nguồn dữ liệu cho màn hình match session/thống kê.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ. @param matchId - UUID trận cần tra.
 *  @returns MatchDetailsResponse. Throw khi HTTP lỗi (caller bắt). */
export async function matchDetails(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<MatchDetailsResponse> {
  logValorantApiDebug("MatchDetails request", {
    region,
    matchId,
  });
  const res = await axios.request<MatchDetailsResponse>({
    url: buildRiotApiUrl({ name: "match-details", region: region, matchId: matchId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  logValorantApiDebug("MatchDetails response", {
    status: res.status,
    matchId,
    queueId: res.data.matchInfo?.queueID,
    seasonId: res.data.matchInfo?.seasonId,
    playerCount: res.data.players?.length ?? 0,
    roundCount: res.data.roundResults?.length ?? 0,
  });
  logValorantApiResponse(`MatchDetails ${matchId}`, res.data);
  return res.data;
}

// ---------------------------------------------------------------------------
// getCompetitiveUpdates - Cập nhật competitive (lịch sử thay đổi rank + RR)
// ---------------------------------------------------------------------------
/** Lấy competitive updates (MMR per-match: RR, rank sau trận, elo...).
 *  @param params - startIndex/endIndex (INCLUSIVE), queue="competitive".
 *  @returns CompetitiveUpdatesResponse khi HTTP 200; null khi khác (không
 *  throw — caller tự fallback vì đây là dữ liệu bổ trợ, không bắt buộc). */
export async function getCompetitiveUpdates(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
): Promise<CompetitiveUpdatesResponse | null> {
  logValorantApiDebug("MMR_FetchCompetitiveUpdates request", {
    region,
    userId: maskSecretForLog(userId),
    params,
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await axios.request<CompetitiveUpdatesResponse>({
    url: buildRiotApiUrl({ name: "competitive-updates", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  logValorantApiDebug("MMR_FetchCompetitiveUpdates response", {
    status: res.status,
    statusText: res.statusText,
    matchCount: res.data?.Matches?.length ?? 0,
    startIndex: params?.startIndex,
    endIndex: params?.endIndex,
  });
  logValorantApiResponse("CompetitiveUpdates", res.data);
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// getPlayerNames - Giải mã danh sách UUID subject thành GameName/TagLine
// PUT /name-service với cache LRU 1h (max 500) + dedup in-flight per subject
// ---------------------------------------------------------------------------
/** Tra tên hàng loạt subject. Subject còn cache hạn không được fetch lại;
 *  phần thiếu gộp thành MỘT PUT — consumer gọi sau join request đang bay.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param subjects - Mảng PUUID (trùng/viết hoa được chuẩn hóa trước).
 *  @param region - Shard hợp lệ (đi vào cache key).
 *  @returns PlayerName[] CHỈ gồm subject tra được; subject thiếu bị lược
 *  bỏ — caller phải hiển thị fallback (vd "?"). */
export async function getPlayerNames(
  accessToken: string,
  entitlementsToken: string,
  subjects: string[],
  region: string
): Promise<PlayerName[]> {
  // Chuẩn hóa: lọc rỗng, lowercase, khử trùng lặp (Set).
  const normalizedSubjects = Array.from(
    new Set(subjects.filter(Boolean).map((subject) => subject.toLowerCase()))
  );
  const now = Date.now();
  // Chỉ fetch các subject chưa có cache hoặc cache đã hết hạn (TTL 1h).
  const missingSubjects = normalizedSubjects.filter((subject) => {
    const cached = playerNameCache.get(`${region}|${subject}`);
    return !cached || cached.expiresAt <= now;
  });

  if (missingSubjects.length > 0) {
    const pendingRequests = new Set<Promise<void>>();
    const subjectsToFetch = missingSubjects.filter((subject) => {
      const pending = playerNameRequests.get(`${region}|${subject}`);
      if (pending) {
        pendingRequests.add(pending);
        return false;
      }
      return true;
    });

    if (subjectsToFetch.length > 0) {
      const request = axios
        .request<PlayerName[]>({
          url: buildRiotApiUrl({ name: "name", region }),
          method: "PUT",
          headers: {
            ...extraHeaders(),
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Riot-Entitlements-JWT": entitlementsToken,
          },
          data: subjectsToFetch,
          validateStatus: () => true,
        })
        .then((res) => {
          if (res.status !== 200 || !Array.isArray(res.data)) {
            throw new Error(
              `Name Service returned ${res.status} instead of a player list`
            );
          }

          res.data.forEach((entry) => {
            const cacheKey = `${region}|${entry.Subject.toLowerCase()}`;
            if (playerNameCache.size >= PLAYER_NAME_CACHE_MAX_SIZE) {
              const oldestKey = [...playerNameCache.entries()].sort(
                (a, b) => a[1].lastAccessed - b[1].lastAccessed
              )[0]?.[0];
              if (oldestKey) playerNameCache.delete(oldestKey);
            }
            playerNameCache.set(cacheKey, {
              value: entry,
              expiresAt: Date.now() + PLAYER_NAME_CACHE_TTL_MS,
              lastAccessed: Date.now(),
            });
          });
        })
        .finally(() => {
          subjectsToFetch.forEach((subject) => {
            playerNameRequests.delete(`${region}|${subject}`);
          });
        });

      subjectsToFetch.forEach((subject) => {
        playerNameRequests.set(`${region}|${subject}`, request);
      });
      pendingRequests.add(request);
    }

    await Promise.all(pendingRequests);
  }

  // Trả kết quả từ cache theo thứ tự input; touch LRU (cập nhật lastAccessed).
  return normalizedSubjects.flatMap((subject) => {
    const cached = playerNameCache.get(`${region}|${subject}`);
    if (cached && cached.expiresAt > Date.now()) {
      cached.lastAccessed = Date.now();
      return [cached.value];
    }
    return [];
  });
}
