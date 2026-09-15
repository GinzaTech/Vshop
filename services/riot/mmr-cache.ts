import type { CompetitiveMMRResponse } from "./api-types";
import type { RiotPlayerRequestOptions } from "./loadout-api";
import { createRequestScope } from "./request-scope";
import { getPlayerResourceKey } from "./request-context";

const mmrScope = createRequestScope();
export function clearCachedCompetitiveMMR() {
  mmrScope.clear();
  competitiveMmrCache.clear();
  competitiveMmrRequests.clear();
}

// getCompetitiveMMR: MMR competitive (rank, RR, leaderboard info của player).
// Cache 5 phút + dedup in-flight theo "region|userId"; force=true bỏ qua cache.
// Tự retry 1 lần sau khi hydrate client version từ session nếu lần đầu lỗi.
// Returns: CompetitiveMMRResponse khi OK; {} (object rỗng) khi thất bại.
export type CompetitiveMMRResult =
  | CompetitiveMMRResponse
  | Record<string, never>;

// TTL cache MMR: 5 phút — đủ ngắn để bắt thay đổi RR sau mỗi trận competitive.
const COMPETITIVE_MMR_CACHE_TTL_MS = 5 * 60 * 1000;

// Cache MMR (memory only): key "region|userId" → { value, expiresAt }.
const competitiveMmrCache = new Map<
  string,
  { value: CompetitiveMMRResponse; expiresAt: number }
>();

// Request MMR đang bay theo "region|userId" — caller sau join promise này.
const competitiveMmrRequests = new Map<
  string,
  Promise<CompetitiveMMRResult>
>();

/**
 * Lấy MMR competitive của người chơi (có cache 5 phút + dedup in-flight).
 * @param accessToken - Bearer token xác thực Riot.
 * @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 * @param region - Shard hợp lệ. @param userId - PUUID.
 * @param options - { force?: boolean } để bỏ qua cache (pull-to-refresh).
 * @returns CompetitiveMMRResponse hoặc {} — object rỗng nghĩa là thất bại.
 */
export async function getCachedCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  options: RiotPlayerRequestOptions,
  load: (assertCurrent: () => void) => Promise<CompetitiveMMRResult>
): Promise<CompetitiveMMRResult> {
  const cacheKey = getPlayerResourceKey(region, userId);
  const scope = mmrScope.observe(cacheKey, accessToken, entitlementsToken);
  const requestKey = scope.key(options.force ? "force" : "cached");
  const cached = competitiveMmrCache.get(cacheKey);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingRequest = competitiveMmrRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const assertCurrent = scope.start();
  const request = load(assertCurrent)
    .then((response) => {
      assertCurrent();
      if (Object.keys(response).length > 0) {
        competitiveMmrCache.set(cacheKey, {
          value: response as CompetitiveMMRResponse,
          expiresAt: Date.now() + COMPETITIVE_MMR_CACHE_TTL_MS,
        });
      }
      return response;
    })
    .catch((error: unknown) => {
      assertCurrent();
      throw error;
    })
    .finally(() => {
      if (competitiveMmrRequests.get(requestKey) === request) competitiveMmrRequests.delete(requestKey);
    });

  competitiveMmrRequests.set(requestKey, request);
  return request;
}
