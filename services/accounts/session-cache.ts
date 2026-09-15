import { captureMatchCache, restoreMatchCache, useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useCombatStore } from "~/hooks/useCombatStore";
import { clearRiotPlayerCaches } from "~/services/riot/match-api";
import { clearRiotClientConfigCache } from "~/services/riot/progression-api";
import { clearSyncTracking } from "~/utils/app-sync";
import { clearProfileWarmupCache } from "~/utils/profile-cache";
import { clearStartupCache } from "~/utils/startup-cache";

/** Keep the data snapshot separate from credentials/cookie rollback. */
export const captureAccountData = () => ({
  matches: captureMatchCache(),
  profiles: useProfileCacheStore.getState().cacheByAuth,
});

const invalidateResourceCaches = () => {
  useCombatStore.getState().resetSession();
  clearProfileWarmupCache();
  clearRiotPlayerCaches();
  clearRiotClientConfigCache();
  clearSyncTracking();
};

/** Reset also invalidates pending writers before asynchronous disk cleanup. */
export const clearAccountData = async () => {
  invalidateResourceCaches();
  useMatchStore.getState().resetMatchCache();
  useProfileCacheStore.getState().resetProfileCache();
  await clearStartupCache();
};

export const restoreAccountData = async (snapshot: ReturnType<typeof captureAccountData>) => {
  invalidateResourceCaches();
  restoreMatchCache(snapshot.matches);
  useProfileCacheStore.setState({ cacheByAuth: snapshot.profiles });
  // Failed startup data must never leave a completed marker for the target.
  await clearStartupCache();
};
