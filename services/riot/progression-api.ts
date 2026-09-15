import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { API_DEBUG_LOGGING, extraHeaders, logValorantApiDebug, logValorantApiResponse } from "~/services/riot/request-context";

export { getRiotClientConfig, clearRiotClientConfigCache } from "~/services/riot/client-config-cache";

// ---------------------------------------------------------------------------
// Contracts (hợp đồng/agent contract)
// ---------------------------------------------------------------------------
/** Lấy contracts (hợp đồng agent + tiến trình battlepass) — GET /contracts/:userId.
 *  @param accessToken - Bearer token từ auth.riotgames.com.
 *  @param entitlementsToken - JWT quyền (header X-Riot-Entitlements-JWT).
 *  @returns Data khi HTTP 200; null khi lỗi (không throw — caller tự fallback). */
export async function getContracts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: buildRiotApiUrl({ name: "contracts", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (API_DEBUG_LOGGING) console.log("[contracts] response", {
    status: res.status,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Activate Contract (kích hoạt hợp đồng agent)
// ---------------------------------------------------------------------------
/** Kích hoạt contract agent — POST /contracts/:userId/special/:contractId (PD).
 *  Hành động thay đổi tài khoản: chỉ gọi từ tương tác UI của người dùng.
 *  @param accessToken/entitlementsToken/region/userId - bộ xác thực chuẩn Riot.
 *  @param contractId - UUID contract cần kích hoạt.
 *  @returns ContractsResponse mới khi HTTP 200; null khi lỗi (không throw). */
export async function activateContract(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  contractId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: buildRiotApiUrl({ name: "activate-contract", region, userId, itemTypeId: contractId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (API_DEBUG_LOGGING) console.log("[activate-contract] response", {
    status: res.status,
    contractId,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Item Upgrades (nâng cấp skin bằng Radianite)
// ---------------------------------------------------------------------------
/** Lấy danh sách item upgrade (nâng skin bằng Radianite) — GET item-upgrades.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ (ap/eu/kr/na/pbe).
 *  @returns ItemUpgradesResponse khi HTTP 200; null khi lỗi (không throw). */
export async function getItemUpgrades(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ItemUpgradesResponse | null> {
  const res = await axios.request<ItemUpgradesResponse>({
    url: buildRiotApiUrl({ name: "item-upgrades", region }),
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

// ---------------------------------------------------------------------------
// Fetch Content (seasons, acts, events)
// ---------------------------------------------------------------------------
/** Lấy nội dung game (season/act/event) từ content-service v3 của shard.
 *  Dùng để xác định act đang chạy cho thống kê season (fetchSeasonStats).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @returns ContentResponse khi HTTP 200; null khi lỗi (không cache). */
export async function getContent(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ContentResponse | null> {
  logValorantApiDebug("Content request", { region });
  const res = await axios.request<ContentResponse>({
    url: buildRiotApiUrl({ name: "content", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  logValorantApiDebug("Content response", {
    status: res.status,
    seasonCount: res.data?.Seasons?.length ?? 0,
    eventCount: res.data?.Events?.length ?? 0,
  });
  logValorantApiResponse("Content", res.data);
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Leaderboard (bảng xếp hạng)
// ---------------------------------------------------------------------------
/** Lấy bảng xếp hạng competitive theo season — GET mmr/v1/leaderboards/
 *  affinity/:shard/queue/competitive/season/:seasonId trên PD.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard quyết định affinity của bảng xếp hạng.
 *  @param seasonId - UUID season cần tra hạng.
 *  @param params - Phân trang/tìm kiếm tùy chọn: startIndex, size, query.
 *  @returns LeaderboardResponse khi HTTP 200; null khi lỗi (không throw). */
export async function getLeaderboard(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  seasonId: string,
  params?: { startIndex?: number; size?: number; query?: string }
): Promise<LeaderboardResponse | null> {
  const res = await axios.request<LeaderboardResponse>({
    url: buildRiotApiUrl({ name: "leaderboard", region, itemTypeId: seasonId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Config (cấu hình game)
// ---------------------------------------------------------------------------
/** Lấy cấu hình game theo shard — GET /v1/config/:shard trên PD.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ cần lấy config.
 *  @returns ConfigResponse khi HTTP 200; null khi lỗi (không throw). */
export async function getConfig(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ConfigResponse | null> {
  const res = await axios.request<ConfigResponse>({
    url: buildRiotApiUrl({ name: "config", region }),
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

// ---------------------------------------------------------------------------
// Penalties (hình phạt)
// ---------------------------------------------------------------------------
/** Lấy hình phạt/restriction của tài khoản — GET restrictions/v3/penalties.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ.
 *  @returns PenaltiesResponse khi HTTP 200; null khi lỗi (không throw). */
export async function getPenalties(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<PenaltiesResponse | null> {
  const res = await axios.request<PenaltiesResponse>({
    url: buildRiotApiUrl({ name: "penalties", region }),
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

// ---------------------------------------------------------------------------
// Player Info (thông tin người chơi từ auth.riotgames.com/userinfo)
// ---------------------------------------------------------------------------
/** Lấy userinfo Riot — GET auth.riotgames.com/userinfo (chỉ cần access token,
 *  không cần entitlementsToken). @param accessToken - Bearer token.
 *  @returns PlayerInfoResponse (puuid, pvp_id_account...) khi HTTP 200;
 *  null khi token hết hạn hoặc lỗi (không throw). */
export async function getPlayerInfo(
  accessToken: string
): Promise<PlayerInfoResponse | null> {
  const res = await axios.request<PlayerInfoResponse>({
    url: buildRiotApiUrl({ name: "playerinfo" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Riot Geo (lấy region affinity)
// ---------------------------------------------------------------------------
/** Tra region affinity từ Riot Geo — PUT pas/v1/product/valorant.
 *  Dùng lúc đăng nhập để chọn shard/region phù hợp cho tài khoản.
 *  @param accessToken - Bearer token xác thực Riot.
 *  @param idToken - ID token gửi trong body { id_token } để Riot định vị.
 *  @returns RiotGeoResponse khi HTTP 200; null khi lỗi (không throw). */
export async function getRiotGeo(
  accessToken: string,
  idToken: string
): Promise<RiotGeoResponse | null> {
  const res = await axios.request<RiotGeoResponse>({
    url: buildRiotApiUrl({ name: "riotgeo" }),
    method: "PUT",
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: { id_token: idToken },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// PAS Token (token xác thực chat XMPP)
// ---------------------------------------------------------------------------
/** Lấy PAS token cho XMPP chat — GET pas/v1/service/chat (chỉ access token).
 *  Token này do chat-service dùng để đăng nhập kênh chat trong game.
 *  @param accessToken - Bearer token xác thực Riot (không cần entitlements).
 *  @returns PAS token (string) khi HTTP 200; null khi lỗi (không throw). */
export async function getPASToken(
  accessToken: string
): Promise<string | null> {
  const res = await axios.request<string>({
    url: buildRiotApiUrl({ name: "pastoken" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}
