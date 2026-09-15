import { riotApiClient as axios } from "~/services/riot/client";
import { createRequestScope } from "~/services/riot/request-scope";
import { cacheUpdatedLoadout, clearCachedLoadout, getCachedPlayerLoadout, observeLoadoutSession } from "~/services/riot/loadout-cache";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { OwnedItemsResponse, PlayerLoadoutExpression, PlayerLoadoutResponse } from "~/services/riot/api-types";
import { API_DEBUG_LOGGING, extraHeaders, getPlayerResourceKey } from "~/services/riot/request-context";

// PlayerLoadoutV3Response: loadout v3 KHÔNG có Sprays — thay bằng
// ActiveExpressions (banner player card) và DynamicOptions (hỗ trợ game mode).
type PlayerLoadoutV3Response = Omit<PlayerLoadoutResponse, "Sprays"> & {
  ActiveExpressions: PlayerLoadoutExpression[];
  DynamicOptions: Record<string, unknown>;
};

/** Options cho các API per-player: force = bỏ qua cache, đọc lại từ server. */
export type RiotPlayerRequestOptions = {
  force?: boolean;
};

const ownershipScope = createRequestScope();
export function clearRiotLoadoutCache() {
  clearCachedLoadout();
  ownershipScope.clear();
}

/** Type guard kiểm tra response v3 dùng được: đủ Subject/Version/Guns/
 *  ActiveExpressions/Identity — chặn dữ liệu malformed của Riot crash UI.
 *  @param value - Dữ liệu bất kỳ cần kiểm tra (unknown).
 *  @returns true nếu value khớp cấu trúc PlayerLoadoutV3Response. */
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

/** Gộp ItemID sở hữu từ 2 định dạng entitlements: cũ (Entitlements[]) và
 *  mới (EntitlementsByTypes[].Entitlements) — Set khử trùng lặp.
 *  @param response - OwnedItemsResponse từ ownedItems() (có thể null).
 *  @returns Mảng ItemID (string) duy nhất; rỗng nếu response rỗng/lỗi. */
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

/** Read loadout with account data cache and credential/generation scoped requests. */
export function playerLoadout(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions = {}
): Promise<PlayerLoadoutResponse | null> {
  return getCachedPlayerLoadout(accessToken, entitlementsToken, region, userId, options,
    () => requestPlayerLoadout(accessToken, entitlementsToken, region, userId)
  );
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

  // Thử API v3 trước (có ActiveExpressions); lỗi mạng/HTTP bất kỳ → null.
  const currentResponse = await axios
    .request<PlayerLoadoutV3Response>({
      url: buildRiotApiUrl({ name: "player-v3", region, userId }),
      method: "GET",
      validateStatus: () => true,
      headers,
    })
    .catch(() => null);

  // v3 OK + dữ liệu hợp lệ → chuẩn hóa về hình dạng v2 rồi trả ngay.
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

  // Fallback v2: endpoint personalization/v2 cũ, vẫn có trường Sprays.
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
    return null;    // Cả v3 lẫn v2 thất bại → caller hiển thị trạng thái lỗi.
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

/** PUT loadout API v2 (personalization/v2 — định dạng có Sprays).
 *  Sau khi Riot xác nhận: merge response lên loadout cục bộ, ghi cache đọc
 *  và bump mutationVersion để vô hiệu mọi request đọc in-flight cũ.
 *  @param loadout - Loadout mới cần áp (Guns/Sprays/Identity/Incognito).
 *  @returns Loadout đã cập nhật (SourceApiVersion: "v2"). */
export async function updatePlayerLoadout(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const scope = observeLoadoutSession(region, userId, accessToken, entitlementsToken);
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

  scope.assertCurrent();
  const updatedLoadout: PlayerLoadoutResponse = {
    ...loadout,
    ...res.data,
    SourceApiVersion: "v2",
    ActiveExpressions: loadout.ActiveExpressions ?? [],
    DynamicOptions: loadout.DynamicOptions ?? {},
  };

  cacheUpdatedLoadout(region, userId, updatedLoadout);
  return updatedLoadout;
}

/** PUT loadout API v3 (personalization/v3 — KHÔNG gửi Sprays, gửi Version
 *  để Riot kiểm tra optimistic concurrency). HTTP ≠ 200 sẽ throw Error.
 *  @param loadout - Loadout mới (Subject + Version + Guns + Identity...).
 *  @returns Loadout đã cập nhật (SourceApiVersion: "v3"). */
export async function updatePlayerLoadoutV3(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const scope = observeLoadoutSession(region, userId, accessToken, entitlementsToken);
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

  scope.assertCurrent();
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

  cacheUpdatedLoadout(region, userId, updatedLoadout);
  return updatedLoadout;
}

/** Chọn endpoint cập nhật theo nguồn gốc loadout hiện tại: v2 → PUT v2,
 *  còn lại → PUT v3. Gọi hàm này thay vì tự đoán version ở caller.
 *  @param loadout - Loadout đang hiển thị (quyết định endpoint).
 *  @returns Loadout đã cập nhật qua endpoint tương ứng. */
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

/** Lấy entitlements (item đã sở hữu) theo loại — GET store/v1/entitlements/
 *  :userId/:itemTypeId trên PD. Dùng cho danh sách skin/spray/card sở hữu.
 *  @param itemTypeId - UUID loại item (xem VItemTypes trong utils/misc).
 *  @returns OwnedItemsResponse khi HTTP 200; throw khi HTTP lỗi. */
export async function ownedItems(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  itemTypeId: string
) {
  const scope = ownershipScope.observe(getPlayerResourceKey(region, userId), accessToken, entitlementsToken);
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

  scope.assertCurrent();
  if (res.status !== 200) throw new Error(`Owned items request failed with ${res.status}`);
  return res.data;
}
