import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { OwnedItemsResponse, PlayerLoadoutExpression, PlayerLoadoutResponse } from "~/services/riot/api-types";
import { API_DEBUG_LOGGING, extraHeaders, getPlayerResourceKey } from "~/services/riot/request-context";

// Type nội bộ cho phản hồi loadout v3 (không có Sprays, thay bằng ActiveExpressions và DynamicOptions)
type PlayerLoadoutV3Response = Omit<PlayerLoadoutResponse, "Sprays"> & {
  ActiveExpressions: PlayerLoadoutExpression[];
  DynamicOptions: Record<string, unknown>;
};

export type RiotPlayerRequestOptions = {
  force?: boolean;
};

const PLAYER_LOADOUT_CACHE_TTL_MS = 30 * 1000;

const playerLoadoutCache = new Map<
  string,
  { value: PlayerLoadoutResponse; expiresAt: number }
>();

const playerLoadoutRequests = new Map<
  string,
  Promise<PlayerLoadoutResponse | null>
>();

const cachePlayerLoadout = (
  region: string,
  userId: string,
  value: PlayerLoadoutResponse
) => {
  playerLoadoutCache.set(getPlayerResourceKey(region, userId), {
    value,
    expiresAt: Date.now() + PLAYER_LOADOUT_CACHE_TTL_MS,
  });
};

// Hàm kiểm tra dữ liệu có phải là PlayerLoadoutV3Response hợp lệ không (type guard)
// Parameters:
//   - value: dữ liệu cần kiểm tra
// Returns: true nếu value là PlayerLoadoutV3Response
const isUsablePlayerLoadoutV3 = (
  value: unknown
): value is PlayerLoadoutV3Response => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const loadout = value as Partial<PlayerLoadoutV3Response>;
  return (
    typeof loadout.Subject === "string" &&
    typeof loadout.Version === "number" &&
    Array.isArray(loadout.Guns) &&
    Array.isArray(loadout.ActiveExpressions) &&
    Boolean(loadout.Identity)
  );
};

// Export hàm trích xuất danh sách ItemID từ response OwnedItemsResponse
// Xử lý cả hai định dạng cũ (Entitlements) và mới (EntitlementsByTypes)
// Parameters:
//   - response: OwnedItemsResponse hoặc null
// Returns: mảng các ItemID (string) duy nhất
export const extractOwnedItemIds = (response?: OwnedItemsResponse | null) =>
  Array.from(
    new Set(
      [
        ...(response?.Entitlements ?? []).map((entitlement) => entitlement.ItemID),
        ...(response?.EntitlementsByTypes ?? []).flatMap((entry) =>
          (entry.Entitlements ?? []).map((entitlement) => entitlement.ItemID)
        ),
      ].filter((itemId): itemId is string => Boolean(itemId))
    )
  );

// Export hàm lấy loadout (trang bị) của người chơi
// Ưu tiên API v3, fallback về v2 nếu v3 không khả dụng
// Parameters:
//   - accesstoken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<PlayerLoadoutResponse | null>
export async function playerLoadout(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions = {}
): Promise<PlayerLoadoutResponse | null> {
  const cacheKey = getPlayerResourceKey(region, userId);
  const cached = playerLoadoutCache.get(cacheKey);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // A forced refresh bypasses resolved data but still joins an active request.
  const existingRequest = playerLoadoutRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = requestPlayerLoadout(
    accesstoken,
    entitlementsToken,
    region,
    userId
  )
    .then((response) => {
      if (response) {
        cachePlayerLoadout(region, userId, response);
      }
      return response;
    })
    .finally(() => {
      playerLoadoutRequests.delete(cacheKey);
    });

  playerLoadoutRequests.set(cacheKey, request);
  return request;
}

