import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { getAccountSessionKey } from "~/utils/saved-accounts";
import { getStoredItem, setStoredItem } from "~/utils/storage";

const STARTUP_CACHE_KEY = "startup-core-sync-v1";
export const STARTUP_CACHE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export type StartupCacheMetadata = {
  accountKey: string;
  completedAt: number;
};

type StartupAccount = {
  id: string;
  region: string;
};

export const isStartupCacheMetadataUsable = (
  metadata: StartupCacheMetadata | null,
  accountKey: string,
  hasProfileCache: boolean,
  now = Date.now()
) =>
  Boolean(
    metadata &&
      metadata.accountKey === accountKey &&
      metadata.completedAt > 0 &&
      now - metadata.completedAt <= STARTUP_CACHE_MAX_AGE_MS &&
      hasProfileCache
  );

const readMetadata = async (): Promise<StartupCacheMetadata | null> => {
  try {
    const raw = await getStoredItem(STARTUP_CACHE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<StartupCacheMetadata>;
    return typeof candidate.accountKey === "string" &&
      typeof candidate.completedAt === "number"
      ? { accountKey: candidate.accountKey, completedAt: candidate.completedAt }
      : null;
  } catch {
    return null;
  }
};

export const markStartupCacheReady = async (account: StartupAccount) => {
  try {
    const metadata: StartupCacheMetadata = {
      accountKey: getAccountSessionKey(account),
      completedAt: Date.now(),
    };
    await setStoredItem(STARTUP_CACHE_KEY, JSON.stringify(metadata));
    return true;
  } catch {
    // Cache eligibility is optional. A storage failure must not turn a fully
    // successful authenticated sync into a startup failure.
    return false;
  }
};

export const hasUsableStartupCache = async (account: StartupAccount) => {
  const accountKey = getAccountSessionKey(account);
  const profileCache = useProfileCacheStore.getState().cacheByAuth[accountKey];
  const matchState = useMatchStore.getState();
  const matchCacheBelongsToAccount =
    !matchState.authKey || matchState.authKey === accountKey;

  return (
    matchCacheBelongsToAccount &&
    isStartupCacheMetadataUsable(
      await readMetadata(),
      accountKey,
      Boolean(profileCache?.updatedAt)
    )
  );
};
