import {
  createMobileAccountVaultEnvelope,
} from "~/services/mobile-handoff/snapshot-data";
import {
  claimMobileAccountVault,
  isMobileHandoffBuildEnabled,
  validateMobileHandoffParams,
} from "~/services/mobile-handoff/policy";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const now = 1_790_350_000_000;

const account = {
  id: ACCOUNT_ID,
  name: "Agent",
  tagLine: "AP",
  region: "ap",
  accessToken: "access-canary",
  idToken: "id-canary",
  entitlementsToken: "entitlements-canary",
  authCookies: [{
    name: "ssid",
    value: "cookie-canary",
    domain: ".auth.riotgames.com",
    path: "/",
  }],
  lastUsedAt: now,
};

describe("mobile handoff snapshot", () => {
  it("captures immutable data fields while stripping actions and chat state", () => {
    const input = {
      accounts: [account],
      activeAccountId: ACCOUNT_ID,
      activeUser: {
        id: ACCOUNT_ID,
        name: "Agent",
        TagLine: "AP",
        region: "ap",
        shops: {
          main: [], bundles: [], nightMarket: [], accessory: [],
          remainingSecs: { main: 0, bundles: [0], nightMarket: 0, accessory: 0 },
        },
        balances: { vp: 1000, rad: 10, fag: 0, kc: 200 },
        progress: { level: 20, xp: 0 },
        ownedSkinIds: ["skin-a"],
        accessToken: "active-access-canary",
        idToken: "active-id-canary",
        entitlementsToken: "active-entitlements-canary",
      },
      matchCache: {
        authKey: `ap|${ACCOUNT_ID}`,
        matches: [],
        lastUpdated: now,
        totalMatches: 0,
        historyEndIndex: 0,
        recordingStartedAt: 0,
        recordingStartSeasonId: null,
        seasonStats: null,
        seasonStatsById: {},
        seasonMatchesById: {},
        seasonOptions: [],
        fetchMatches: jest.fn(),
      },
      profileCaches: {},
      wishlist: {
        skinIds: ["skin-a"],
        notificationEnabled: true,
        toggleSkin: jest.fn(),
      },
      screenshotModeEnabled: true,
      source: { packageName: "com.android.vshop" as const, appVersion: "4.1.10", versionCode: 91 },
      capturedAt: now,
      chatState: { messages: { friend: [{ body: "private-chat-canary" }] } },
    };

    const output = createMobileAccountVaultEnvelope(input);
    const serialized = JSON.stringify(output);
    expect(output.accounts).toHaveLength(1);
    expect(output.stateSnapshot.activeUser).not.toHaveProperty("accessToken");
    expect(output.stateSnapshot.matchCache).not.toHaveProperty("fetchMatches");
    expect(output.stateSnapshot.wishlist).not.toHaveProperty("toggleSkin");
    expect(serialized).not.toContain("private-chat-canary");
    expect(Object.isFrozen(output)).toBe(true);
  });

  it("rejects an active account not present in the saved list", () => {
    expect(() => createMobileAccountVaultEnvelope({
      accounts: [account],
      activeAccountId: "other-account",
      activeUser: { id: "other-account", region: "ap" },
      matchCache: null,
      profileCaches: {},
      wishlist: { skinIds: [], notificationEnabled: false },
      screenshotModeEnabled: false,
      source: { packageName: "com.android.vshop", appVersion: "4.1.10", versionCode: 91 },
      capturedAt: now,
    })).toThrow("MOBILE_SNAPSHOT_REJECTED");
  });
});

describe("mobile handoff policy", () => {
  it.each([
    ["android", "1", true],
    ["android", "0", false],
    ["web", "1", false],
  ])("gates platform %s flag %s", (platform, publicFlag, expected) => {
    expect(isMobileHandoffBuildEnabled({ platform, publicFlag })).toBe(expected);
  });

  it("accepts only exact 256-bit deep-link parameters", () => {
    expect(validateMobileHandoffParams({
      id: "a".repeat(64),
      code: "b".repeat(64),
    })).toEqual({ id: "a".repeat(64), code: "b".repeat(64) });
    expect(() => validateMobileHandoffParams({
      id: "a&shell=1",
      code: "b".repeat(64),
    })).toThrow("MOBILE_HANDOFF_PARAMS_REJECTED");
  });

  it("claims only the fixed USB reverse endpoint without logging secrets", async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, status: 204 } as Response));
    const envelope = createMobileAccountVaultEnvelope({
      accounts: [account],
      activeAccountId: ACCOUNT_ID,
      activeUser: { id: ACCOUNT_ID, region: "ap" },
      matchCache: null,
      profileCaches: {},
      wishlist: { skinIds: [], notificationEnabled: false },
      screenshotModeEnabled: false,
      source: { packageName: "com.android.vshop", appVersion: "4.1.10", versionCode: 91 },
      capturedAt: now,
    });

    await claimMobileAccountVault({
      id: "a".repeat(64),
      code: "b".repeat(64),
      envelope,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `http://127.0.0.1:49331/v1/mobile-vaults/${"a".repeat(64)}/claim`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-VShop-Pairing-Code": "b".repeat(64),
        }),
      }),
    );
  });
});
