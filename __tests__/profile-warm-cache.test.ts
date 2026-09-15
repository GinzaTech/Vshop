import {
  clearProfileWarmupCache,
  fetchCompetitiveRankSummary,
  fetchProfileWarmCache,
  getSessionAuthKey,
  hasValidCompetitiveRankCache,
  isProfileCacheFresh,
  PROFILE_WARM_CACHE_TTL,
  type ProfileWarmCache,
} from "~/utils/profile-cache";
import { defaultUser } from "~/utils/valorant-user";
import { invalidateSessionOperations, SessionChangedError } from "~/utils/session-operations";

const mockLoadout = jest.fn();
const mockMmr = jest.fn();
const mockOwned = jest.fn();
const mockPersistedProfiles: { cacheByAuth: Record<string, ProfileWarmCache> } = { cacheByAuth: {} };
jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: { getState: () => mockPersistedProfiles },
}));
jest.mock("~/utils/valorant-api", () => ({
  playerLoadout: (...args: unknown[]) => mockLoadout(...args),
  getCompetitiveMMR: (...args: unknown[]) => mockMmr(...args),
  ownedItems: (...args: unknown[]) => mockOwned(...args),
  extractOwnedItemIds: (value: { Entitlements?: { ItemID: string }[] }) =>
    value.Entitlements?.map((entry) => entry.ItemID) ?? [],
}));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ competitiveTiers: [] }) }));

