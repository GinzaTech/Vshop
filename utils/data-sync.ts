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
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { beginFullSync, endFullSync, markSynced } from "./app-sync";
import { getRiotClientConfig } from "./valorant-api";
import { markStartupCacheReady } from "./startup-cache";
import { getAccountSessionKey } from "./saved-accounts";
import { getSessionGeneration, SessionChangedError } from "./session-operations";

// ===== Types =====

type ShopSummary = { uuid: string };
type BundleSummary = {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  displayIcon2?: string;
  price: number;
  items: readonly {
    uuid: string;
    displayName: string;
    displayIcon?: string;
    price: number;
  }[];
};
type BalancesData = { vp: number; rad: number; kc: number };
type SyncReport = {
  userChanged: boolean;
  credentialsChanged: boolean;
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

/** So sánh bundles — gồm cả metadata để thay fallback khi API cập nhật */
function bundlesEqual(
  old: readonly BundleSummary[],
  fresh: readonly BundleSummary[]
): boolean {
  if (old.length !== fresh.length) return false;
  return old.every((bundle, index) => {
    const next = fresh[index];
    if (
      !next ||
      bundle.uuid !== next.uuid ||
      bundle.displayName !== next.displayName ||
      bundle.displayIcon !== next.displayIcon ||
      bundle.displayIcon2 !== next.displayIcon2 ||
      bundle.price !== next.price ||
      bundle.items.length !== next.items.length
    ) {
      return false;
    }

    return bundle.items.every((item, itemIndex) => {
      const nextItem = next.items[itemIndex];
      return (
        Boolean(nextItem) &&
        item.uuid === nextItem.uuid &&
        item.displayName === nextItem.displayName &&
        item.displayIcon === nextItem.displayIcon &&
        item.price === nextItem.price
      );
    });
  });
}

/** So sánh match IDs — true nếu danh sách match không đổi */
function matchIdsEqual(
  old: readonly { MatchID: string }[],
  fresh: readonly { MatchID: string }[]
): boolean {
  if (old.length !== fresh.length) return false;
  return fresh.every((match, index) => old[index].MatchID === match.MatchID);
}

// ===== Core sync function =====

/**
 * syncAllData — Fetch toàn bộ API, diff với cache, update nếu thay đổi.
 *
 * @param user - User hiện tại (từ persisted store)
 * @param region - Region
 * @returns SyncReport — chi tiết gì đã thay đổi
 */
// Deduplicate only callers using the same session, credentials and region.
// Hai nơi gọi song song (vd AppWarmup + pull-to-refresh) với cùng phiên sẽ
// nhận chung promise. Entry được xoá khi request settle.
const syncRequests = new Map<string, Promise<SyncReport>>();

export function syncAllData(
  user: ReturnType<typeof useUserStore.getState>["user"],
  region: string
): Promise<SyncReport> {
  const key = JSON.stringify([getSessionGeneration(), getAccountSessionKey(user), user.accessToken, user.entitlementsToken, region]);
  const pending = syncRequests.get(key);
  if (pending) return pending;

  // Đăng ký "full sync đang chạy" để refreshShopAndBalances nhường đường,
  // tránh fetch shop/balances song song rồi ghi đè lẫn nhau (stale-overwrite).
  const accountKey = getAccountSessionKey(user);
  const trackingGeneration = beginFullSync(accountKey);

  const request = syncAllDataInternal(user, region)
    .finally(() => {
      endFullSync(accountKey, trackingGeneration);
    });
  syncRequests.set(key, request);
  void request.finally(() => {
    if (syncRequests.get(key) === request) syncRequests.delete(key);
  }).catch(() => undefined);
  return request;
}

// syncAllDataInternal — Thân chính của syncAllData (đã có dedup ở wrapper).
// Luồng: assert phiên còn hợp lệ → đọc cache → làm mới entitlement/session
// (buildAuthenticatedUser) → stamp TTL shop/balances ngay → fetch song song
// client config + matches + profile → diff với cache → markStartupCacheReady.
// Mỗi bước đều assertCurrent: nếu generation/account/token đổi giữa chừng
// (re-auth, switch account) thì throw SessionChangedError và bỏ kết quả.
async function syncAllDataInternal(
  user: typeof useUserStore extends { getState: () => { user: infer U } } ? U : never,
  region: string
): Promise<SyncReport> {
  const startTime = Date.now();
  const generation = getSessionGeneration();
  let expectedAccountKey = getAccountSessionKey(user);
  let expectedEntitlementsToken = user.entitlementsToken;
  const assertCurrent = () => {
    const current = useUserStore.getState().user;
    if (
      generation !== getSessionGeneration() ||
      getAccountSessionKey(current) !== expectedAccountKey ||
      current.accessToken !== user.accessToken ||
      current.entitlementsToken !== expectedEntitlementsToken
    ) throw new SessionChangedError();
    return current;
  };
  assertCurrent();

  // --- Bước 1: Đọc dữ liệu HIỆN TẠI từ cache ---
  const cachedUser = useUserStore.getState().user;
  const cachedMatches = useMatchStore.getState().matches;

  // --- Bước 2: Làm mới entitlement/session trước mọi request phụ thuộc auth ---
  // buildAuthenticatedUser dùng access token còn hạn để xin entitlement mới.
  // Credential mới phải được persist ngay cả khi shop/balance không thay đổi.
  const authUser = await buildAuthenticatedUser(user.accessToken, region, user);
  const latestUser = assertCurrent();
  useUserStore.getState().setUser({
    ...latestUser,
    name: authUser.name,
    TagLine: authUser.TagLine,
    shops: authUser.shops,
    progress: authUser.progress,
    balances: authUser.balances,
    region: authUser.region,
    entitlementsToken: authUser.entitlementsToken,
  });
  expectedAccountKey = getAccountSessionKey(authUser);
  expectedEntitlementsToken = authUser.entitlementsToken;

  // Stamp TTL của shop/balances NGAY TẠI ĐÂY (không đợi cuối sync): dữ liệu
  // shop/balances vừa được fetch + ghi, nếu đợi đến cuối sync (có thể thêm
  // nhiều giây vì matches/profile) thì các refresh nền chạy giữa chừng
  // (vd AppWarmup t+3s) sẽ thấy stale và fetch trùng.
  markSynced(["shop", "balances"], authUser);

  // --- Bước 3: Fetch các nguồn còn lại bằng credentials vừa được làm mới ---
  const [clientConfig, matchesOk, profileCache] = await Promise.all([
    getRiotClientConfig(authUser.accessToken, authUser.entitlementsToken),
    useMatchStore.getState().fetchMatches(authUser),
    fetchProfileWarmCache(authUser),
  ]);
  assertCurrent();

  if (!clientConfig) {
    throw new Error("Riot client configuration is unavailable");
  }

  if (!profileCache) {
    throw new Error("Profile warm cache is unavailable");
  }

  // fetchMatches trả về boolean: true = dữ liệu dùng được (fetch OK hoặc cache
  // còn fresh). false = fetch thất bại → KHÔNG stamp matches để TTL layer
  // cho phép retry ở chu kỳ sau, thay vì khóa cache "đã sync" suốt 30 phút.
  if (matchesOk) {
    markSynced(["matches"], authUser);
  }

  const matchStateAfterSync = useMatchStore.getState();
  if (matchStateAfterSync.error && matchStateAfterSync.lastUpdated === 0) {
    throw new Error(matchStateAfterSync.error);
  }

  // Profile warmup is part of the startup sync. Persist its result before
  // navigating to Profile so that screen can render immediately from cache
  // instead of repeating loadout, ownership and MMR requests.
  useProfileCacheStore.getState().setProfileCache(profileCache);

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

  const credentialsChanged =
    cachedUser.accessToken !== authUser.accessToken ||
    cachedUser.idToken !== authUser.idToken ||
    cachedUser.entitlementsToken !== authUser.entitlementsToken ||
    cachedUser.region !== authUser.region;

  const userChanged =
    credentialsChanged ||
    shopsChanged ||
    balancesChanged ||
    nameChanged ||
    progressChanged;

  // Matches: store tự quản lý diff, chỉ check xem có data mới không
  const freshMatches = useMatchStore.getState().matches;
  const matchesChanged = !matchIdsEqual(
    cachedMatches.map((m) => ({ MatchID: m.MatchID })),
    freshMatches.map((m) => ({ MatchID: m.MatchID }))
  );

  // Startup/resume chỉ hoàn tất khi mọi nguồn lõi khả dụng. Matches đã được
  // stamp phía trên (chỉ khi fetch thành công). Việc này ngăn session nửa vời
  // vào app với các API action chết.
  await markStartupCacheReady(authUser);
  assertCurrent();

  const report: SyncReport = {
    userChanged,
    credentialsChanged,
    shopsChanged,
    balancesChanged,
    nameChanged,
    matchesChanged,
    clientConfigLoaded: true,
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
  const ownsMatches = Boolean(user.id) && matchState.authKey === getAccountSessionKey(user);
  return {
    user,
    matches: ownsMatches ? matchState.matches : [],
    totalMatches: ownsMatches ? matchState.totalMatches : 0,
    lastMatchUpdated: ownsMatches ? matchState.lastUpdated : 0,
  };
}
