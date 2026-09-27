/* eslint-env jest, node */

const http = require("node:http");
const { createRiotPentestCompanion } = require("../scripts/lib/riot-pentest-companion.cjs");

const ORIGIN = "http://localhost:8081";
const NOW = 1_790_350_000_000;
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (sub) => `${encode({ alg: "RS256" })}.${encode({ sub, exp: Math.floor(NOW / 1000) + 3600 })}.sig`;

const makeEnvelope = () => ({
  schemaVersion: 2,
  capturedAt: NOW,
  source: { packageName: "com.android.vshop", appVersion: "4.1.10", versionCode: 91 },
  activeAccountId: ACCOUNT_ID,
  accounts: [{
    id: ACCOUNT_ID,
    name: "Agent",
    tagLine: "AP",
    region: "ap",
    lastUsedAt: NOW,
    accessToken: jwt(ACCOUNT_ID),
    idToken: jwt(ACCOUNT_ID),
    entitlementsToken: "entitlements-secret-canary",
    authCookies: [{
      name: "ssid",
      value: "cookie-secret-canary",
      domain: ".auth.riotgames.com",
      path: "/",
      secure: true,
      httpOnly: true,
    }],
  }],
  stateSnapshot: {
    activeUser: {
      id: ACCOUNT_ID,
      name: "Agent",
      TagLine: "AP",
      region: "ap",
      shops: { main: [], bundles: [], nightMarket: [], accessory: [] },
      balances: { vp: 1000, rad: 10, fag: 0, kc: 200 },
      progress: { level: 20, xp: 0 },
      ownedSkinIds: [],
    },
    matchCache: {
      authKey: `ap|${ACCOUNT_ID}`,
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
    wishlist: { skinIds: [], notificationEnabled: false },
    preferences: { screenshotModeEnabled: false },
  },
});

const rawRequest = (url, options = {}) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const request = http.request({
    hostname: target.hostname,
    port: target.port,
    path: target.pathname,
    method: options.method || "GET",
    headers: options.headers,
  }, (response) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(chunk));
    response.on("end", () => resolve({
      status: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    }));
  });
  request.on("error", reject);
  if (options.body !== undefined) request.write(options.body);
  request.end();
});

