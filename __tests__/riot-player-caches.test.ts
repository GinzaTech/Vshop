import * as match from "~/services/riot/match-api";
import * as progression from "~/services/riot/progression-api";
import { ownedItems, playerLoadout } from "~/services/riot/loadout-api";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockRequest = jest.fn();
const mockSetClientVersion = jest.fn((value: string) => value);
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/services/riot/request-context", () => ({
  extraHeaders: () => ({}),
  getPlayerResourceKey: (region: string, id: string) => `${region.toLowerCase()}|${id.toLowerCase()}`,
  API_DEBUG_LOGGING: false,
  logValorantApiDebug: jest.fn(), logValorantApiResponse: jest.fn(), maskSecretForLog: () => "***",
  getRiotClientVersionForRequests: () => "version",
  setRiotClientVersionOverride: (value: string) => mockSetClientVersion(value),
}));

type Response = { status: number; data: object };
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((finish) => { resolve = finish; });
  return { promise, resolve };
}
let id = 0;
beforeEach(() => {
  id += 1;
  mockRequest.mockReset();
  jest.useFakeTimers().setSystemTime(1_000_000 + id * 4_000_000);
});
afterEach(() => jest.useRealTimers());

const cases = [
  { name: "client config", call: (access: string, ent: string) => progression.getRiotClientConfig(access, ent), response: { "chat.affinities": { ap: "host" } } },
  { name: "MMR", call: (access: string, ent: string) => match.getCompetitiveMMR(access, ent, "ap", `player-${id}`), response: { Subject: "player", QueueSkills: {} } },
  { name: "names", call: (access: string, ent: string) => match.getPlayerNames(access, ent, [`player-${id}`], "ap"), response: [{ Subject: "player", GameName: "Fresh", TagLine: "AP" }] },
  { name: "loadout", call: (access: string, ent: string) => playerLoadout(access, ent, "ap", `player-${id}`), response: { Subject: "player", Version: 2, Guns: [], ActiveExpressions: [], Identity: {} } },
];

describe.each(cases)("$name request isolation", ({ call, response }) => {
  it.each(["access", "entitlements"])("does not join old %s credentials", async (changed) => {
    const old = deferred();
    mockRequest.mockImplementationOnce(() => old.promise).mockResolvedValue({ status: 200, data: response });
    const pending = call(`old-${id}`, `ent-${id}`);
    const outcome = pending.catch((error: unknown) => error);
    const fresh = call(changed === "access" ? `new-${id}` : `old-${id}`, changed === "entitlements" ? `new-ent-${id}` : `ent-${id}`);
    const callCount = mockRequest.mock.calls.length;
    old.resolve({ status: 200, data: response });
    await fresh;
    const result = await outcome;
    expect(callCount).toBe(2);
    expect(result).toMatchObject({ code: "SESSION_CHANGED" });
  });

  it("rejects old global generation even if credentials match", async () => {
    const old = deferred();
    mockRequest.mockImplementationOnce(() => old.promise);
    const pending = call(`token-${id}`, "ent");
    const rejected = expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    invalidateSessionOperations();
    old.resolve({ status: 200, data: response });
    await rejected;
  });
});

it("exports clear functions and invalidates outstanding player/config requests", async () => {
  expect(typeof match.clearRiotPlayerCaches).toBe("function");
  expect(typeof progression.clearRiotClientConfigCache).toBe("function");
  const old = deferred();
  mockRequest.mockImplementation(() => old.promise);
  const mmr = match.getCompetitiveMMR("token", "ent", "ap", `player-${id}`);
  const config = progression.getRiotClientConfig("token", "ent");
  const rejectedMmr = expect(mmr).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  const rejectedConfig = expect(config).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  match.clearRiotPlayerCaches();
  progression.clearRiotClientConfigCache();
  old.resolve({ status: 200, data: { Subject: "player" } });
  await Promise.all([rejectedMmr, rejectedConfig]);
});

it.each([401, 403, 500])("ownedItems HTTP %s rejects instead of pretending ownership is empty", async (status) => {
  mockRequest.mockResolvedValue({ status, data: {} });
  await expect(ownedItems("token", "ent", "ap", "player", "type")).rejects.toThrow();
});

it("MMR honors force separately from an older request and keeps the newer value", async () => {
  const old = deferred();
  mockRequest.mockImplementationOnce(() => old.promise);
  const pending = match.getCompetitiveMMR("token", "ent", "ap", `player-${id}`);
  const outcome = pending.catch((error: unknown) => error);
  mockRequest.mockResolvedValue({ status: 200, data: { Subject: "fresh" } });
  const fresh = match.getCompetitiveMMR("token", "ent", "ap", `player-${id}`, { force: true });
  const callCount = mockRequest.mock.calls.length;
  old.resolve({ status: 200, data: { Subject: "old" } });
  await fresh;
  const result = await outcome;
  expect(callCount).toBe(2);
  expect(result).toMatchObject({ code: "SESSION_CHANGED" });
  expect(await match.getCompetitiveMMR("token", "ent", "ap", `player-${id}`)).toEqual({ Subject: "fresh" });
});

it("MMR caches success by resource across renewal, expires, and bypasses data on force", async () => {
  mockRequest.mockResolvedValue({ status: 200, data: { Subject: "player" } });
  const fetch = (force = false, region = "ap") => match.getCompetitiveMMR("access", "ent", region, `ttl-${id}`, { force });
  await Promise.all([fetch(), fetch()]);
  await match.getCompetitiveMMR("renewed", "new-ent", "AP", `TTL-${id}`);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(5 * 60 * 1000);
  await fetch();
  await fetch(true);
  await fetch(false, "eu");
  expect(mockRequest).toHaveBeenCalledTimes(4);
});

