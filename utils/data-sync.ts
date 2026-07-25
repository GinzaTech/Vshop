/**
 * data-sync.ts — Lớp đồng bộ dữ liệu trung tâm.
 *
 * Nguyên lý: API → diff → update cache → UI đọc từ cache
 *
 * 1. Fetch toàn bộ API (parallel)
 * 2. Đọc dữ liệu hiện tại từ cache (Zustand persisted stores)
 * 3. So sánh (diff) dữ liệu mới vs cache
 * 4. Chỉ update store khi có thay đổi (giảm re-render thỡ)
 * 5. UI luôn đọc từ store, không bao giờ đọc trực tiếp từ API response
 */

import { buildAuthenticatedUser } from "./auth-session";
import { fetchProfileWarmCache } from "./profile-cache";
import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { markSynced } from "./app-sync";
import { getRiotClientConfig } from "./valorant-api";

// ===== Types =====

type ShopSummary = { uuid: string };
type BalancesData = { vp: number; rad: number; kc: number };
type SyncReport = {
  userChanged: boolean;
  shopsChanged: boolean;
  balancesChanged: boolean;
  nameChanged: boolean;
  matchesChanged: boolean;
  clientConfigLoaded: boolean;
  durationMs: number;
};

// ===== Comparison utilities (shallow diff) =====

/** So sánh 2 mảng shop items theo UUID — true nếu giống nhau */
function shopItemsEqual(
  old: readonly ShopSummary[],
  fresh: readonly ShopSummary[]
): boolean {
  if (old.length !== fresh.length) return false;
  return old.every((item, i) => item.uuid === fresh[i]?.uuid);
}

/** So sánh balances — true nếu vp/rad/kc giống nhau */
function balancesEqual(old: BalancesData, fresh: BalancesData): boolean {
  return old.vp === fresh.vp && old.rad === fresh.rad && old.kc === fresh.kc;
}

/** So sánh bundles — check UUID + remainingSecs */
function bundlesEqual(
  old: readonly { uuid: string; remainingSecs?: number }[],
  fresh: readonly { uuid: string; remainingSecs?: number }[]
): boolean {
  if (old.length !== fresh.length) return false;
  return old.every((b, i) => b.uuid === fresh[i]?.uuid);
}

/** So sánh match IDs — true nếu danh sách match không đổi */
function matchIdsEqual(
  old: readonly { MatchID: string }[],
  fresh: readonly { MatchID: string }[]
): boolean {
  if (old.length !== fresh.length) return false;
  const oldSet = new Set(old.map((m) => m.MatchID));
  return fresh.every((m) => oldSet.has(m.MatchID));
}

// ===== Core sync function =====

/**
 * syncAllData — Fetch toàn bộ API, diff với cache, update nếu thay đổi.
 *
 * @param user - User hiện tại (từ persisted store)
 * @param region - Region
 * @returns SyncReport — chi tiết gì đã thay đổi
 */
export async function syncAllData(
  user: typeof useUserStore extends { getState: () => { user: infer U } } ? U : never,
  region: string
): Promise<SyncReport> {
  const startTime = Date.now();

  // --- Bước 1: Đọc dữ liệu HIỆN TẠI từ cache ---
  const cachedUser = useUserStore.getState().user;
  const cachedMatches = useMatchStore.getState().matches;

  // --- Bước 2: WAVE 1 — RiotClientConfig (load đầu tiên, cần cho chat/features) ---
  let clientConfigLoaded = false;
  try {
    const config = await getRiotClientConfig(user.accessToken, user.entitlementsToken);
    clientConfigLoaded = config !== null;
  } catch {
    // Non-fatal — tiếp tục sync các data khác
  }

  // --- Bước 3: WAVE 2 — Fetch toàn bộ data chính (song song) ---
  const [authUserResult, matchesResult, profileResult] = await Promise.allSettled([
    buildAuthenticatedUser(user.accessToken, region, user),
    useMatchStore.getState().fetchMatches(user),
    fetchProfileWarmCache(user),
  ]);

  // Nếu auth thất bại → không thể sync
  if (authUserResult.status !== "fulfilled") {
    throw authUserResult.reason;
  }

  const authUser = authUserResult.value;

  // --- Bước 3: Diff dữ liệu mới vs cache ---
  const shopsChanged =
    !shopItemsEqual(cachedUser.shops.main, authUser.shops.main) ||
    !shopItemsEqual(cachedUser.shops.nightMarket, authUser.shops.nightMarket) ||
    !bundlesEqual(cachedUser.shops.bundles, authUser.shops.bundles);

  const balancesChanged = !balancesEqual(
    cachedUser.balances as BalancesData,
    authUser.balances as BalancesData
  );

  const nameChanged =
    cachedUser.name !== authUser.name ||
    cachedUser.TagLine !== authUser.TagLine;

  const progressChanged =
    cachedUser.progress?.level !== authUser.progress?.level;

  const userChanged = shopsChanged || balancesChanged || nameChanged || progressChanged;

  // Matches: store tự quản lý diff, chỉ check xem có data mới không
  const freshMatches = useMatchStore.getState().matches;
  const matchesChanged = !matchIdsEqual(
    cachedMatches.map((m) => ({ MatchID: m.MatchID })),
    freshMatches.map((m) => ({ MatchID: m.MatchID }))
  );

  // --- Bước 4: Chỉ update store khi có thay đổi ---
  if (userChanged) {
    // Merge thông minh: giữ nguyên token nếu API không trả token mới
    const mergedUser = {
      ...authUser,
      // Giữ nguyên token từ cache nếu authUser không có (tránh mất token)
      accessToken: authUser.accessToken || cachedUser.accessToken,
      idToken: authUser.idToken || cachedUser.idToken,
      entitlementsToken: authUser.entitlementsToken || cachedUser.entitlementsToken,
    };
    useUserStore.getState().setUser(mergedUser);
  }

  // Đánh dấu đã sync
  markSynced(["shop", "balances", "matches"]);

  const report: SyncReport = {
    userChanged,
    shopsChanged,
    balancesChanged,
    nameChanged,
    matchesChanged,
    clientConfigLoaded,
    durationMs: Date.now() - startTime,
  };

  if (__DEV__) {
    console.log("[data-sync] sync complete", report);
  }

  return report;
}

/**
 * getCachedDataSnapshot — Đọc snapshot dữ liệu hiện tại từ cache.
 * UI dùng hàm này để đọc data, không đọc trực tiếp từ API.
 */
export function getCachedDataSnapshot() {
  const user = useUserStore.getState().user;
  const matchState = useMatchStore.getState();
  return {
    user,
    matches: matchState.matches,
    totalMatches: matchState.totalMatches,
    lastMatchUpdated: matchState.lastUpdated,
  };
}
