import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { CompetitiveMMRResponse, ValorantSessionResponse } from "~/services/riot/api-types";
import type { RiotPlayerRequestOptions } from "~/services/riot/loadout-api";
import { extraHeaders, getPlayerResourceKey, getRiotClientVersionForRequests, logValorantApiDebug, logValorantApiResponse, maskSecretForLog, setRiotClientVersionOverride } from "~/services/riot/request-context";

// Kiểu dữ liệu cho tên người chơi: Subject (UUID), GameName, TagLine
type PlayerName = { Subject: string; GameName: string; TagLine: string };

// Thời gian sống (TTL) của cache tên người chơi: 1 giờ (tính bằng milliseconds)
const PLAYER_NAME_CACHE_TTL_MS = 60 * 60 * 1000;

// Số lượng tối đa entry trong cache tên người chơi (LRU eviction)
const PLAYER_NAME_CACHE_MAX_SIZE = 500;

// Cache tên người chơi: key = "region|subject", value = { value, expiresAt }
const playerNameCache = new Map<
  string,
  { value: PlayerName; expiresAt: number; lastAccessed: number }
>();

// Promise theo từng subject giúp các consumer dùng chung cả cache và request
// đang chạy, kể cả khi danh sách subject của chúng chỉ trùng một phần.
const playerNameRequests = new Map<string, Promise<void>>();

// Export hàm lấy lịch sử trận đấu của người chơi
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - params: tham số tùy chọn (startIndex, endIndex, queue)
// Returns: Promise<MatchHistoryResponse>
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

// Export hàm lấy thông tin session Valorant hiện tại
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<ValorantSessionResponse | null>
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

// Export hàm cập nhật phiên bản Riot client từ thông tin session
// Lấy clientVersion từ session và set làm override
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<string | null> phiên bản đã set hoặc null
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

// Export hàm lấy thông tin MMR competitive của người chơi
// Tự động retry với client version từ session nếu request đầu thất bại
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<CompetitiveMMRResponse | {}>
type CompetitiveMMRResult =
  | CompetitiveMMRResponse
  | Record<string, never>;

const COMPETITIVE_MMR_CACHE_TTL_MS = 5 * 60 * 1000;

const competitiveMmrCache = new Map<
  string,
  { value: CompetitiveMMRResponse; expiresAt: number }
>();

const competitiveMmrRequests = new Map<
  string,
  Promise<CompetitiveMMRResult>
>();

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

async function requestCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<CompetitiveMMRResult> {
  // Hàm nội bộ thực hiện request MMR
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

  // Thành công ngay lần đầu
  if (res.status === 200) {
    return res.data;
  }

  // Thất bại: thử hydrate client version và retry
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

// Export hàm lấy chi tiết một trận đấu cụ thể
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<MatchDetailsResponse>
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
// getCompetitiveUpdates - Lấy cập nhật competitive (lịch sử rank)
// ---------------------------------------------------------------------------
// Export hàm lấy lịch sử thay đổi rank competitive
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - params: tham số tùy chọn (startIndex, endIndex, queue)
// Returns: Promise<CompetitiveUpdatesResponse | null>
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
// getPlayerNames – Giải mã danh sách UUID subject thành GameName/TagLine
// Có cache và deduplicate request
// ---------------------------------------------------------------------------
// Export hàm lấy tên người chơi từ danh sách subject UUIDs
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - subjects: mảng UUID cần tra cứu
//   - region: khu vực
// Returns: Promise<PlayerName[]> danh sách tên người chơi
export async function getPlayerNames(
  accessToken: string,
  entitlementsToken: string,
  subjects: string[],
  region: string
): Promise<PlayerName[]> {
  // Chuẩn hóa: loại bỏ trùng lặp, chuyển về chữ thường
  const normalizedSubjects = Array.from(
    new Set(subjects.filter(Boolean).map((subject) => subject.toLowerCase()))
  );
  const now = Date.now();
  // Lọc các subject chưa có cache hoặc cache đã hết hạn
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

  // Trả về kết quả từ cache
  return normalizedSubjects.flatMap((subject) => {
    const cached = playerNameCache.get(`${region}|${subject}`);
    if (cached && cached.expiresAt > Date.now()) {
      cached.lastAccessed = Date.now();
      return [cached.value];
    }
    return [];
  });
}
