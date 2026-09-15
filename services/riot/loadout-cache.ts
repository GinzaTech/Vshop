import type { PlayerLoadoutResponse } from "./api-types";
import type { RiotPlayerRequestOptions } from "./loadout-api";
import { createRequestScope } from "./request-scope";
import { getPlayerResourceKey } from "./request-context";

// TTL cache đọc loadout (30s): đủ ngắn để sửa loadout nơi khác thấy nhanh.
const PLAYER_LOADOUT_CACHE_TTL_MS = 30 * 1000;
// Số lần mutation (PUT loadout) theo user — dùng vô hiệu hóa cache kịp thời.
const loadoutMutationVersions = new Map<string, number>();
const loadoutScope = createRequestScope();

export function clearCachedLoadout() {
  loadoutScope.clear();
  loadoutMutationVersions.clear();
  playerLoadoutCache.clear();
  playerLoadoutRequests.clear();
}

// Cache đọc loadout (memory only): key "region|userId" → { value, expiresAt }.
const playerLoadoutCache = new Map<
  string,
  { value: PlayerLoadoutResponse; expiresAt: number }
>();

// Request loadout đang bay: key gồm cả mutationVersion + token — mutation bump
// version nên request cũ sau mutation không còn được join nữa (tránh stale).
const playerLoadoutRequests = new Map<
  string,
  Promise<PlayerLoadoutResponse | null>
>();

/** Ghi loadout vào cache đọc với TTL 30s (key "region|userId"). */
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

export const observeLoadoutSession = (region: string, userId: string, accessToken: string, entitlementsToken: string) =>
  loadoutScope.observe(getPlayerResourceKey(region, userId), accessToken, entitlementsToken);

export function cacheUpdatedLoadout(region: string, userId: string, value: PlayerLoadoutResponse) {
  cachePlayerLoadout(region, userId, value);
  const key = getPlayerResourceKey(region, userId);
  loadoutMutationVersions.set(key, (loadoutMutationVersions.get(key) ?? 0) + 1);
}

/** Lấy loadout người chơi (ưu tiên v3, fallback v2) với cache 30s + dedup.
 *  requestKey gồm mutationVersion + token: PUT loadout xong bump version nên
 *  mọi request in-flight trước mutation không còn join được — tránh stale.
 *  @param accesstoken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param region - Shard hợp lệ. @param userId - PUUID chủ loadout.
 *  @returns Loadout hoặc null nếu cả v3 lẫn v2 thất bại. */
export async function getCachedPlayerLoadout(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions,
  load: () => Promise<PlayerLoadoutResponse | null>
): Promise<PlayerLoadoutResponse | null> {
  const cacheKey = getPlayerResourceKey(region, userId);
  const scope = loadoutScope.observe(cacheKey, accesstoken, entitlementsToken);
  const mutationVersion = loadoutMutationVersions.get(cacheKey) ?? 0;
  const requestKey = scope.key(`${mutationVersion}|${options.force ? "force" : "cached"}`);
  const cached = playerLoadoutCache.get(cacheKey);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Force refresh vẫn được gộp vào request in-flight cùng key (chỉ bỏ qua cache).
  const existingRequest = playerLoadoutRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const assertLatest = scope.start();
  const request = load()
    .then((response) => {
      scope.assertCurrent();
      if (mutationVersion !== (loadoutMutationVersions.get(cacheKey) ?? 0)) {
        return playerLoadoutCache.get(cacheKey)?.value ?? null;
      }
      assertLatest();
      if (response) {
        cachePlayerLoadout(region, userId, response);
      }
      return response;
    })
    .catch((error: unknown) => {
      scope.assertCurrent();
      throw error;
    })
    .finally(() => {
      if (playerLoadoutRequests.get(requestKey) === request) playerLoadoutRequests.delete(requestKey);
    });

  playerLoadoutRequests.set(requestKey, request);
  return request;
}