describe("mobile account vault companion", () => {
  let companion;
  let baseUrl;
  let now;
  let androidHandoff;
  let logger;

  const request = async (path, options = {}) => {
    const response = await rawRequest(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.phone
          ? { Host: "127.0.0.1:49331" }
          : { Origin: options.origin || ORIGIN }),
        ...(options.session ? {
          Authorization: `Bearer ${options.session.capability}`,
          "X-VShop-Client-Session": options.session.clientSessionId,
        } : {}),
        ...(options.vaultCapability ? {
          "X-VShop-Vault-Capability": options.vaultCapability,
        } : {}),
        ...(options.pairingCode ? { "X-VShop-Pairing-Code": options.pairingCode } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: response.body ? JSON.parse(response.body) : null,
    };
  };

  const openClient = async () => (await request("/v1/client-sessions", {
    method: "POST",
    body: {},
  })).body;

  const createVault = async (session) => {
    const created = await request("/v1/mobile-vaults", {
      method: "POST",
      session,
      body: {},
    });
    expect(created.status).toBe(201);
    return {
      ...created.body,
      pairingCode: androidHandoff.prepare.mock.calls.at(-1)[0].pairingCode,
    };
  };

  beforeEach(async () => {
    now = NOW;
    let randomSeed = 1;
    androidHandoff = {
      prepare: jest.fn(() => ({ serial: "device-1", model: "phone", devicePort: 49331 })),
      cleanup: jest.fn(),
    };
    logger = { info: jest.fn(), warn: jest.fn() };
    companion = createRiotPentestCompanion({
      androidHandoff,
      authBrowser: { open: jest.fn() },
      fetchImpl: jest.fn(),
      logger,
      now: () => now,
      randomBytes: jest.fn(() => Buffer.alloc(32, randomSeed++)),
    });
    await companion.listen({ host: "127.0.0.1", port: 0 });
    baseUrl = companion.getAddress().url;
  });

  afterEach(async () => {
    await companion.close();
  });

  it("creates an ADB handoff without exposing the pairing code", async () => {
    const session = await openClient();
    const created = await createVault(session);
    const { pairingCode, ...publicPayload } = created;

    expect(created).toMatchObject({ status: "waiting_for_phone" });
    expect(created.vaultId).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(publicPayload)).not.toContain(pairingCode);
    expect(androidHandoff.prepare).toHaveBeenCalledWith(expect.objectContaining({
      companionPort: companion.getAddress().port,
      handoffId: created.vaultId,
      pairingCode: created.pairingCode,
    }));
  });

  it("claims once, returns a secret-free manifest and activates one account", async () => {
    const session = await openClient();
    const created = await createVault(session);
    const claim = await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: created.pairingCode,
      body: makeEnvelope(),
    });
    expect(claim.status).toBe(204);
    expect(androidHandoff.cleanup).toHaveBeenCalledWith("device-1");

    const status = await request(`/v1/mobile-vaults/${created.vaultId}`, { session });
    expect(status.body).toEqual({ status: "ready" });

    const consumed = await request(`/v1/mobile-vaults/${created.vaultId}/consume`, {
      method: "POST",
      session,
      body: {},
    });
    expect(consumed.status).toBe(200);
    expect(consumed.body.vaultCapability).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(consumed.body.manifest)).not.toMatch(
      /11111111|cookie-secret|entitlements-secret|accessToken|idToken|authCookies/,
    );

    const selected = await request(
      `/v1/mobile-vault-sessions/${consumed.body.vaultSessionId}/accounts/${consumed.body.manifest.activeHandle}/activate`,
      {
        method: "POST",
        session,
        vaultCapability: consumed.body.vaultCapability,
        body: {},
      },
    );
    expect(selected).toMatchObject({
      status: 200,
      body: { accountId: ACCOUNT_ID, region: "ap" },
    });
    expect(selected.body.accessToken).toContain(".sig");
    expect(JSON.stringify(selected.body)).toContain("cookie-secret-canary");
  });

  it("rejects wrong pairing, replay and a second browser client", async () => {
    const owner = await openClient();
    const attacker = await openClient();
    const created = await createVault(owner);
    expect(await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: "f".repeat(64),
      body: makeEnvelope(),
    })).toMatchObject({ status: 403, body: { code: "MOBILE_VAULT_REJECTED" } });

    expect((await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: created.pairingCode,
      body: makeEnvelope(),
    })).status).toBe(204);
    expect(await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: created.pairingCode,
      body: makeEnvelope(),
    })).toMatchObject({ status: 410, body: { code: "MOBILE_HANDOFF_REPLAYED" } });
    expect(await request(`/v1/mobile-vaults/${created.vaultId}`, { session: attacker }))
      .toMatchObject({ status: 404, body: { code: "MOBILE_VAULT_REJECTED" } });
  });

  it("requires both client and vault capabilities for activation", async () => {
    const session = await openClient();
    const created = await createVault(session);
    await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: created.pairingCode,
      body: makeEnvelope(),
    });
    const consumed = await request(`/v1/mobile-vaults/${created.vaultId}/consume`, {
      method: "POST",
      session,
      body: {},
    });
    const path = `/v1/mobile-vault-sessions/${consumed.body.vaultSessionId}/accounts/${consumed.body.manifest.activeHandle}/activate`;

    expect(await request(path, {
      method: "POST",
      session,
      vaultCapability: "f".repeat(64),
      body: {},
    })).toMatchObject({ status: 403, body: { code: "MOBILE_VAULT_REJECTED" } });
  });

  it("expires pending handoffs and cleans the ADB reverse mapping", async () => {
    const session = await openClient();
    const created = await createVault(session);
    now = created.expiresAt + 1;

    expect(await request(`/v1/mobile-vaults/${created.vaultId}`, { session }))
      .toMatchObject({ status: 410, body: { code: "MOBILE_HANDOFF_EXPIRED" } });
    expect(androidHandoff.cleanup).toHaveBeenCalledWith("device-1");
  });

  it("never logs claim canaries", async () => {
    const session = await openClient();
    const created = await createVault(session);
    await request(`/v1/mobile-vaults/${created.vaultId}/claim`, {
      method: "POST",
      phone: true,
      pairingCode: created.pairingCode,
      body: makeEnvelope(),
    });

    expect(JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls]))
      .not.toMatch(/cookie-secret|entitlements-secret|11111111/);
  });
});
