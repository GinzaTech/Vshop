/* eslint-env jest, node */

const {
  createVaultManifest,
  projectAccountSession,
  validateMobileVaultEnvelope,
} = require("../scripts/lib/mobile-account-vault.cjs");

const NOW = 1_790_350_000_000;
const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (sub, exp = Math.floor(NOW / 1000) + 3600) =>
  `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ sub, exp })}.signature`;

const cookie = (suffix = "a") => ({
  name: `ssid-${suffix}`,
  value: `cookie-canary-${suffix}`,
  domain: ".auth.riotgames.com",
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "none",
});

const account = (id, suffix = "a") => ({
  id,
  name: `Agent ${suffix.toUpperCase()}`,
  tagLine: suffix.toUpperCase(),
  region: "ap",
  lastUsedAt: NOW - 1000,
  accessToken: jwt(id),
  idToken: jwt(id, Math.floor(NOW / 1000) + 7200),
  entitlementsToken: `entitlements-canary-${suffix}`,
  authCookies: [cookie(suffix)],
});

const envelope = (accounts = [account(ACCOUNT_A)]) => ({
  schemaVersion: 2,
  capturedAt: NOW,
  source: {
    packageName: "com.android.vshop",
    appVersion: "4.1.10",
    versionCode: 91,
  },
  activeAccountId: accounts[0].id,
  accounts,
  stateSnapshot: {
    activeUser: {
      id: accounts[0].id,
      name: accounts[0].name,
      TagLine: accounts[0].tagLine,
      region: accounts[0].region,
      shops: { main: [], bundles: [], nightMarket: [], accessory: [] },
      balances: { vp: 1000, rad: 20, fag: 0, kc: 500 },
      progress: { level: 42, xp: 10 },
      ownedSkinIds: ["skin-a"],
    },
    matchCache: {
      authKey: `ap|${accounts[0].id}`,
      matches: [],
      lastUpdated: NOW,
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
    wishlist: { skinIds: ["skin-a", "skin-b"], notificationEnabled: true },
    preferences: { screenshotModeEnabled: false },
  },
});

const captureError = (run) => {
  try {
    run();
    throw new Error("EXPECTED_VAULT_ERROR");
  } catch (error) {
    return error;
  }
};

describe("mobile account vault schema", () => {
  it.each([1, 6])("accepts %s account records", (count) => {
    const accounts = Array.from({ length: count }, (_, index) => {
      const suffix = String(index + 1);
      const id = `${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`;
      return account(id, suffix);
    });

    expect(validateMobileVaultEnvelope(envelope(accounts), { now: () => NOW }).accounts)
      .toHaveLength(count);
  });

  it("deep-copies and freezes accepted data", () => {
    const input = envelope();
    const validated = validateMobileVaultEnvelope(input, { now: () => NOW });
    input.accounts[0].name = "Mutated";
    input.stateSnapshot.wishlist.skinIds.push("mutated");

    expect(validated.accounts[0].name).toBe("Agent A");
    expect(validated.stateSnapshot.wishlist.skinIds).toEqual(["skin-a", "skin-b"]);
    expect(Object.isFrozen(validated.accounts[0])).toBe(true);
    expect(Object.isFrozen(validated.stateSnapshot)).toBe(true);
  });

  it.each([
    ["too many accounts", () => envelope(Array.from({ length: 7 }, (_, index) => account(`${index}`.repeat(36).slice(0, 36), String(index))))],
    ["duplicate normalized account", () => envelope([account(ACCOUNT_A), account(ACCOUNT_A.toUpperCase(), "b")])],
    ["active account missing", () => ({ ...envelope(), activeAccountId: ACCOUNT_B })],
    ["access token subject mismatch", () => {
      const value = envelope();
      value.accounts[0].accessToken = jwt(ACCOUNT_B);
      return value;
    }],
    ["id token subject mismatch", () => {
      const value = envelope();
      value.accounts[0].idToken = jwt(ACCOUNT_B);
      return value;
    }],
    ["invalid region", () => {
      const value = envelope();
      value.accounts[0].region = "../../ap";
      return value;
    }],
    ["non-Riot cookie domain", () => {
      const value = envelope();
      value.accounts[0].authCookies[0].domain = "attacker.test";
      return value;
    }],
    ["too many cookies", () => {
      const value = envelope();
      value.accounts[0].authCookies = Array.from({ length: 129 }, (_, index) => cookie(String(index)));
      return value;
    }],
    ["mismatched match auth key", () => {
      const value = envelope();
      value.stateSnapshot.matchCache.authKey = `ap|${ACCOUNT_B}`;
      return value;
    }],
    ["unknown top-level key", () => ({ ...envelope(), extra: true })],
  ])("rejects %s without echoing secrets", (_label, makeValue) => {
    const error = captureError(() =>
      validateMobileVaultEnvelope(makeValue(), { now: () => NOW }),
    );

    expect(error).toMatchObject({ name: "MobileVaultError" });
    expect(String(error.message)).not.toMatch(/cookie-canary|entitlements-canary|signature/);
  });

  it("rejects dangerous object keys recursively", () => {
    const input = envelope();
    input.stateSnapshot.activeUser.shops = JSON.parse('{"__proto__":{"polluted":true}}');

    expect(captureError(() => validateMobileVaultEnvelope(input, { now: () => NOW })))
      .toMatchObject({ code: "VAULT_SCHEMA_REJECTED" });
  });

  it("rejects oversized serialized payloads before validation", () => {
    const input = envelope();
    input.stateSnapshot.activeUser.padding = "x".repeat(8 * 1024 * 1024);

    expect(captureError(() => validateMobileVaultEnvelope(input, { now: () => NOW })))
      .toMatchObject({ code: "VAULT_TOO_LARGE" });
  });

  it("classifies expired tokens without rejecting the saved account", () => {
    const input = envelope();
    input.accounts[0].accessToken = jwt(ACCOUNT_A, Math.floor(NOW / 1000) - 1);

    expect(validateMobileVaultEnvelope(input, { now: () => NOW }).accounts[0].tokenStatus)
      .toBe("needs_reauth");
  });
});

describe("mobile vault projections", () => {
  it("returns a secret-free manifest with opaque handles", () => {
    const validated = validateMobileVaultEnvelope(
      envelope([account(ACCOUNT_A), account(ACCOUNT_B, "b")]),
      { now: () => NOW },
    );
    const handles = new Map([
      [ACCOUNT_A, "handle-a"],
      [ACCOUNT_B, "handle-b"],
    ]);

    const manifest = createVaultManifest(validated, handles);
    const serialized = JSON.stringify(manifest);
    expect(manifest).toMatchObject({ activeHandle: "handle-a" });
    expect(manifest.accounts).toHaveLength(2);
    expect(serialized).not.toMatch(/11111111|22222222|accessToken|idToken|authCookies|cookie-canary|entitlements-canary/);
  });

  it("projects only the selected account session", () => {
    const validated = validateMobileVaultEnvelope(
      envelope([account(ACCOUNT_A), account(ACCOUNT_B, "b")]),
      { now: () => NOW },
    );
    const handles = new Map([
      [ACCOUNT_A, "handle-a"],
      [ACCOUNT_B, "handle-b"],
    ]);

    const selected = projectAccountSession(validated, "handle-b", handles);
    expect(selected.accountId).toBe(ACCOUNT_B);
    expect(selected.accessToken).toContain("signature");
    expect(JSON.stringify(selected)).not.toContain("cookie-canary-a");
  });

  it("rejects unknown opaque handles", () => {
    const validated = validateMobileVaultEnvelope(envelope(), { now: () => NOW });
    const handles = new Map([[ACCOUNT_A, "handle-a"]]);

    expect(captureError(() => projectAccountSession(validated, "unknown", handles)))
      .toMatchObject({ code: "VAULT_ACCOUNT_REJECTED" });
  });
});
