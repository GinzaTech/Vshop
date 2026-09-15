import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { useAboutScreenData } from "~/hooks/useAboutScreenData";
import { useContractsScreenData } from "~/hooks/useContractsScreenData";
import { useLeaderboardData } from "~/hooks/useLeaderboardData";
import { getSessionGeneration, invalidateSessionOperations } from "~/utils/session-operations";

const mockUser = { id: "account", region: "ap", accessToken: "synthetic-access", entitlementsToken: "synthetic-entitlements" };
const mockPlayer = jest.fn();
const mockContracts = jest.fn();
const mockContent = jest.fn();
const mockBoard = jest.fn();
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(<T,>(select: (state: { user: typeof mockUser }) => T) => select({ user: mockUser }), {
    getState: () => ({ user: mockUser }),
  }),
}));
jest.mock("~/utils/valorant-api", () => ({
  getPlayerInfo: (...args: unknown[]) => mockPlayer(...args),
  getContracts: (...args: unknown[]) => mockContracts(...args),
  getContent: (...args: unknown[]) => mockContent(...args),
  getLeaderboard: (...args: unknown[]) => mockBoard(...args),
  getRiotClientConfig: async () => ({}),
}));
jest.mock("~/services/valorant/public-api", () => ({ getPublicContracts: async () => [] }));
jest.mock("~/utils/storage", () => ({ getStoredItem: async () => null }));
jest.mock("~/utils/localization", () => ({ getVAPILang: () => "en-US" }));
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const seasons = { Seasons: [{ ID: "act", Name: "Act", Type: "act", IsActive: true, StartTime: "2020-01-01T00:00:00Z", EndTime: "2030-01-01T00:00:00Z" }] };
const player = (label: string) => ({ sub: label });
const contracts = (label: string) => ({ ActiveSpecialContract: label });
const board = (label: string) => ({ Players: [{ gameName: label }], totalPlayers: 1 });

function useAboutProbe() {
  const data = useAboutScreenData();
  return { label: data.playerInfo?.sub ?? "empty", reload: data.reload, loading: data.loading };
}
function useContractsProbe() {
  const data = useContractsScreenData();
  return { label: data.contracts?.ActiveSpecialContract ?? "empty", reload: data.reload, loading: data.loading };
}
function useLeaderboardProbe() {
  const data = useLeaderboardData(mockUser);
  return { label: data.players[0]?.gameName ?? "empty", reload: data.onRefresh, loading: data.loading };
}

describe("screen requests own a session generation", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let result: ReturnType<typeof useAboutProbe>;
  function Probe({ useData }: { useData: typeof useAboutProbe }) {
    const data = useData();
    React.useLayoutEffect(() => { result = data; });
    return <Text>{data.label}</Text>;
  }
  beforeEach(() => {
    mockPlayer.mockReset().mockResolvedValue(player("fresh"));
    mockContracts.mockReset().mockResolvedValue(contracts("fresh"));
    mockBoard.mockReset().mockResolvedValue(board("fresh"));
    mockContent.mockReset().mockResolvedValue(seasons);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; jest.restoreAllMocks(); });
  const mount = async (useData: typeof useAboutProbe) => { await act(async () => { renderer = TestRenderer.create(<Probe useData={useData} />); }); };

  describe.each([
    { name: "About", useData: useAboutProbe, request: mockPlayer, payload: player },
    { name: "Contracts", useData: useContractsProbe, request: mockContracts, payload: contracts },
    { name: "Leaderboard", useData: useLeaderboardProbe, request: mockBoard, payload: board },
  ])("$name", ({ useData, request, payload }) => {
    it("rejects old success with unchanged live credentials and permits a fresh reload", async () => {
      const old = deferred<ReturnType<typeof payload>>();
      request.mockReturnValueOnce(old.promise);
      await mount(useData);
      const generation = getSessionGeneration();
      invalidateSessionOperations();
      expect(getSessionGeneration()).toBe(generation + 1);
      await act(async () => { old.resolve(payload("stale")); });
      expect(result!.label).toBe("empty");
      await act(async () => { await result.reload(); });
      expect(result!.label).toBe("fresh");
      expect(request).toHaveBeenCalledTimes(2);
    });

    it("ignores an old error after generation invalidation and permits retry", async () => {
      const old = deferred<ReturnType<typeof payload>>();
      request.mockReturnValueOnce(old.promise);
      await mount(useData);
      invalidateSessionOperations();
      await act(async () => { old.reject(new Error("old generation")); });
      expect(result!.loading).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
      await act(async () => { await result.reload(); });
      expect(result!.label).toBe("fresh");
      expect(result!.loading).toBe(false);
    });
  });

  it("stops stale content initialization before it requests leaderboard rows, then retries", async () => {
    const oldContent = deferred<typeof seasons>();
    mockContent.mockReturnValueOnce(oldContent.promise);
    await mount(useLeaderboardProbe);
    invalidateSessionOperations();
    await act(async () => { oldContent.resolve(seasons); });
    expect(mockBoard).not.toHaveBeenCalled();
    await act(async () => { await result.reload(); });
    expect(mockContent).toHaveBeenCalledTimes(2);
    expect(result!.label).toBe("fresh");
  });
});
