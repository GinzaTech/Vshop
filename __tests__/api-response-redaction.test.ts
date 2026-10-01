import { sanitizeApiResponseBody, sanitizeApiResponseUrl, RESPONSE_BODY_LIMITS } from "~/utils/api-response-redaction";

const url = "https://pd.ap.a.pvp.net/store/v1/entitlements/player/items";
const catalogUrl = "https://valorant-api.com/v1/weapons";
describe("API response body privacy", () => {
  it("does not retain opaque credentials as ordinary response keys or generic codes", () => {
    const opaque = "OpaqueAlphabeticCanaryValue";
    for (const endpoint of [url, "https://valorant-api.com/v1/weapons"]) {
      const result = sanitizeApiResponseBody({ [opaque]: 1, Code: opaque, Type: opaque }, endpoint);
      expect(JSON.stringify(result)).not.toContain(opaque);
    }
  });

  it.each(["InviteCode", "PrivateKey", "SigningKey", "RoomCode"])("redacts numeric capability/signing field %s", (key) => {
    expect(JSON.stringify(sanitizeApiResponseBody({ [key]: 781234567 }, url))).not.toContain("781234567");
  });

  it("keeps public catalog names but not player-context display text", () => {
    const name = "PrivatePlayerCanary";
    expect(JSON.stringify(sanitizeApiResponseBody({ Players: [{ displayName: name }] }, url))).not.toContain(name);
    expect(sanitizeApiResponseBody({ displayName: "Phantom", description: "Public artwork" }, "https://valorant-api.com/v1/weapons").body)
      .toEqual({ displayName: "Phantom", description: "Public artwork" });
  });

  it.each(["displayName", "Type", "errorCode", "displayIcon"])("rejects non-text payloads hidden in %s", (key) => {
    for (const value of [781234567, { count: 781234567 }, [781234567]]) {
      expect(JSON.stringify(sanitizeApiResponseBody({ [key]: value }, catalogUrl))).not.toContain("781234567");
    }
    expect(sanitizeApiResponseBody({ Version: 8 }, url).body).toEqual({ Version: 8 });
  });

  it.each([
    ["locale", "vi_VN"], ["language", "en-US"], ["version", "1.20.0"],
    ["clientVersion", "release-10.11-shipping-20-123456"], ["errorCode", "BAD_REQUEST"],
  ])("preserves a validated %s enum and rejects opaque replacement text", (key, valid) => {
    expect(sanitizeApiResponseBody({ [key]: valid }, url).body).toEqual({ [key]: valid });
    expect(JSON.stringify(sanitizeApiResponseBody({ [key]: "OpaqueEnumCanary" }, url))).not.toContain("OpaqueEnumCanary");
  });

  it.each(["%6aoinbycode", "jo%69nbycode", "%6dembers"])("masks private values behind encoded parent %s", (parent) => {
    const result = sanitizeApiResponseUrl(`https://glz-ap-1.ap.a.pvp.net/parties/v1/${parent}/OpaquePathCanary`);
    expect(result).not.toContain("OpaquePathCanary");
  });

  it("masks encoded invite name/tag parents without decoding encoded slashes into new segments", () => {
    const result = sanitizeApiResponseUrl("https://glz-ap-1.ap.a.pvp.net/parties/v1/%69nvites/%6eame/PrivateName%2FPrivateSuffix/%74ag/PrivateTag");
    expect(result).not.toMatch(/PrivateName|PrivateTag|PrivateSuffix/);
  });

  it("omits live connection credentials even when a credential is numeric", () => {
    const endpoint = "https://glz-ap-1.ap.a.pvp.net/core-game/v1/matches/private";
    const result = sanitizeApiResponseBody({ ConnectionDetails: { GameClientHash: 8800113399, PlayerKey: "connection-secret" }, GameClientHash: 8800113399 }, endpoint);
    expect(JSON.stringify(result)).not.toMatch(/8800113399|connection-secret/);
  });

  it("hides UUID keys in player/session maps while retaining currency joins", () => {
    const player = "9a9a9a9a-1111-2222-3333-444444444444";
    const currency = "85ad13f7-3d1b-5128-9eb2-7cd8a9f6135a";
    for (const body of [{ Players: { [player]: { accountLevel: 10 } } }, { presences: { [player]: { count: 1 } } }, { [player]: { session: "private" } }]) {
      expect(JSON.stringify(sanitizeApiResponseBody(body, "https://pd.ap.a.pvp.net/mmr/v1/players/private"))).not.toContain(player);
    }
    expect(sanitizeApiResponseBody({ Balances: { [currency]: 1104 } }, "https://pd.ap.a.pvp.net/store/v1/wallet/private").body)
      .toEqual({ Balances: { [currency]: 1104 } });
  });

  it("does not retain unrecognized numeric or text game state values", () => {
    const endpoint = "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/private";
    for (const key of ["State", "PreviousState", "PregameState"]) {
      for (const value of ["opaque-state-secret", 8800113399]) {
        expect(JSON.stringify(sanitizeApiResponseBody({ [key]: value }, endpoint))).not.toMatch(/opaque-state-secret|8800113399/);
      }
    }
  });

  it("preserves inventory IDs, UUID dictionary keys, long arrays and ordinary depth", () => {
    const uuid = "12345678-1234-1234-1234-123456789abc";
    let nested: unknown = { count: 7 };
    for (let index = 0; index < 7; index++) nested = { nested };
    const data = { uuid, ItemID: uuid, SkinID: uuid, Balances: { [uuid]: 50 }, items: Array.from({ length: 75 }, (_, i) => ({ count: i })), nested };
    expect(sanitizeApiResponseBody(data, url)).toMatchObject({ body: data, truncated: false, omissions: [] });
  });

  it("redacts nested named credentials, personal identifiers and unknown text", () => {
    const data = { access_token: "opaque-a", nested: [{ Cookie: "opaque-b", Authorization: "Bearer opaque-c", Subject: "private-a", PUUID: "private-b", UserID: "private-c", sessionId: "private-d", password: 123456, apiKey: "opaque-d" }], message: "opaque-unlabelled", stored: '{"token":"opaque-e"}', value: "eyJabc.def.ghi", count: 42 };
    const result = sanitizeApiResponseBody(data, url);
    expect(JSON.stringify(result.body)).not.toMatch(/opaque-|private-|eyJabc/);
    expect(result.body).toMatchObject({ count: 42 });
    expect(result.omissions).toContain("credential-field");
    expect(result.omissions).toContain("private-field");
    expect(result.omissions).toContain("unapproved-text");
  });

  it.each([
    "https://auth.riotgames.com/api/v1/authorization",
    "https://entitlements.auth.riotgames.com/api/token/v1",
    "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat",
    "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/private/muctoken",
  ])("keeps only a schema overview for token endpoint %s", (endpoint) => {
    const result = sanitizeApiResponseBody({ token: "opaque-secret", nested: { count: 3 } }, endpoint);
    expect(result.body).toBeNull();
    expect(result.schema).toMatchObject({ token: "string", nested: { count: "number" } });
    expect(result.omissions).toContain("credential-endpoint");
    expect(JSON.stringify(result)).not.toContain("opaque-secret");
    expect(sanitizeApiResponseBody("opaque-root", endpoint).schema).toBe("string");
  });

  it("never invokes accessors and fails closed for circular or poisoned values", () => {
    const getter = jest.fn(() => "getter-secret");
    const data: Record<string, unknown> = { count: 1 };
    Object.defineProperty(data, "lazy", { get: getter, enumerable: true });
    data.self = data;
    const result = sanitizeApiResponseBody(data, url);
    expect(getter).not.toHaveBeenCalled();
    expect(result.omissions).toEqual(expect.arrayContaining(["accessor", "circular"]));
    const proxy = new Proxy({}, { ownKeys() { throw new Error("poison-secret"); } });
    expect(sanitizeApiResponseBody(proxy, url)).toMatchObject({ body: null, omissions: ["invalid-body"] });
    const array: unknown[] = [];
    Object.defineProperty(array, "0", { get: getter });
    sanitizeApiResponseBody(array, url);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(["text/html", "application/octet-stream"])("omits non-JSON content %s", (contentType) => {
    expect(sanitizeApiResponseBody("private-body", url, contentType)).toMatchObject({ body: null, omissions: ["non-json-body"] });
  });

  it.each([
    { count: 3, token: "opaque-mime-secret", items: [{ count: 7 }] },
    [{ count: 3, Subject: "private-mime-subject" }, { count: 7 }],
  ])("sanitizes already parsed JSON with text/plain MIME: %#", (data) => {
    const expected = sanitizeApiResponseBody(data, url, "application/json");
    const result = sanitizeApiResponseBody(data, url, "text/plain; charset=utf-8");
    expect(result).toEqual(expected);
    expect(result.omissions).not.toContain("non-json-body");
    expect(JSON.stringify(result)).not.toMatch(/opaque-mime-secret|private-mime-subject/);
  });

  it.each(["<html>private-html</html>", "binary-private-string", '{"count":3,"token":"private-json-string"}'])("does not parse or retain text/plain raw strings: %#", (data) => {
    expect(sanitizeApiResponseBody(data, url, "text/plain")).toEqual({ body: null, truncated: false, omissions: ["non-json-body"] });
  });

  it("keeps text/plain credential responses schema-only including a root PAS string", () => {
    const endpoint = "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat";
    expect(sanitizeApiResponseBody("opaque-pas-secret", endpoint, "text/plain")).toEqual({ body: null, schema: "string", truncated: false, omissions: ["credential-endpoint"] });
    const result = sanitizeApiResponseBody({ token: "opaque-mime-token", count: 1 }, "https://entitlements.auth.riotgames.com/api/token/v1", "text/plain");
    expect(result).toMatchObject({ body: null, schema: { token: "string", count: "number" }, omissions: ["credential-endpoint"] });
    expect(JSON.stringify(result)).not.toContain("opaque-mime-token");
  });

  it("applies the existing traversal guards to text/plain structured values", () => {
    const getter = jest.fn(() => "getter-mime-secret");
    const source: Record<string, unknown> = { count: 3 };
    Object.defineProperty(source, "lazy", { get: getter, enumerable: true });
    source.self = source;
    expect(sanitizeApiResponseBody(source, url, "text/plain").omissions).toEqual(expect.arrayContaining(["accessor", "circular"]));
    expect(getter).not.toHaveBeenCalled();
    for (const value of [new Uint8Array([1, 2]), new Date()]) {
      expect(sanitizeApiResponseBody(value, url, "text/plain").omissions).toContain("non-json-body");
    }
    let deep: unknown = { count: 1 };
    for (let i = 0; i < RESPONSE_BODY_LIMITS.maxDepth + 1; i++) deep = { nested: deep };
    expect(sanitizeApiResponseBody(deep, url, "text/plain")).toMatchObject({ truncated: true, omissions: ["depth-limit"] });
  });

  it("rejects binary, malformed JSON, exotic objects and detached mutable inputs", () => {
    for (const data of [new Uint8Array([1, 2]), new Date(), "{broken"]) {
      expect(sanitizeApiResponseBody(data, url).omissions.length).toBeGreaterThan(0);
    }
    const source = { items: [{ count: 1 }] };
    const result = sanitizeApiResponseBody(source, url);
    source.items[0].count = 9;
    expect(result.body).toEqual({ items: [{ count: 1 }] });
    expect(sanitizeApiResponseBody('{"count":2,"token":"secret"}', url).body).toEqual({ count: 2, token: "[REDACTED]" });
  });

  it("marks depth, node and byte truncation explicitly", () => {
    let deep: unknown = 3;
    for (let i = 0; i < RESPONSE_BODY_LIMITS.maxDepth + 3; i++) deep = { nested: deep };
    expect(sanitizeApiResponseBody(deep, url)).toMatchObject({ truncated: true, omissions: expect.arrayContaining(["depth-limit"]) });
    expect(sanitizeApiResponseBody(Array.from({ length: RESPONSE_BODY_LIMITS.maxNodes + 2 }, () => 1), url)).toMatchObject({ truncated: true, omissions: expect.arrayContaining(["node-limit"]) });
    const large = Array.from({ length: 500 }, () => ({ displayName: "界😀".repeat(1000) }));
    const result = sanitizeApiResponseBody(large, catalogUrl);
    expect(result.truncated).toBe(true);
    expect(result.omissions).toContain("byte-limit");
    expect(Buffer.byteLength(JSON.stringify(result.body))).toBeLessThanOrEqual(RESPONSE_BODY_LIMITS.maxBytes);
  });

  it("sanitizes URL credentials, queries, fragments and private path values", () => {
    expect(sanitizeApiResponseUrl("https://user:pass@pd.ap.a.pvp.net/store/v1/wallet/private?token=secret#auth=secret")).toBe("https://pd.ap.a.pvp.net/store/v1/wallet/[REDACTED]");
    expect(sanitizeApiResponseUrl("https://glz-ap-1.ap.a.pvp.net/parties/v1/players/joinbycode/private-code")).not.toContain("private-code");
    expect(sanitizeApiResponseUrl("not-a-url-secret")).toBe("[REDACTED]");
    const invite = "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/private-party/invites/name/canaryRiotID%2Fname/tag/canaryTagLine?token=secret";
    const safeInvite = sanitizeApiResponseUrl(invite);
    expect(safeInvite).not.toMatch(/canaryRiotID|canaryTagLine|private-party|secret/);
    expect(safeInvite).toContain("/invites/name/[REDACTED]/tag/[REDACTED]");
  });

  it("removes cookie-record values and numeric credentials in tuples", () => {
    const result = sanitizeApiResponseBody({ record: { name: "ssid", value: 123456 }, headersList: [["password", 987654]] }, url);
    expect(JSON.stringify(result.body)).not.toMatch(/123456|987654|123456789abc/);
  });

  it("preserves UUID lists under asset fields and public artwork URLs", () => {
    const uuid = "12345678-1234-1234-1234-123456789abc";
    const result = sanitizeApiResponseBody({ ItemIDs: [uuid], displayIcon: `https://user:pass@media.valorant-api.com/weapons/${uuid}/icon.png?token=secret#secret`, description: "Useful inventory artwork", displayName: "Phantom", category: "Rifle" }, catalogUrl);
    expect(result.body).toMatchObject({ ItemIDs: [uuid], displayName: "Phantom", category: "Rifle", displayIcon: `https://media.valorant-api.com/weapons/${uuid}/icon.png` });
    expect(JSON.stringify(result.body)).not.toMatch(/pass|secret/);
  });

  it("rejects hostile object prototypes, unsafe keys and oversized root JSON", () => {
    const data = JSON.parse('{"__proto__":{"token":"secret"},"bad<>key":"secret","count":4}');
    expect(sanitizeApiResponseBody(data, url)).toMatchObject({ body: { count: 4 }, omissions: ["unsafe-key"] });
    expect(sanitizeApiResponseBody("{" + "x".repeat(RESPONSE_BODY_LIMITS.maxBytes), url)).toMatchObject({ body: null, truncated: true, omissions: ["byte-limit"] });
    expect(sanitizeApiResponseBody({ nested: undefined, value: () => "secret", count: Infinity, success: true, data: null }, url).body).toMatchObject({ count: null, success: true, data: null });
  });

  it("preserves validated timestamps and canonical Unreal asset references", () => {
    const data = { StartTime: "2026-09-30T02:30:00.123Z", ExpirationDate: "2026-10-01T09:30:00+07:00", MapID: "/Game/Maps/Ascent/Ascent", ModeID: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C", AssetPath: "/Game/Weapons/Phantom/Phantom", rarity: "Legendary", message: "opaque-secret" };
    expect(sanitizeApiResponseBody(data, url).body).toEqual({ ...data, message: "[REDACTED]" });
    const invalid = { StartTime: "date-secret", MapID: "/Game/Maps/Ascent?token=secret", ModeID: "/Game/../secret", AssetPath: "/Game/Maps/map#secret" };
    expect(JSON.stringify(sanitizeApiResponseBody(invalid, url).body)).not.toContain("secret");
  });

  it("retains a catalog above the old 240 KiB limit", () => {
    const data = Array.from({ length: 150 }, () => ({ displayName: "Asset".repeat(500) }));
    const result = sanitizeApiResponseBody(data, catalogUrl);
    expect(result.truncated).toBe(false);
    expect(JSON.stringify(result.body) === JSON.stringify(data)).toBe(true);
  });

  it("does not preserve credentials in asset paths or invalid endpoint URLs", () => {
    const uuid = "12345678-1234-1234-1234-123456789abc";
    for (const displayIcon of [`https://media.valorant-api.com/weapons/${uuid}/eyJabc.def.ghi`, "https://other.test/private-icon", "/bad-path"]) {
      expect(JSON.stringify(sanitizeApiResponseBody({ displayIcon }, url).body)).not.toMatch(/eyJabc|private-icon|bad-path/);
    }
    for (const endpoint of ["invalid-private-url", "x".repeat(8001)]) {
      expect(sanitizeApiResponseBody({ token: "opaque-secret", count: 1 }, endpoint)).toMatchObject({ body: null, schema: { token: "string", count: "number" } });
    }
    expect(sanitizeApiResponseBody([null, 1, false], "https://example.test/token").schema).toEqual(["null", "number", "boolean"]);
  });

  it.each(["parties", "pregame", "core-game"])("preserves known game State values only in %s response context", (group) => {
    const endpoint = `https://glz-ap-1.ap.a.pvp.net/${group}/v1/parties/private`;
    const data = { State: "MATCHMAKING_REQUESTED", Members: [{ Pings: [{ Ping: 32, GamePodID: "aresriot.aws-ap-southeast-1-prod.ap-gp-singapore-1" }] }], QueueID: "unrated", Privacy: "OPEN", Accessibility: "CLOSED", ModeID: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C" };
    expect(sanitizeApiResponseBody(data, endpoint).body).toEqual(data);
    expect(sanitizeApiResponseBody({ State: "opaque-state-secret" }, endpoint).body).toEqual({ State: "[REDACTED]" });
    expect(sanitizeApiResponseBody({ State: "MATCHMAKING_REQUESTED" }, url).body).toEqual({ State: "[REDACTED]" });
    expect(sanitizeApiResponseBody({ State: "MATCHMAKING_REQUESTED" }, "https://other.test/parties/state").body).toEqual({ State: "[REDACTED]" });
    for (const State of ["DEFAULT", "MATCHMAKING", "CUSTOM_GAME_SETUP"]) expect(sanitizeApiResponseBody({ State }, endpoint).body).toEqual({ State });
    expect(sanitizeApiResponseBody({ State: "MATCHMAKING_REQUESTED" }, "https://auth.riotgames.com/parties/state")).toMatchObject({ body: null, schema: { State: "string" } });
  });

  it("does not retain opaque credentials used as token-response schema keys", () => {
    const result = sanitizeApiResponseBody({ OpaqueCredentialUsedAsKey: 1, token: "secret" }, "https://auth.riotgames.com/api/v1/authorization");
    expect(result.schema).toEqual({ token: "string" });
    expect(result.omissions).toContain("unapproved-schema-field");
    expect(JSON.stringify(result)).not.toContain("OpaqueCredentialUsedAsKey");
  });
});
