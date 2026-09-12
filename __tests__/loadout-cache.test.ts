import { playerLoadout, updatePlayerLoadoutV3 } from "~/services/riot/loadout-api";
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
  Subject: id, Version: version, Guns: [], Sprays: [], ActiveExpressions: [],
  Identity: { PlayerCardID: `card-${version}`, PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false },
  Incognito: false,
});

describe("loadout confirmation and mutation races", () => {
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
});
