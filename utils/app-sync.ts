/**
 * app-sync.ts — Quản lý đồng bộ nền (background sync) cho toàn bộ app.
 *
 * Nguyên lý: "cache-first, background-refresh"
 * - App mở → render ngay từ persisted data (không chờ API)
 * - Background: refresh từng data source theo TTL
 * - Mỗi data source có TTL riêng (shop 6h, balances 1h, matches 5m, ...)
 * - Chỉ refresh khi data hết hạn (stale)
 */

import { getBalances, getProgress, getShop, parseShop } from "./valorant-api";
import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { getNetworkProfile } from "./network";
import { getAccountSessionKey } from "./saved-accounts";

// ===== Base TTL (milliseconds) =====
// Ghi chú: `matches` phải bằng MATCH_CACHE_TTL_MS trong useMatchStore (30 phút)
// để tránh tình trạng app-sync báo stale nhưng store lại no-op do TTL riêng.
const BASE_TTL = {
  shop: 6 * 60 * 60 * 1000,
  balances: 60 * 60 * 1000,
  matches: 30 * 60 * 1000,
  profile: 5 * 60 * 1000,
  leaderboard: 30 * 60 * 1000,
  contracts: 30 * 60 * 1000,
} as const;

// ===== Export SYNC_TTL (adaptive based on network) =====
export const SYNC_TTL: Record<keyof typeof BASE_TTL, number> = { ...BASE_TTL };

// Cellular multiplier: tăng TTL x2 trên 4G để giảm API calls
const CELLULAR_TTL_MULTIPLIER = 2;

let cellularChecked = false;
async function adaptTtlForNetwork(): Promise<void> {
  if (cellularChecked) return;
  cellularChecked = true;
  try {
    const net = await getNetworkProfile();
    if (net.isCellular) {
      (Object.keys(BASE_TTL) as (keyof typeof BASE_TTL)[]).forEach((key) => {
      SYNC_TTL[key] = BASE_TTL[key] * CELLULAR_TTL_MULTIPLIER;
      });
    }
  } catch { /* ignore */ }
}

// ===== Sync tracking (theo từng account, không persist) =====
type SyncSource = keyof typeof BASE_TTL;
type AccountSyncState = Record<SyncSource, number>;

const accountSyncStates = new Map<string, AccountSyncState>();
const shopBalancesInFlight = new Map<string, Promise<void>>();

// ===== Full-sync registry (chống sync chồng sync) =====
// syncAllData (data-sync.ts) đăng ký accountKey đang sync full tại đây.
// refreshShopAndBalances đọc registry này để nhường đường — nếu full sync đang
// chạy cho cùng account thì shop/balances sắp được ghi bởi sync đó rồi,
// không được fetch đè song song (tránh double request + stale-overwrite).
const fullSyncInFlight = new Map<string, number>();

/** Đăng ký bắt đầu full sync cho một account (data-sync gọi) */
export function beginFullSync(accountKey: string): void {
  fullSyncInFlight.set(accountKey, (fullSyncInFlight.get(accountKey) ?? 0) + 1);
}

/** Gỡ đăng ký khi full sync kết thúc (thành công hay thất bại) */
export function endFullSync(accountKey: string): void {
  const remaining = (fullSyncInFlight.get(accountKey) ?? 0) - 1;
  if (remaining > 0) {
    fullSyncInFlight.set(accountKey, remaining);
  } else {
    fullSyncInFlight.delete(accountKey);
  }
}

/** Full sync cho account này có đang chạy không? */
export function isFullSyncInFlight(accountKey: string): boolean {
  return (fullSyncInFlight.get(accountKey) ?? 0) > 0;
}

const createAccountSyncState = (): AccountSyncState => ({
  shop: 0,
  balances: 0,
  matches: 0,
  profile: 0,
  leaderboard: 0,
  contracts: 0,
});

const getAccountSyncState = (accountKey: string) => {
  const existing = accountSyncStates.get(accountKey);
  if (existing) return existing;

  const created = createAccountSyncState();
  accountSyncStates.set(accountKey, created);
  return created;
};

/** Kiểm tra xem data có stale (cần refresh) không */
export const isStale = (key: keyof typeof SYNC_TTL, lastSyncedAt: number): boolean => {
  if (lastSyncedAt === 0) return true;
  return Date.now() - lastSyncedAt > SYNC_TTL[key];
};

/** Lấy timestamp sync gần nhất */
export const getLastSync = (key: "shop" | "balances" | "matches") => {
  const accountKey = getAccountSessionKey(useUserStore.getState().user);
  return getAccountSyncState(accountKey)[key];
};

/**
 * refreshShopAndBalances — Refresh shop + balances + progress trong nền.
 * Chỉ chạy khi data stale (TTL) hoặc force=true.
 * Không throw — lỗi được nuốt im lặng.
 *
 * Guards:
 * - Nếu full sync (syncAllData) đang chạy cho cùng account → bỏ qua,
 *   vì shop/balances sẽ được ghi bởi sync đó (chống fetch trùng + stale-overwrite).
 * - Trước khi ghi store, kiểm tra lại token: nếu token đã được renew
 *   trong lúc fetch chạy thì KHÔNG ghi (tránh đè token mới bằng token cũ
 *   đã hết hạn — nguyên nhân từng gây vòng lặp 401 sau khi renew).
 */
