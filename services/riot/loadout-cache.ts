import type { PlayerLoadoutResponse } from "./api-types";
import type { RiotPlayerRequestOptions } from "./loadout-api";
import { createRequestScope } from "./request-scope";
import { getPlayerResourceKey } from "./request-context";
import { isLoadoutResponse, sameLoadoutData } from "./loadout-response";
import { retireLoadoutOwners } from "./loadout-lifecycle";
import { SessionChangedError } from "~/utils/session-operations";

// TTL cache đọc loadout (30s): đủ ngắn để sửa loadout nơi khác thấy nhanh.
const PLAYER_LOADOUT_CACHE_TTL_MS = 30 * 1000;
// Số lần mutation (PUT loadout) theo user — dùng vô hiệu hóa cache kịp thời.
const loadoutMutationVersions = new Map<string, number>();
const loadoutScope = createRequestScope();

export function clearCachedLoadout() {
  retireLoadoutOwners();
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

/** Separate in-flight reads from both the start and settlement of an ambiguous PUT. */
export function invalidateLoadoutReads(region: string, userId: string) {
  const key = getPlayerResourceKey(region, userId);
  loadoutMutationVersions.set(key, (loadoutMutationVersions.get(key) ?? 0) + 1);
}

export function cacheUpdatedLoadout(region: string, userId: string, value: PlayerLoadoutResponse) {
  if (!isLoadoutResponse(value, userId, playerLoadoutCache.get(getPlayerResourceKey(region, userId))?.value.Version ?? 0)) return;
  cachePlayerLoadout(region, userId, value);
  invalidateLoadoutReads(region, userId);
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
  if (options.isCurrent && !options.isCurrent()) throw new SessionChangedError();
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
      if (options.isCurrent && !options.isCurrent()) throw new SessionChangedError();
      if (mutationVersion !== (loadoutMutationVersions.get(cacheKey) ?? 0)) {
        // A force read is reconciliation evidence, never a cached substitute.
        // A crossing PUT may have applied even when its receipt was lost.
        return options.force ? null : playerLoadoutCache.get(cacheKey)?.value ?? null;
      }
      assertLatest();
      if (response) {
        const latest = playerLoadoutCache.get(cacheKey)?.value;
        if (!isLoadoutResponse(response, userId, latest?.Version ?? 0) ||
            latest && response.Version === latest.Version && !sameLoadoutData(response, latest)) return options.force ? null : latest ?? null;
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
