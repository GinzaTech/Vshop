import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { API_DEBUG_LOGGING, extraHeaders, logValorantApiDebug, logValorantApiResponse } from "~/services/riot/request-context";

// ---------------------------------------------------------------------------
// Contracts (hợp đồng/agent contract)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin contracts của người chơi
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<ContractsResponse | null>
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
// Export hàm kích hoạt một contract (hợp đồng agent)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - contractId: UUID contract cần kích hoạt
// Returns: Promise<ContractsResponse | null>
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
// Export hàm lấy danh sách item upgrades (nâng cấp skin) khả dụng
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ItemUpgradesResponse | null>
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
// Export hàm lấy nội dung game (season, act, event hiện tại)
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ContentResponse | null>
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
// Export hàm lấy bảng xếp hạng competitive
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - seasonId: UUID season
//   - params: tham số tùy chọn (startIndex, size, query)
// Returns: Promise<LeaderboardResponse | null>
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
// Export hàm lấy cấu hình game cho shard hiện tại
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ConfigResponse | null>
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
// Export hàm lấy thông tin hình phạt (nếu có) của tài khoản
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<PenaltiesResponse | null>
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
// Export hàm lấy thông tin tài khoản Riot (không cần entitlementsToken)
// Parameters:
//   - accessToken: token xác thực
// Returns: Promise<PlayerInfoResponse | null>
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
// Export hàm lấy thông tin region (khu vực) của người dùng từ Riot Geo
// Parameters:
//   - accessToken: token xác thực
//   - idToken: ID token
// Returns: Promise<RiotGeoResponse | null>
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
// Export hàm lấy PAS token dùng cho xác thực XMPP chat
// Parameters:
//   - accessToken: token xác thực Riot
// Returns: Promise<string | null> PAS token
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

// ---------------------------------------------------------------------------
// Riot Client Config (cấu hình Riot client)
// ---------------------------------------------------------------------------
// Export hàm lấy cấu hình Riot client
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
// Returns: Promise<RiotClientConfigResponse | null>
export async function getRiotClientConfig(
  accessToken: string,
  entitlementsToken: string
): Promise<RiotClientConfigResponse | null> {
  const res = await axios.request<RiotClientConfigResponse>({
    url: buildRiotApiUrl({ name: "riotclientconfig" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return res.status === 200 ? res.data : null;
}