export async function refreshShopAndBalances(force = false): Promise<void> {
  const store = useUserStore.getState();
  const user = store.user;

  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return;
  }

  const accountKey = getAccountSessionKey(user);

  // Full sync đang chạy cho account này → nhường, không fetch đè
  if (isFullSyncInFlight(accountKey)) {
    return;
  }

  // A request created with expired credentials must not absorb the first
  // refresh after token renewal for the same account.
  const requestKey = `${accountKey}|${user.accessToken}|${user.entitlementsToken}`;
  const existingRequest = shopBalancesInFlight.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const syncState = getAccountSyncState(accountKey);
    const shopStale = force || isStale("shop", syncState.shop);
    const balancesStale = force || isStale("balances", syncState.balances);

    if (!shopStale && !balancesStale) return;

    try {
      if (shopStale || balancesStale) {
        const [shop, progress, balances] = await Promise.all([
          getShop(user.accessToken, user.entitlementsToken, user.region, user.id),
          getProgress(user.accessToken, user.entitlementsToken, user.region, user.id),
          getBalances(user.accessToken, user.entitlementsToken, user.region, user.id),
        ]);

        const shops = await parseShop(shop, user.shops.bundles);
        const currentUser = useUserStore.getState().user;
        // Guard ghi store: account phải không đổi VÀ token phải còn là token
        // đã dùng cho request này. Nếu token đã bị renew giữa chừng, dữ liệu
        // này (và đặc biệt là spread ...currentUser chứa token cũ) không được
        // phép ghi đè session mới.
        if (
          getAccountSessionKey(currentUser) !== accountKey ||
          currentUser.accessToken !== user.accessToken
        ) {
          return;
        }
        store.setUser({
          ...currentUser,
          shops,
          progress,
          balances,
        });

        const syncedAt = Date.now();
        syncState.shop = syncedAt;
        syncState.balances = syncedAt;
      }
    } catch (error) {
      if (__DEV__) console.warn("[app-sync] shop/balances refresh failed", error);
    }
  })();

  shopBalancesInFlight.set(requestKey, request);
  try {
    await request;
  } finally {
    if (shopBalancesInFlight.get(requestKey) === request) {
      shopBalancesInFlight.delete(requestKey);
    }
  }
}

/**
 * refreshMatches — Refresh match history trong nền.
 * Delegate cho useMatchStore.fetchMatches (đã có dedup + cache).
 */
export async function refreshMatches(force = false): Promise<void> {
  const store = useUserStore.getState();
  const user = store.user;

  if (!user.accessToken || !user.region || !user.id) return;

  const accountKey = getAccountSessionKey(user);
  const syncState = getAccountSyncState(accountKey);
  if (!force && !isStale("matches", syncState.matches)) return;

  try {
    const refreshed = await useMatchStore.getState().fetchMatches(user, force);
    if (
      refreshed &&
      getAccountSessionKey(useUserStore.getState().user) === accountKey
    ) {
      syncState.matches = Date.now();
    }
  } catch (error) {
    if (__DEV__) console.warn("[app-sync] matches refresh failed", error);
  }
}

/**
 * fullBackgroundSync — Chạy toàn bộ sync theo thứ tự ưu tiên.
 * Được gọi sau khi app render xong từ cache.
 * 1. Shop + balances (visible nhất)
 * 2. Matches
 * Profile/loadout đã có stale-while-revalidate riêng trong useProfileCacheStore.
 */
export async function fullBackgroundSync(force = false): Promise<void> {
  const user = useUserStore.getState().user;

  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return;
  }

  // Adapt TTL based on network (cellular = longer TTL)
  await adaptTtlForNetwork();

  // Refresh song song shop + matches (không phụ thuộc nhau)
  await Promise.allSettled([
    refreshShopAndBalances(force),
    refreshMatches(force),
  ]);
}

/**
 * shouldSkipFullSync — Kiểm tra xem có cần sync không dựa trên thời gian.
 * Trả về true nếu tất cả data đều còn fresh.
 */
export function shouldSkipFullSync(): boolean {
  const accountKey = getAccountSessionKey(useUserStore.getState().user);
  const syncState = getAccountSyncState(accountKey);
  return (
    !isStale("shop", syncState.shop) &&
    !isStale("matches", syncState.matches)
  );
}

/**
 * markSynced — Đánh dấu data source đã được sync (set timestamp = now).
 * Dùng sau khi buildAuthenticatedUser hoặc manual fetch để tránh re-fetch thỡ.
 */
export function markSynced(
  keys: ("shop" | "balances" | "matches")[],
  account = useUserStore.getState().user
) {
  const syncState = getAccountSyncState(getAccountSessionKey(account));
  const now = Date.now();
  keys.forEach((key) => {
    syncState[key] = now;
  });
}
