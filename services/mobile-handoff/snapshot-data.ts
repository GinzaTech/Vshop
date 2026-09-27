import { MAX_SAVED_ACCOUNTS, normalizeAccountId } from "~/utils/saved-accounts";
import type {
  MobileAccountVaultEnvelope,
  MobileVaultSnapshotInput,
} from "./types";

const fail = (): never => {
  throw new Error("MOBILE_SNAPSHOT_REJECTED");
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const deepFreeze = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(value);
};

const pick = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
) => Object.fromEntries(
  keys.filter((key) => Object.prototype.hasOwnProperty.call(value, key))
    .map((key) => [key, clone(value[key])]),
);

const PUBLIC_USER_KEYS = [
  "id", "name", "TagLine", "region", "shops", "balances", "progress",
  "ownedSkinIds",
] as const;

const MATCH_CACHE_KEYS = [
  "authKey", "matches", "lastUpdated", "totalMatches", "historyEndIndex",
  "recordingStartedAt", "recordingStartSeasonId", "seasonStats",
  "seasonStatsById", "seasonMatchesById", "seasonOptions",
] as const;

export function createMobileAccountVaultEnvelope(
  input: MobileVaultSnapshotInput,
): MobileAccountVaultEnvelope {
  const accounts = input.accounts.slice(0, MAX_SAVED_ACCOUNTS).map((account) => ({
    id: account.id,
    name: account.name,
    tagLine: account.tagLine,
    region: account.region,
    accessToken: account.accessToken,
    idToken: account.idToken,
    entitlementsToken: account.entitlementsToken,
    authCookies: account.authCookies?.map((cookie) => ({ ...cookie })) ?? [],
    lastUsedAt: account.lastUsedAt,
  }));
  const activeId = normalizeAccountId(input.activeAccountId);
  if (!activeId || !accounts.some(
    (account) => normalizeAccountId(account.id) === activeId,
  )) fail();
  if (!Number.isFinite(input.capturedAt) || input.capturedAt < 0 ||
      input.source.packageName !== "com.android.vshop" ||
      !input.source.appVersion || !Number.isInteger(input.source.versionCode)) fail();

  const skinIds = Array.isArray(input.wishlist.skinIds)
    ? [...new Set(input.wishlist.skinIds.filter(
      (entry): entry is string => typeof entry === "string" && Boolean(entry),
    ))]
    : [];
  const matchCache = input.matchCache
    ? pick(input.matchCache, MATCH_CACHE_KEYS)
    : null;

  return deepFreeze({
    schemaVersion: 2 as const,
    capturedAt: input.capturedAt,
    source: { ...input.source },
    activeAccountId: activeId,
    accounts,
    stateSnapshot: {
      activeUser: pick(input.activeUser, PUBLIC_USER_KEYS),
      matchCache,
      profileCaches: clone(input.profileCaches),
      wishlist: {
        skinIds,
        notificationEnabled: input.wishlist.notificationEnabled === true,
      },
      preferences: {
        screenshotModeEnabled: Boolean(input.screenshotModeEnabled),
      },
    },
  });
}