it("client config caches only its credential identity, expires and retries failures", async () => {
  progression.clearRiotClientConfigCache();
  mockRequest.mockResolvedValue({ status: 200, data: { "chat.affinities": { ap: "host" } } });
  await Promise.all([progression.getRiotClientConfig("access", "ent"), progression.getRiotClientConfig("access", "ent")]);
  await progression.getRiotClientConfig("access", "ent");
  expect(mockRequest).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(5 * 60 * 1000);
  await progression.getRiotClientConfig("access", "ent");
  await progression.getRiotClientConfig("other", "ent");
  expect(mockRequest).toHaveBeenCalledTimes(3);
  mockRequest.mockResolvedValue({ status: 503, data: {} });
  expect(await progression.getRiotClientConfig("failing", "ent")).toBeNull();
  expect(await progression.getRiotClientConfig("failing", "ent")).toBeNull();
  expect(mockRequest).toHaveBeenCalledTimes(5);
});

it("names dedupe overlapping subjects, preserve input order, and expire by region", async () => {
  match.clearRiotPlayerCaches();
  const old = deferred();
  mockRequest.mockImplementationOnce(() => old.promise).mockResolvedValue({ status: 200, data: [{ Subject: "c", GameName: "C", TagLine: "AP" }] });
  const first = match.getPlayerNames("access", "ent", ["A", "b", "a", ""], "ap");
  const overlap = match.getPlayerNames("access", "ent", ["B", "c"], "AP");
  expect(mockRequest.mock.calls.map(([request]) => request.data)).toEqual([["a", "b"], ["c"]]);
  old.resolve({ status: 200, data: [
    { Subject: "b", GameName: "B", TagLine: "AP" },
    { Subject: "a", GameName: "A", TagLine: "AP" },
    { Subject: "unrequested", GameName: "No", TagLine: "AP" },
  ] });
  expect((await first).map((entry) => entry.Subject)).toEqual(["a", "b"]);
  expect((await overlap).map((entry) => entry.Subject)).toEqual(["b", "c"]);
  await match.getPlayerNames("renewed", "ent", ["b"], "ap");
  expect(mockRequest).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(60 * 60 * 1000);
  await match.getPlayerNames("renewed", "ent", ["b"], "ap");
  await match.getPlayerNames("renewed", "ent", ["b"], "eu");
  expect(mockRequest).toHaveBeenCalledTimes(4);
});

it("a cleared name request cannot repopulate data or remove newer pending work", async () => {
  match.clearRiotPlayerCaches();
  const old = deferred();
  const current = deferred();
  mockRequest.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
  const stale = match.getPlayerNames("access", "ent", ["a"], "ap").catch((error: unknown) => error);
  match.clearRiotPlayerCaches();
  const fresh = match.getPlayerNames("access", "ent", ["a"], "ap");
  old.resolve({ status: 200, data: [{ Subject: "a", GameName: "Old", TagLine: "AP" }] });
  expect(await stale).toMatchObject({ code: "SESSION_CHANGED" });
  const joined = match.getPlayerNames("access", "ent", ["a"], "ap");
  expect(mockRequest).toHaveBeenCalledTimes(2);
  current.resolve({ status: 200, data: [{ Subject: "a", GameName: "New", TagLine: "AP" }] });
  expect(await joined).toEqual(await fresh);
  expect((await joined)[0].GameName).toBe("New");
});

it("names retry failed responses instead of caching missing data", async () => {
  match.clearRiotPlayerCaches();
  mockRequest.mockResolvedValueOnce({ status: 403, data: {} })
    .mockResolvedValueOnce({ status: 200, data: [{ Subject: "a", GameName: "A", TagLine: "AP" }] });
  await expect(match.getPlayerNames("access", "ent", ["a"], "ap")).rejects.toThrow();
  expect((await match.getPlayerNames("access", "ent", ["a"], "ap"))[0].GameName).toBe("A");
});

it("ownedItems accepts a successful empty list and invalidates an old pending response", async () => {
  mockRequest.mockResolvedValueOnce({ status: 200, data: { Entitlements: [] } });
  expect(await ownedItems("access", "ent", "ap", "a", "type")).toEqual({ Entitlements: [] });
  const old = deferred();
  mockRequest.mockImplementationOnce(() => old.promise);
  const stale = ownedItems("access", "ent", "ap", "a", "type");
  const rejected = expect(stale).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  match.clearRiotPlayerCaches();
  old.resolve({ status: 200, data: { Entitlements: [] } });
  await rejected;
});

it("an obsolete MMR retry cannot overwrite the global client version", async () => {
  const session = deferred();
  const sessionStarted = deferred();
  mockRequest.mockResolvedValueOnce({ status: 400, data: {} }).mockImplementationOnce(() => {
    sessionStarted.resolve({ status: 200, data: {} });
    return session.promise;
  });
  const stale = match.getCompetitiveMMR("old", "ent", "ap", `retry-${id}`).catch((error: unknown) => error);
  await sessionStarted.promise;
  mockRequest.mockResolvedValueOnce({ status: 200, data: { Subject: "fresh" } });
  await match.getCompetitiveMMR("renewed", "ent", "ap", `retry-${id}`);
  session.resolve({ status: 200, data: { clientVersion: "obsolete-version" } });
  expect(await stale).toMatchObject({ code: "SESSION_CHANGED" });
  expect(mockSetClientVersion).not.toHaveBeenCalled();
});
