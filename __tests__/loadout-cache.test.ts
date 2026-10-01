import { playerLoadout, updatePlayerLoadoutV3, updatePlayerLoadout, updatePlayerLoadoutV3First, clearRiotLoadoutCache, ownedItems, extractOwnedItemIds } from "~/services/riot/loadout-api";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { confirmProfileLoadout } from "~/features/profile/confirm-loadout";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockRequest = jest.fn();
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/services/riot/request-context", () => ({
  extraHeaders: () => ({}),
  getPlayerResourceKey: (region: string, id: string) => `${region}|${id}`,
  API_DEBUG_LOGGING: false,
}));

const makeLoadout = (id: string, version: number): PlayerLoadoutResponse => ({
  Subject: id, Version: version, Guns: [], Sprays: [], ActiveExpressions: [], DynamicOptions: {},
  Identity: { PlayerCardID: `card-${version}`, PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false },
  Incognito: false,
});

describe("loadout confirmation and mutation races", () => {
  beforeEach(() => { mockRequest.mockReset(); clearRiotLoadoutCache(); });
  it("forces server confirmation instead of returning the optimistic PUT cache", async () => {
    const optimistic = makeLoadout("confirm-player", 2);
    const actual = makeLoadout("confirm-player", 3);
    mockRequest.mockResolvedValueOnce({ status: 200, data: optimistic });
    await updatePlayerLoadoutV3("token", "ent", "ap", optimistic.Subject, optimistic);
    mockRequest.mockResolvedValueOnce({ status: 200, data: actual });
    jest.useFakeTimers();
    const pending = { loadout: optimistic, updatedAt: Date.now() };
    try {
      const confirmation = confirmProfileLoadout(
        { accessToken: "token", entitlementsToken: "ent", region: "ap", id: optimistic.Subject },
        optimistic, pending, () => pending, () => true,
      );
      await jest.advanceTimersByTimeAsync(650);
      expect((await confirmation)?.Version).toBe(3);
    } finally { jest.useRealTimers(); }
    expect(mockRequest).toHaveBeenLastCalledWith(expect.objectContaining({ method: "GET" }));
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("cancels delayed confirmation when account ownership changes", async () => {
    jest.useFakeTimers();
    try {
      const expected = makeLoadout("cancel-player", 1);
      const pending = { loadout: expected, updatedAt: Date.now() };
      const confirmation = confirmProfileLoadout(
        { accessToken: "token", entitlementsToken: "ent", region: "ap", id: expected.Subject },
        expected, pending, () => pending, () => true,
      );
      invalidateSessionOperations();
      await jest.advanceTimersByTimeAsync(650);
      await expect(confirmation).resolves.toBeNull();
      expect(mockRequest).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it("does not join or cache a GET started before a completed mutation", async () => {
    const previous = makeLoadout("race-player", 1);
    const updated = makeLoadout("race-player", 2);
    let finishOldRead!: (value: object) => void;
    mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finishOldRead = resolve; }));
    const oldRead = playerLoadout("token", "ent", "ap", previous.Subject);
    mockRequest.mockResolvedValueOnce({ status: 200, data: updated });
    await updatePlayerLoadoutV3("token", "ent", "ap", updated.Subject, updated);
    mockRequest.mockResolvedValueOnce({ status: 200, data: updated });
    expect((await playerLoadout("token", "ent", "ap", updated.Subject, { force: true }))?.Version).toBe(2);
    finishOldRead({ status: 200, data: previous });
    expect((await oldRead)?.Version).toBe(2);
    expect((await playerLoadout("token", "ent", "ap", updated.Subject))?.Version).toBe(2);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it.each(["owner", "version", "guns", "identity", "expressions", "dynamic"])("rejects a raw PUT receipt with invalid %s without creating confirmed cache", async (part) => {
    const payload = { ...makeLoadout("bad-receipt", 4), DynamicOptions: { untouched: true } };
    const bad = { ...payload, Subject: part === "owner" ? "other" : payload.Subject,
      Version: part === "version" ? NaN : 5, Guns: part === "guns" ? [{}] : [],
      Identity: part === "identity" ? {} : payload.Identity,
      DynamicOptions: part === "dynamic" ? undefined : payload.DynamicOptions,
      ActiveExpressions: part === "expressions" ? [{ AssetID: "bad" }] : [] };
    mockRequest.mockResolvedValueOnce({ status: 200, data: bad });
    await expect(updatePlayerLoadoutV3("a", "e", "ap", payload.Subject, payload)).rejects.toThrow("Invalid player loadout receipt");
    mockRequest.mockResolvedValueOnce({ status: 200, data: payload });
    expect(await playerLoadout("a", "e", "ap", payload.Subject)).toMatchObject({ Version: 4 });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("uses only server fields as confirmation and preserves v2 versus v3 transport shapes", async () => {
    const payload = { ...makeLoadout("shape", 4), DynamicOptions: { keep: true } };
    const receipt = { ...payload, Version: 8, Identity: { ...payload.Identity, PlayerCardID: "server-other" } };
    mockRequest.mockResolvedValueOnce({ status: 200, data: receipt });
    expect((await updatePlayerLoadoutV3("a", "e", "ap", payload.Subject, payload)).Identity.PlayerCardID).toBe("server-other");
    expect(mockRequest.mock.calls[0][0].data).toMatchObject({ Version: 4, DynamicOptions: { keep: true }, ActiveExpressions: [] });
    expect(mockRequest.mock.calls[0][0].data.Sprays).toBeUndefined();
    mockRequest.mockResolvedValueOnce({ status: 200, data: { ...receipt, Version: 9 } });
    await updatePlayerLoadout("a", "e", "ap", payload.Subject, payload);
    expect(mockRequest.mock.calls[1][0].data).toHaveProperty("Sprays");
    expect(mockRequest.mock.calls[1][0].data).not.toHaveProperty("ActiveExpressions");
  });

  it("does not publish or cache a receipt when the caller's credentials retire in flight", async () => {
    const payload = makeLoadout("retired", 1); let current = true;
    let finish!: (value: object) => void;
    mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const write = updatePlayerLoadoutV3("a", "e", "ap", payload.Subject, payload, { isCurrent: () => current });
    current = false; finish({ status: 200, data: { ...payload, Version: 2 } });
    await expect(write).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    mockRequest.mockResolvedValueOnce({ status: 200, data: payload });
    expect((await playerLoadout("b", "e", "ap", payload.Subject))?.Version).toBe(1);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it("does not use a cached PUT as fresh force-read proof when a newer GET returns an older version", async () => {
    const old = makeLoadout("stale-force", 1); const updated = makeLoadout("stale-force", 5);
    mockRequest.mockResolvedValueOnce({ status: 200, data: updated });
    await updatePlayerLoadoutV3("a", "e", "ap", updated.Subject, updated);
    mockRequest.mockResolvedValueOnce({ status: 200, data: old });
    expect(await playerLoadout("a", "e", "ap", updated.Subject, { force: true })).toBeNull();
    expect((await playerLoadout("a", "e", "ap", updated.Subject))?.Version).toBe(5);
  });
  it("rejects an empty legacy PUT receipt rather than merging requested fields into success", async () => {
    const payload = makeLoadout("legacy-invalid", 1);
    mockRequest.mockResolvedValueOnce({ status: 200, data: {} });
    await expect(updatePlayerLoadout("a", "e", "ap", payload.Subject, payload)).rejects.toThrow("Invalid player loadout receipt");
  });
  it("starts a new bounded reconciliation GET instead of joining a force read from before an ambiguous PUT", async () => {
    const base = makeLoadout("ambiguous-read", 1); let finishOld!: (value: object) => void;
    mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const oldRead = playerLoadout("a", "e", "ap", base.Subject, { force: true });
    mockRequest.mockRejectedValueOnce(new Error("timeout"));
    await expect(updatePlayerLoadoutV3("a", "e", "ap", base.Subject, base)).rejects.toThrow("timeout");
    mockRequest.mockResolvedValueOnce({ status: 200, data: { ...base, Version: 3 } });
    expect((await playerLoadout("a", "e", "ap", base.Subject, { force: true }))?.Version).toBe(3);
    finishOld({ status: 200, data: base }); expect(await oldRead).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });
  it("does not cache a GET from retired credentials even before another request observes the new token", async () => {
    const base = makeLoadout("retired-read", 1); let current = true; let finish!: (value: object) => void;
    mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const oldRead = playerLoadout("old", "e", "ap", base.Subject, { force: true, isCurrent: () => current });
    current = false; finish({ status: 200, data: { ...base, Version: 9 } });
    await expect(oldRead).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    mockRequest.mockResolvedValueOnce({ status: 200, data: base });
    expect((await playerLoadout("new", "e", "ap", base.Subject))?.Version).toBe(1);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it.each(["v2", "v3"] as const)("dispatches a full update using the confirmed %s source contract", async (api) => {
    const base = { ...makeLoadout("dispatch", 1), SourceApiVersion: api };
    mockRequest.mockResolvedValueOnce({ status: 200, data: { ...base, Version: 2 } });
    expect((await updatePlayerLoadoutV3First("a", "e", "ap", base.Subject, base)).SourceApiVersion).toBe(api);
    expect(mockRequest.mock.calls[0][0].url).toContain(`/personalization/${api}/`);
  });
  it("rejects HTTP conflict without caching or automatically retrying the mutation", async () => {
    const base = makeLoadout("conflict", 1); mockRequest.mockResolvedValueOnce({ status: 409, data: base });
    await expect(updatePlayerLoadoutV3("a", "e", "ap", base.Subject, base)).rejects.toThrow("409");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("falls back to a validated legacy GET when v3 is unavailable and preserves legacy spray slots", async () => {
    const base = { ...makeLoadout("legacy-get", 1), Sprays: [{ EquipSlotID: "slot", SprayID: "spray", SprayLevelID: null }] };
    mockRequest.mockResolvedValueOnce({ status: 404 }); mockRequest.mockResolvedValueOnce({ status: 200, data: base });
    expect(await playerLoadout("a", "e", "ap", base.Subject, { force: true })).toMatchObject({ SourceApiVersion: "v2", Sprays: base.Sprays });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it("does not normalize a malformed raw GET into usable server authority", async () => {
    mockRequest.mockResolvedValueOnce({ status: 200, data: {} }); mockRequest.mockResolvedValueOnce({ status: 200, data: {} });
    expect(await playerLoadout("a", "e", "ap", "bad-get", { force: true })).toBeNull();
    mockRequest.mockRejectedValueOnce(new Error("offline")); mockRequest.mockRejectedValueOnce(new Error("offline"));
    expect(await playerLoadout("a", "e", "ap", "offline-get", { force: true })).toBeNull();
  });
  it("deduplicates same-session concurrent reads and rejects a retired read before transport", async () => {
    const base = makeLoadout("joined-get", 1); let finish!: (value: object) => void;
    mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = playerLoadout("a", "e", "ap", base.Subject, { force: true });
    const second = playerLoadout("a", "e", "ap", base.Subject, { force: true });
    finish({ status: 200, data: base }); expect(await first).toEqual(await second);
    await expect(playerLoadout("a", "e", "ap", base.Subject, { isCurrent: () => false })).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("reads owned options by type and rejects HTTP failures without inventing ownership", async () => {
    const response = { Entitlements: [{ ItemID: "item" }], EntitlementsByTypes: [{ ItemTypeID: "type", Entitlements: [{ ItemID: "item", TypeID: "type" }, { ItemID: "other", TypeID: "type" }] }] };
    mockRequest.mockResolvedValueOnce({ status: 200, data: response });
    expect(extractOwnedItemIds(await ownedItems("a", "e", "ap", "self", "type"))).toEqual(["item", "other"]);
    expect(extractOwnedItemIds(null)).toEqual([]); expect(extractOwnedItemIds({})).toEqual([]);
    mockRequest.mockResolvedValueOnce({ status: 403 }); await expect(ownedItems("a", "e", "ap", "self", "type")).rejects.toThrow("403");
  });
  it("does not let same-version conflicting GET propagation overwrite a known raw ACK", async () => {
    const ack = makeLoadout("same-version", 5);
    mockRequest.mockResolvedValueOnce({ status: 200, data: ack }); await updatePlayerLoadoutV3("a", "e", "ap", ack.Subject, ack);
    mockRequest.mockResolvedValueOnce({ status: 200, data: { ...ack, Identity: { ...ack.Identity, PlayerCardID: "old" } } });
    expect(await playerLoadout("a", "e", "ap", ack.Subject, { force: true })).toBeNull();
    expect((await playerLoadout("a", "e", "ap", ack.Subject))?.Identity.PlayerCardID).toBe(ack.Identity.PlayerCardID);
  });
  it.each([null, "invalid"])("rejects a non-object loadout response (%s) and a failed legacy fallback", async (data) => {
    mockRequest.mockResolvedValueOnce({ status: 200, data }); mockRequest.mockResolvedValueOnce({ status: 503 });
    expect(await playerLoadout("a", "e", "ap", "non-object", { force: true })).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
