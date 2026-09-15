import { riotApiClient as axios } from "~/services/riot/client";
import { createRequestScope } from "~/services/riot/request-scope";
import { clearCachedPlayerNames } from "~/services/riot/player-name-cache";
import { getCachedCompetitiveMMR, clearCachedCompetitiveMMR, type CompetitiveMMRResult } from "~/services/riot/mmr-cache";
import { clearRiotLoadoutCache } from "~/services/riot/loadout-api";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { CompetitiveMMRResponse, ValorantSessionResponse } from "~/services/riot/api-types";
import type { RiotPlayerRequestOptions } from "~/services/riot/loadout-api";
import { extraHeaders, getRiotClientVersionForRequests, logValorantApiDebug, logValorantApiResponse, maskSecretForLog, setRiotClientVersionOverride } from "~/services/riot/request-context";

export { getPlayerNames } from "~/services/riot/player-name-cache";

const clientVersionScope = createRequestScope();

/** Logout/failed account switches invalidate pending completions as well as data. */
export function clearRiotPlayerCaches() {
  clearCachedPlayerNames();
  clearCachedCompetitiveMMR();
  clientVersionScope.clear();
  clearRiotLoadoutCache();
}

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
  userId: string,
  assertCallerCurrent?: () => void
) {
  const scope = clientVersionScope.observe("client-version", accessToken, entitlementsToken);
  const session = await getValorantSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  ).catch(() => null);
  scope.assertCurrent();
  assertCallerCurrent?.();
  const sessionVersion = session?.clientVersion?.trim();

  if (!sessionVersion) {
    return null;
  }

  return setRiotClientVersionOverride(sessionVersion);
}

/** Read cached MMR; refresh work is scoped by credentials and session generation. */
export function getCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions = {}
): Promise<CompetitiveMMRResult> {
  return getCachedCompetitiveMMR(accessToken, entitlementsToken, region, userId, options,
    (assertCurrent) => requestCompetitiveMMR(accessToken, entitlementsToken, region, userId, assertCurrent)
  );
}

/** Nội bộ: request MMR và retry khi client version lệch với session. */
async function requestCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  assertCurrent: () => void
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
  assertCurrent();
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
    userId,
    assertCurrent
  );
  assertCurrent();

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
