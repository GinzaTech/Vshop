import {
  activateTransferredAccount,
  TransferredSessionError,
  type TransferredSessionDependencies,
} from "~/services/accounts/transferred-session";
import type {
  MobileVaultManifest,
  PentestCompanionClient,
  TransferredAccountSession,
} from "~/services/pentest-companion/types";
import { defaultUser } from "~/utils/valorant-user";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (sub: string) => `${encode({ alg: "RS256" })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const manifest: MobileVaultManifest = {
  schemaVersion: 2,
  capturedAt: Date.now(),
  activeHandle: "a".repeat(64),
  accounts: [{
    handle: "a".repeat(64),
    name: "Agent A",
    tagLine: "AP",
    region: "ap",
    lastUsedAt: Date.now(),
    tokenStatus: "ready",
  }],
  snapshotManifest: { hasMatchCache: true, profileCacheCount: 1, wishlistCount: 1 },
};

const transferred = (accountId = ACCOUNT_A): TransferredAccountSession => ({
  accountId,
  name: "Agent A",
  tagLine: "AP",
  region: "ap",
  lastUsedAt: Date.now(),
  accessToken: jwt(accountId),
  idToken: jwt(accountId),
  entitlementsToken: "old-entitlements",
  authCookies: [],
  tokenStatus: "ready",
  stateSnapshot: {
    activeUser: {
      id: accountId,
      name: "Agent A",
      TagLine: "AP",
      region: "ap",
      shops: defaultUser.shops,
      balances: defaultUser.balances,
      progress: defaultUser.progress,
      ownedSkinIds: ["skin-a"],
    },
    matchCache: {
      authKey: `ap|${accountId}`,
      matches: [],
      lastUpdated: 1,
      totalMatches: 0,
      historyEndIndex: 0,
      recordingStartedAt: 0,
      recordingStartSeasonId: null,
      seasonStats: null,
      seasonStatsById: {},
      seasonMatchesById: {},
      seasonOptions: [],
    },
    profileCaches: {},
    wishlist: { skinIds: ["skin-a"], notificationEnabled: true },
    preferences: { screenshotModeEnabled: true },
  },
});

function createHarness(selected = transferred()) {
  let generation = 0;
  let user = { ...defaultUser, id: "previous", region: "ap", accessToken: "previous-token" };
  let matchCache: unknown = { owner: "previous" };
  let profileCaches: unknown = { previous: true };
  let wishlist: unknown = { skinIds: ["previous"], notificationEnabled: false };
  let screenshotModeEnabled = false;
  const client = {
    activateMobileVaultAccount: jest.fn(async () => selected),
  } as unknown as jest.Mocked<PentestCompanionClient>;
  const dependencies: TransferredSessionDependencies = {
    invalidateSession: () => { generation += 1; },
    getGeneration: () => generation,
    getUser: () => user,
    activateUser: (next) => { user = next; },
    buildAuthenticatedUser: jest.fn(async (_access, _region, seed, idToken) => ({
      ...defaultUser,
      ...seed,
      id: selected.accountId,
      name: selected.name,
      TagLine: selected.tagLine,
      region: selected.region,
      accessToken: selected.accessToken,
      idToken,
      entitlementsToken: "fresh-entitlements",
    })),
    clearSavedAccounts: jest.fn(),
    captureMatchCache: () => matchCache,
    restoreMatchCache: (next) => { matchCache = next; },
    getProfileCaches: () => profileCaches,
    setProfileCaches: (next) => { profileCaches = next; },
    getWishlist: () => wishlist,
    setWishlist: (next) => { wishlist = next; },
    getScreenshotMode: () => screenshotModeEnabled,
    setScreenshotMode: (next) => { screenshotModeEnabled = next; },
    syncAllData: jest.fn(async () => undefined),
    disconnectChat: jest.fn(),
  };
  return {
    client,
    dependencies,
    advanceGeneration: () => { generation += 1; },
    state: () => ({ user, matchCache, profileCaches, wishlist, screenshotModeEnabled }),
  };
}

describe("activateTransferredAccount", () => {
  it("hydrates matching snapshot, builds fresh auth and clears browser saved accounts", async () => {
    const harness = createHarness();

    const user = await activateTransferredAccount({
      client: harness.client,
      handle: manifest.activeHandle,
      manifest,
      dependencies: harness.dependencies,
    });

    expect(user).toMatchObject({
      id: ACCOUNT_A,
      entitlementsToken: "fresh-entitlements",
    });
    expect(harness.dependencies.clearSavedAccounts).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.syncAllData).toHaveBeenCalledWith(user, "ap");
    expect(harness.state()).toMatchObject({
      wishlist: { skinIds: ["skin-a"], notificationEnabled: true },
      screenshotModeEnabled: true,
    });
  });

  it("rejects JWT subject substitution before publishing snapshot", async () => {
    const selected = transferred(ACCOUNT_A);
    const harness = createHarness({ ...selected, accessToken: jwt(ACCOUNT_B) });

    await expect(activateTransferredAccount({
      client: harness.client,
      handle: manifest.activeHandle,
      manifest,
      dependencies: harness.dependencies,
    })).rejects.toMatchObject({ code: "TRANSFERRED_ACCOUNT_REJECTED" });
    expect(harness.state().user.id).toBe("previous");
  });

  it("rejects a snapshot whose match cache belongs to another account", async () => {
    const selected = transferred();
    const snapshot = selected.stateSnapshot as Record<string, unknown>;
    const harness = createHarness({
      ...selected,
      stateSnapshot: {
        ...snapshot,
        matchCache: { ...snapshot.matchCache as object, authKey: `ap|${ACCOUNT_B}` },
      },
    });

    await expect(activateTransferredAccount({
      client: harness.client,
      handle: manifest.activeHandle,
      manifest,
      dependencies: harness.dependencies,
    })).rejects.toMatchObject({ code: "TRANSFERRED_SNAPSHOT_REJECTED" });
  });

  it("rolls back when authentication fails and no newer switch started", async () => {
    const harness = createHarness();
    jest.mocked(harness.dependencies.buildAuthenticatedUser)
      .mockRejectedValueOnce(new Error("upstream-secret"));

    await expect(activateTransferredAccount({
      client: harness.client,
      handle: manifest.activeHandle,
      manifest,
      dependencies: harness.dependencies,
    })).rejects.toBeInstanceOf(TransferredSessionError);
    expect(harness.state()).toMatchObject({
      user: { id: "previous" },
      matchCache: { owner: "previous" },
      wishlist: { skinIds: ["previous"] },
    });
  });

  it("does not roll an older failure over a newer account switch", async () => {
    const harness = createHarness();
    let rejectBuild!: (error: Error) => void;
    jest.mocked(harness.dependencies.buildAuthenticatedUser).mockImplementationOnce(
      () => new Promise((_, reject) => { rejectBuild = reject; }),
    );
    const activation = activateTransferredAccount({
      client: harness.client,
      handle: manifest.activeHandle,
      manifest,
      dependencies: harness.dependencies,
    });
    await Promise.resolve();
    harness.advanceGeneration();
    rejectBuild(new Error("older failure"));

    await expect(activation).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
});
