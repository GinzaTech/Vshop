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
const BASE_TTL = {
  shop: 6 * 60 * 60 * 1000,
  balances: 60 * 60 * 1000,
  matches: 5 * 60 * 1000,
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
 */
export async function refreshShopAndBalances(force = false): Promise<void> {
  const store = useUserStore.getState();
  const user = store.user;

  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return;
  }

  const accountKey = getAccountSessionKey(user);
  const existingRequest = shopBalancesInFlight.get(accountKey);
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
        if (getAccountSessionKey(currentUser) !== accountKey) {
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

  shopBalancesInFlight.set(accountKey, request);
  try {
    await request;
  } finally {
    if (shopBalancesInFlight.get(accountKey) === request) {
      shopBalancesInFlight.delete(accountKey);
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
    await useMatchStore.getState().fetchMatches(user, force);
    if (getAccountSessionKey(useUserStore.getState().user) === accountKey) {
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
