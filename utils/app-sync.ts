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
export const SYNC_TTL = { ...BASE_TTL };

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
        (SYNC_TTL as any)[key] = BASE_TTL[key] * CELLULAR_TTL_MULTIPLIER;
      });
    }
  } catch { /* ignore */ }
}

// ===== Sync tracking (lưu trong module, không cần persist) =====
let lastShopSync = 0;
let lastBalancesSync = 0;
let lastMatchesSync = 0;
let syncInFlight = false;

/** Kiểm tra xem data có stale (cần refresh) không */
export const isStale = (key: keyof typeof SYNC_TTL, lastSyncedAt: number): boolean => {
  if (lastSyncedAt === 0) return true;
  return Date.now() - lastSyncedAt > SYNC_TTL[key];
};

/** Lấy timestamp sync gần nhất */
export const getLastSync = (key: "shop" | "balances" | "matches") => {
  if (key === "shop") return lastShopSync;
  if (key === "balances") return lastBalancesSync;
  return lastMatchesSync;
};

/**
 * refreshShopAndBalances — Refresh shop + balances + progress trong nền.
 * Chỉ chạy khi data stale (TTL) hoặc force=true.
 * Không throw — lỗi được nuốt im lặng.
 */
export async function refreshShopAndBalances(force = false): Promise<void> {
  if (syncInFlight && !force) return;

  const store = useUserStore.getState();
  const user = store.user;

  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return;
  }

  const shopStale = force || isStale("shop", lastShopSync);
  const balancesStale = force || isStale("balances", lastBalancesSync);

  if (!shopStale && !balancesStale) return;

  syncInFlight = true;

  try {
    if (shopStale) {
      const [shop, progress, balances] = await Promise.all([
        getShop(user.accessToken, user.entitlementsToken, user.region, user.id),
        getProgress(user.accessToken, user.entitlementsToken, user.region, user.id),
        getBalances(user.accessToken, user.entitlementsToken, user.region, user.id),
      ]);

      const shops = await parseShop(shop, user.shops.bundles);

      const currentUser = useUserStore.getState().user;
      store.setUser({
        ...currentUser,
        shops,
        progress,
        balances,
      });

      lastShopSync = Date.now();
      lastBalancesSync = Date.now();
    }
  } catch (error) {
    if (__DEV__) console.warn("[app-sync] shop/balances refresh failed", error);
  } finally {
    syncInFlight = false;
  }
}

/**
 * refreshMatches — Refresh match history trong nền.
 * Delegate cho useMatchStore.fetchMatches (đã có dedup + cache).
 */
export async function refreshMatches(force = false): Promise<void> {
  if (!force && !isStale("matches", lastMatchesSync)) return;

  const store = useUserStore.getState();
  const user = store.user;

  if (!user.accessToken || !user.region || !user.id) return;

  try {
    await useMatchStore.getState().fetchMatches(user, force);
    lastMatchesSync = Date.now();
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
  return !isStale("shop", lastShopSync) && !isStale("matches", lastMatchesSync);
}

/**
 * markSynced — Đánh dấu data source đã được sync (set timestamp = now).
 * Dùng sau khi buildAuthenticatedUser hoặc manual fetch để tránh re-fetch thỡ.
 */
export function markSynced(keys: ("shop" | "balances" | "matches")[]) {
  const now = Date.now();
  keys.forEach((key) => {
    if (key === "shop") lastShopSync = now;
    if (key === "balances") lastBalancesSync = now;
    if (key === "matches") lastMatchesSync = now;
  });
}