async function requestPlayerLoadout(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<PlayerLoadoutResponse | null> {
  const headers = {
    ...extraHeaders(),
    "X-Riot-Entitlements-JWT": entitlementsToken,
    Authorization: `Bearer ${accesstoken}`,
  };

  // Thử API v3 trước
  const currentResponse = await axios
    .request<PlayerLoadoutV3Response>({
      url: buildRiotApiUrl({ name: "player-v3", region, userId }),
      method: "GET",
      validateStatus: () => true,
      headers,
    })
    .catch(() => null);

  // Nếu v3 thành công và dữ liệu hợp lệ
  if (
    currentResponse?.status === 200 &&
    isUsablePlayerLoadoutV3(currentResponse.data)
  ) {
    if (API_DEBUG_LOGGING) {
      console.log("Player Loadout status:", {
        v3: currentResponse.status,
        v2: "skipped",
      });
    }

    return {
      ...currentResponse.data,
      SourceApiVersion: "v3",
      Sprays: [],                                                  // v3 không có Sprays
      ActiveExpressions: currentResponse.data.ActiveExpressions ?? [],
      DynamicOptions: currentResponse.data.DynamicOptions ?? {},
    };
  }

  // Fallback về API v2
  const legacyResponse = await axios
    .request<PlayerLoadoutResponse>({
      url: buildRiotApiUrl({ name: "player", region, userId }),
      method: "GET",
      validateStatus: () => true,
      headers,
    })
    .catch(() => null);

  const legacy =
    legacyResponse?.status === 200 ? legacyResponse.data : null;

  if (API_DEBUG_LOGGING) {
    console.log("Player Loadout status:", {
      v3: currentResponse?.status ?? null,
      v2: legacyResponse?.status ?? null,
    });
  }

  if (!legacy) {
    return null;    // Cả hai API đều thất bại
  }

  return {
    ...legacy,
    SourceApiVersion: "v2",
    Guns: legacy.Guns ?? [],
    Sprays: legacy.Sprays ?? [],
    ActiveExpressions: legacy.ActiveExpressions ?? [],
    DynamicOptions: legacy.DynamicOptions ?? {},
  };
}

// Export hàm cập nhật loadout người chơi (API v2)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadout(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const res = await axios.request<PlayerLoadoutResponse>({
    url: buildRiotApiUrl({ name: "player", region, userId }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      Guns: loadout.Guns,
      Sprays: loadout.Sprays,
      Identity: loadout.Identity,
      Incognito: loadout.Incognito,
    },
  });

  const updatedLoadout: PlayerLoadoutResponse = {
    ...loadout,
    ...res.data,
    SourceApiVersion: "v2",
    ActiveExpressions: loadout.ActiveExpressions ?? [],
    DynamicOptions: loadout.DynamicOptions ?? {},
  };

  cachePlayerLoadout(region, userId, updatedLoadout);
  return updatedLoadout;
}

// Export hàm cập nhật loadout người chơi (API v3)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadoutV3(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const res = await axios.request<PlayerLoadoutV3Response>({
    url: buildRiotApiUrl({ name: "player-v3", region, userId }),
    method: "PUT",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      Subject: loadout.Subject,
      Version: loadout.Version,
      Guns: loadout.Guns,
      ActiveExpressions: loadout.ActiveExpressions ?? [],
      DynamicOptions: loadout.DynamicOptions ?? {},
      Identity: loadout.Identity,
      Incognito: loadout.Incognito,
    },
  });

  if (res.status !== 200) {
    throw new Error(`Player loadout v3 update failed with ${res.status}`);
  }

  const updatedLoadout = {
    ...loadout,
    ...res.data,
    SourceApiVersion: "v3",
    Sprays: loadout.Sprays,
    ActiveExpressions:
      res.data.ActiveExpressions ?? loadout.ActiveExpressions ?? [],
    DynamicOptions: res.data.DynamicOptions ?? loadout.DynamicOptions ?? {},
  } as PlayerLoadoutResponse;

  cachePlayerLoadout(region, userId, updatedLoadout);
  return updatedLoadout;
}

// Export hàm cập nhật loadout, ưu tiên v3 nếu loadout hiện tại là v3
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadoutV3First(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  if (loadout.SourceApiVersion === "v2") {
    return updatePlayerLoadout(
      accessToken,
      entitlementsToken,
      region,
      userId,
      loadout
    );
  }

  return updatePlayerLoadoutV3(
    accessToken,
    entitlementsToken,
    region,
    userId,
    loadout
  );
}

// Export hàm lấy danh sách item đã sở hữu (entitlements) theo loại item
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - itemTypeId: UUID loại item (skin, spray, card, ...)
// Returns: Promise<OwnedItemsResponse> hoặc object rỗng nếu lỗi
export async function ownedItems(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  itemTypeId: string
) {
  const res = await axios.request<OwnedItemsResponse>({
    url: buildRiotApiUrl({
      name: "owned-items",
      region,
      userId,
      itemTypeId,
    }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : {};
}