let user = { ...defaultUser, id: "player", region: "ap", accessToken: "old", entitlementsToken: "ent" };
let accountSequence = 0;
const snapshot = { Subject: "player", Version: 1, Guns: [], Sprays: [], Identity: {}, Incognito: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(() => {
  user = { ...user, id: `player-${++accountSequence}` };
  jest.useFakeTimers().setSystemTime(1_000_000);
  clearProfileWarmupCache();
  mockPersistedProfiles.cacheByAuth = {};
  mockLoadout.mockReset().mockResolvedValue(snapshot);
  mockMmr.mockReset().mockResolvedValue({ Subject: "player", QueueSkills: { competitive: { CompetitiveTier: 12 } } });
  mockOwned.mockReset().mockResolvedValue({ Entitlements: [{ ItemID: "owned" }] });
});
afterEach(() => jest.useRealTimers());

describe("profile warm cache session lifetime", () => {
  it("deduplicates a session and expires at the TTL boundary", async () => {
    const [first, duplicate] = await Promise.all([fetchProfileWarmCache(user), fetchProfileWarmCache(user)]);
    expect(first).toBe(duplicate);
    expect(mockLoadout).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(PROFILE_WARM_CACHE_TTL);
    await fetchProfileWarmCache(user);
    expect(mockLoadout).toHaveBeenCalledTimes(2);
  });

  it.each(["accessToken", "entitlementsToken"] as const)("isolates renewed %s and rejects the older completion", async (field) => {
    const old = deferred<typeof snapshot>();
    mockLoadout.mockImplementationOnce(() => old.promise);
    const stale = fetchProfileWarmCache(user);
    const outcome = stale.catch((error: unknown) => error);
    const fresh = fetchProfileWarmCache({ ...user, [field]: "renewed" });
    const callCount = mockLoadout.mock.calls.length;
    old.resolve({ ...snapshot, Version: 0 });
    await fresh;
    const result = await outcome;
    expect(callCount).toBe(2);
    expect(result).toMatchObject({ name: "SessionChangedError" });
  });

  it.each([false, true])("clear invalidates pending completion (account only=%s)", async (accountOnly) => {
    const old = deferred<typeof snapshot>();
    mockLoadout.mockImplementationOnce(() => old.promise);
    const pending = fetchProfileWarmCache(user);
    const rejected = expect(pending).rejects.toMatchObject({ name: "SessionChangedError" });
    clearProfileWarmupCache(accountOnly ? getSessionAuthKey(user) : undefined);
    old.resolve(snapshot);
    await rejected;
    await fetchProfileWarmCache(user);
    expect(mockLoadout).toHaveBeenCalledTimes(2);
  });

  it("rejects results when the global session generation changes", async () => {
    const old = deferred<typeof snapshot>();
    mockLoadout.mockImplementationOnce(() => old.promise);
    const pending = fetchProfileWarmCache(user);
    const rejected = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    invalidateSessionOperations();
    old.resolve(snapshot);
    await rejected;
  });

  it("force starts a new wave and an older non-force completion cannot overwrite it", async () => {
    const old = deferred<typeof snapshot>();
    mockLoadout.mockImplementationOnce(() => old.promise);
    const pending = fetchProfileWarmCache(user);
    const rejected = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    mockLoadout.mockResolvedValueOnce({ ...snapshot, Version: 2 });
    await fetchProfileWarmCache(user, { force: true });
    old.resolve(snapshot);
    await rejected;
    expect((await fetchProfileWarmCache(user))?.loadoutSnapshot?.Version).toBe(2);
  });
});

describe("profile component failures", () => {
  it.each(["loadout", "ownership", "rank"])("propagates a cancelled %s component without publishing a partial cache", async (component) => {
    if (component === "loadout") mockLoadout.mockRejectedValue(new SessionChangedError());
    if (component === "ownership") mockOwned.mockRejectedValueOnce(new SessionChangedError());
    if (component === "rank") mockMmr.mockRejectedValueOnce(new SessionChangedError());
    await expect(fetchProfileWarmCache(user)).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
  it("preserves prior loadout, rank and ownership without refreshing their freshness", async () => {
    const previous = await fetchProfileWarmCache(user);
    jest.advanceTimersByTime(PROFILE_WARM_CACHE_TTL);
    mockLoadout.mockResolvedValue(null);
    mockMmr.mockResolvedValue({});
    mockOwned.mockRejectedValue(new Error("offline"));
    const failed = await fetchProfileWarmCache(user, { force: true });
    expect(failed?.loadoutSnapshot).toEqual(previous?.loadoutSnapshot);
    expect(failed?.competitiveRank).toEqual(previous?.competitiveRank);
    expect(failed?.ownedSprayItemIds).toEqual(["owned"]);
    expect(failed?.updatedAt).toBe(previous?.updatedAt);
    expect(isProfileCacheFresh(failed)).toBe(false);
    await fetchProfileWarmCache(user);
    expect(mockLoadout).toHaveBeenCalledTimes(3);
  });

  it("never certifies the first failed MMR as an unranked success", async () => {
    mockMmr.mockResolvedValue({});
    const cache = await fetchProfileWarmCache(user);
    expect(hasValidCompetitiveRankCache(cache)).toBe(false);
    expect(isProfileCacheFresh(cache)).toBe(false);
  });

  it("certifies an actual unranked response, including a null rank summary", async () => {
    mockMmr.mockResolvedValue({ Subject: "player", QueueSkills: {} });
    const cache = await fetchProfileWarmCache(user);
    expect(cache?.competitiveRank).toBeNull();
    expect(hasValidCompetitiveRankCache(cache)).toBe(true);
    expect(isProfileCacheFresh(cache)).toBe(true);
  });

  it("does not mark a wave fresh when just one ownership request fails", async () => {
    await fetchProfileWarmCache(user);
    jest.advanceTimersByTime(PROFILE_WARM_CACHE_TTL);
    mockOwned.mockRejectedValueOnce(new Error("offline"));
    const cache = await fetchProfileWarmCache(user, { force: true });
    expect(isProfileCacheFresh(cache)).toBe(false);
    expect(cache?.ownedSkinItemIds).toEqual(["owned"]);
  });

  it("does not serve a fresh account cache without credentials", async () => {
    await fetchProfileWarmCache(user);
    expect(await fetchProfileWarmCache({ ...user, accessToken: "" })).toBeNull();
  });

  it("records successful components independently and retains failed component times", async () => {
    const previous = await fetchProfileWarmCache(user);
    jest.advanceTimersByTime(PROFILE_WARM_CACHE_TTL);
    mockOwned.mockRejectedValueOnce(new Error("offline"));
    const refreshed = await fetchProfileWarmCache(user, { force: true });
    expect(refreshed?.componentUpdatedAt?.loadout).toBe(Date.now());
    expect(refreshed?.componentUpdatedAt?.rank).toBe(Date.now());
    expect(refreshed?.componentUpdatedAt?.ownership[0]).toBe(previous?.componentUpdatedAt?.ownership[0]);
    expect(refreshed?.componentUpdatedAt?.ownership.slice(1)).toEqual(Array(5).fill(Date.now()));
  });

  it("replaces an old ranked summary with a successful unranked result", async () => {
    await fetchProfileWarmCache(user);
    mockMmr.mockResolvedValue({ Subject: "player", QueueSkills: {} });
    const cache = await fetchProfileWarmCache(user, { force: true });
    expect(cache?.competitiveRank).toBeNull();
    expect(hasValidCompetitiveRankCache(cache)).toBe(true);
  });

  it("keeps a valid rank when the refresh rejects at the network boundary", async () => {
    const previous = await fetchProfileWarmCache(user);
    mockMmr.mockRejectedValue(new Error("timeout"));
    const cache = await fetchProfileWarmCache(user, { force: true });
    expect(cache?.competitiveRank).toEqual(previous?.competitiveRank);
    expect(cache?.componentUpdatedAt?.rank).toBe(previous?.componentUpdatedAt?.rank);
  });
});

it("preserves the legacy rank-only interface for existing callers", async () => {
  expect((await fetchCompetitiveRankSummary(user))?.currentTier).toBe(12);
  mockMmr.mockResolvedValue({});
  expect(await fetchCompetitiveRankSummary(user)).toBeNull();
});

it("clearing one account preserves another account's pending dedupe", async () => {
  const otherUser = { ...user, id: "other" };
  const other = deferred<typeof snapshot>();
  mockLoadout.mockImplementationOnce(() => other.promise);
  const first = fetchProfileWarmCache(otherUser);
  clearProfileWarmupCache(getSessionAuthKey(user));
  const joined = fetchProfileWarmCache(otherUser);
  other.resolve(snapshot);
  expect(await joined).toBe(await first);
  expect(mockLoadout).toHaveBeenCalledTimes(1);
});

it("old cleanup after clear cannot delete a newer request with identical credentials", async () => {
  const old = deferred<typeof snapshot>();
  const current = deferred<typeof snapshot>();
  mockLoadout.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
  const stale = fetchProfileWarmCache(user).catch((error: unknown) => error);
  clearProfileWarmupCache();
  const fresh = fetchProfileWarmCache(user);
  old.resolve(snapshot);
  expect(await stale).toMatchObject({ code: "SESSION_CHANGED" });
  const joined = fetchProfileWarmCache(user);
  current.resolve(snapshot);
  expect(await joined).toBe(await fresh);
  expect(mockLoadout).toHaveBeenCalledTimes(2);
});

describe("cold start with a persisted profile", () => {
  it("preserves persisted components and success times when the first warm wave partially fails", async () => {
    const previous = (await fetchProfileWarmCache(user))!;
    mockPersistedProfiles.cacheByAuth = { [previous.authKey]: previous };
    clearProfileWarmupCache();
    jest.advanceTimersByTime(PROFILE_WARM_CACHE_TTL);
    mockLoadout.mockResolvedValue(null);
    mockMmr.mockResolvedValue({});
    mockOwned.mockRejectedValueOnce(new Error("skin levels offline"));
    mockOwned.mockRejectedValueOnce(new Error("skin chromas offline"));
    mockOwned.mockRejectedValueOnce(new Error("sprays offline"));
    mockOwned.mockResolvedValue({ Entitlements: [{ ItemID: "newly-owned" }] });

    const refreshed = (await fetchProfileWarmCache(user))!;
    // The same replacement performed by the persisted store must keep good data.
    mockPersistedProfiles.cacheByAuth = { [refreshed.authKey]: refreshed };
    const stored = mockPersistedProfiles.cacheByAuth[getSessionAuthKey(user)];
    expect(stored.loadoutSnapshot).toEqual(previous.loadoutSnapshot);
    expect(stored.loadoutCacheVersion).toBe(previous.loadoutCacheVersion);
    expect(stored.competitiveRank).toEqual(previous.competitiveRank);
    expect(stored.rankCacheVersion).toBe(previous.rankCacheVersion);
    expect(stored.ownedSkinItemIds).toEqual(previous.ownedSkinItemIds);
    expect(stored.ownedSprayItemIds).toEqual(previous.ownedSprayItemIds);
    expect(stored.ownedFlexItemIds).toEqual(["owned", "newly-owned"]);
    expect(stored.componentUpdatedAt?.loadout).toBe(previous.componentUpdatedAt?.loadout);
    expect(stored.componentUpdatedAt?.rank).toBe(previous.componentUpdatedAt?.rank);
    expect(stored.componentUpdatedAt?.ownership.slice(0, 3)).toEqual(previous.componentUpdatedAt?.ownership.slice(0, 3));
    expect(stored.componentUpdatedAt?.ownership.slice(3)).toEqual(Array(3).fill(Date.now()));
    expect(stored.updatedAt).toBe(previous.updatedAt);
    expect(isProfileCacheFresh(stored)).toBe(false);
  });

  it("never falls back to another account's persisted profile", async () => {
    const previous = (await fetchProfileWarmCache({ ...user, id: "another-player" }))!;
    mockPersistedProfiles.cacheByAuth = { [previous.authKey]: previous };
    clearProfileWarmupCache();
    mockLoadout.mockResolvedValue(null);
    mockMmr.mockResolvedValue({});
    mockOwned.mockRejectedValue(new Error("offline"));
    const refreshed = (await fetchProfileWarmCache(user))!;
    expect(refreshed.loadoutSnapshot).toBeNull();
    expect(refreshed.competitiveRank).toBeNull();
    expect(refreshed.ownedSkinItemIds).toEqual([]);
    expect(refreshed.rankCacheVersion).toBeUndefined();
  });
});
