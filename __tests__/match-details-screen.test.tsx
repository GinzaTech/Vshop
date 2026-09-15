import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MatchDetailsScreen from "~/app/(authenticated)/match_details/[id]";
import type { MatchDetailsData } from "~/types/match-ui";
import { defaultUser } from "~/utils/valorant-user";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockT = (key: string) => key;
const mockParams: { id: string; demo?: string } = { id: "match-a" };
const mockUserState = { user: defaultUser };
const mockFetch = jest.fn();
const mockNames = jest.fn();
const mockMerge = jest.fn();
const mockCache = { authKey: "ap|a", detailsById: {} as Record<string, MatchDetailsData>, fetchMatchDetails: mockFetch, mergeMatchDetails: mockMerge };
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ back: jest.fn() }) }));
jest.mock("react-native-reanimated", () => ({
  __esModule: true, default: { View: "AnimatedView" },
  useAnimatedStyle: () => ({}), useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value,
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("~/constants/Motion", () => ({ MOTION_TIMING: { standard: { duration: 200 } } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockT, i18n: { language: "en" } }) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: Object.assign(
  (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState), { getState: () => mockUserState },
) }));
jest.mock("~/hooks/useMatchStore", () => ({ useMatchStore: Object.assign(
  (selector: (state: typeof mockCache) => unknown) => selector(mockCache), { getState: () => mockCache },
) }));
jest.mock("~/utils/valorant-api", () => ({ getPlayerNames: (...args: unknown[]) => mockNames(...args) }));
jest.mock("~/utils/match-ui", () => ({ buildMatchDetailViewModel: (details: MatchDetailsData) => ({
  match: { id: details.matchInfo.matchId, mapName: "map", teamAScore: 13, teamBScore: 10 },
  players: details.players.map((player) => ({ playerId: player.subject, name: details.playerIdentities?.find((item) => item.Subject === player.subject)?.GameName ?? "unresolved" })),
  currentPlayerId: details.players[0]?.subject, rounds: [], economy: [], playerPerformance: {},
}) }));
jest.mock("~/mocks/match-ui", () => ({ mockMatchDetail: { match: { id: "demo" }, players: [], rounds: [], economy: [], playerPerformance: {} } }));
jest.mock("~/components/match-detail/EconomyChart", () => ({ EconomyChart: "EconomyChart" }));
jest.mock("~/components/match-detail/MatchDetailHeader", () => ({ MatchDetailHeader: "MatchDetailHeader" }));
jest.mock("~/components/match-detail/MatchDetailTabs", () => ({ MatchDetailTabs: "MatchDetailTabs" }));
jest.mock("~/components/match-detail/PerformanceTab", () => ({ PerformanceTab: "PerformanceTab" }));
jest.mock("~/components/match-detail/ScoreboardTable", () => ({ ScoreboardTable: "ScoreboardTable" }));
jest.mock("~/components/match-detail/StickyShareBar", () => ({ StickyShareBar: "StickyShareBar" }));
jest.mock("~/components/matches/MatchStates", () => ({ MatchDetailSkeleton: "MatchDetailSkeleton", MatchStatePanel: "MatchStatePanel" }));
jest.mock("~/components/ui/AppRefreshControl", () => ({ __esModule: true, default: "AppRefreshControl" }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const detail = (id = "match-a", subject = "player") => ({
  matchInfo: { matchId: id }, players: [{ subject }],
}) as unknown as MatchDetailsData;
const names = (name: string) => [{ Subject: "player", GameName: name, TagLine: "TEST" }];

describe("match details route request ownership", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<MatchDetailsScreen />); }); };
  const rerender = async () => { await act(async () => { renderer!.update(<MatchDetailsScreen />); }); };
  const displayedNames = (): string[] => renderer!.root.findAll((node) => String(node.type) === "ScoreboardTable").flatMap((node) => node.props.players.map((player: { name: string }) => player.name));
  beforeEach(() => {
    jest.resetAllMocks();
    mockParams.id = "match-a";
    delete mockParams.demo;
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "access-a", entitlementsToken: "ent-a" };
    mockCache.authKey = "ap|a";
    mockCache.detailsById = { "match-a": detail() };
    mockFetch.mockImplementation(async (_user, id) => detail(id));
    mockNames.mockResolvedValue(names("current"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; jest.restoreAllMocks(); });

  it("resolves names once without restarting on unrelated user updates", async () => {
    await mount();
    expect(displayedNames()).toEqual(["current"]);
    mockUserState.user = { ...mockUserState.user, balances: { ...mockUserState.user.balances, vp: 100 } };
    await rerender();
    expect(mockNames).toHaveBeenCalledTimes(1);
  });

  it.each(["id", "accessToken", "entitlementsToken"] as const)("replaces an old name lookup after %s changes", async (field) => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise).mockResolvedValueOnce(names("new-session"));
    await mount();
    mockUserState.user = { ...mockUserState.user, [field]: `${field}-new` };
    if (field === "id") mockCache.authKey = `ap|${mockUserState.user.id}`;
    mockCache.detailsById = { "match-a": detail() };
    await rerender();
    await act(async () => { old.resolve(names("obsolete")); });
    expect(displayedNames()).toEqual(["new-session"]);
    expect(mockMerge.mock.calls.some((call) => call[1]?.playerIdentities?.[0]?.GameName === "obsolete")).toBe(false);
  });

  it.each(["logout", "token", "generation"])("rejects old names after live %s changes before React rerenders", async (change) => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise);
    await mount();
    if (change === "logout") mockUserState.user = defaultUser;
    if (change === "token") mockUserState.user = { ...mockUserState.user, accessToken: "new-token" };
    if (change === "generation") invalidateSessionOperations();
    await act(async () => { old.resolve(names("obsolete")); });
    expect(mockMerge).not.toHaveBeenCalled();
    expect(displayedNames()).not.toContain("obsolete");
  });

  it("ignores callbacks from an unmounted instance when the same route remounts", async () => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise).mockResolvedValueOnce(names("remounted"));
    await mount();
    act(() => renderer!.unmount());
    await mount();
    await act(async () => { old.resolve(names("unmounted")); });
    expect(displayedNames()).toEqual(["remounted"]);
    expect(mockMerge.mock.calls.some((call) => call[1]?.playerIdentities?.[0]?.GameName === "unmounted")).toBe(false);
  });

  it("allows a new match with the same subjects to resolve its own names", async () => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise).mockResolvedValueOnce(names("match-b-name"));
    await mount();
    mockParams.id = "match-b";
    mockCache.detailsById = { "match-b": detail("match-b") };
    await rerender();
    await act(async () => { old.resolve(names("match-a-name")); });
    expect(displayedNames()).toEqual(["match-b-name"]);
    expect(mockMerge.mock.calls.every((call) => call[0] === "match-b")).toBe(true);
  });

  it("does not read another account's cached details", async () => {
    mockCache.authKey = "ap|other";
    const waiting = deferred<MatchDetailsData>();
    mockFetch.mockReturnValueOnce(waiting.promise);
    await mount();
    expect(displayedNames()).toEqual([]);
    expect(mockNames).not.toHaveBeenCalled();
    await act(async () => { waiting.resolve(detail()); });
  });

  it("does not turn an old detail response into an error for a new route", async () => {
    mockCache.detailsById = {};
    const old = deferred<MatchDetailsData | null>();
    mockFetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(detail("match-b"));
    await mount();
    mockParams.id = "match-b";
    await rerender();
    await act(async () => { old.resolve(null); });
    expect(renderer!.root.findAll((node) => String(node.type) === "MatchStatePanel")).toHaveLength(0);
    expect(renderer!.root.findAll((node) => String(node.type) === "MatchDetailHeader")[0].props.match.id).toBe("match-b");
  });

  it("logs a sanitized failure and retries names when refreshed details arrive", async () => {
    const failure = Object.assign(new Error("private-name-token"), { response: { status: 403 }, config: { headers: { Authorization: "private-name-token" } } });
    mockNames.mockRejectedValueOnce(failure).mockResolvedValueOnce(names("retry-ok"));
    await mount();
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("private-name-token");
    mockCache.detailsById = { "match-a": detail() };
    await rerender();
    expect(displayedNames()).toEqual(["retry-ok"]);
  });

  it("does not request names in demo mode", async () => {
    mockParams.demo = "true";
    await mount();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockNames).not.toHaveBeenCalled();
  });

  it("does not overwrite a newer cached detail before React renders it", async () => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise);
    await mount();
    mockCache.detailsById = { "match-a": detail() };
    await act(async () => { old.resolve(names("old-source")); });
    expect(mockMerge).not.toHaveBeenCalled();
    expect(displayedNames()).not.toContain("old-source");
  });

  it("ignores name failures after unmount", async () => {
    const old = deferred<ReturnType<typeof names>>();
    mockNames.mockReturnValueOnce(old.promise);
    await mount();
    act(() => renderer!.unmount());
    await act(async () => { old.reject(new Error("unmounted-token")); });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("retains existing identities when resolving the remaining player", async () => {
    mockCache.detailsById = { "match-a": {
      ...detail(), players: [{ subject: "known" }, { subject: "player" }] as MatchDetailsData["players"],
      playerIdentities: [{ Subject: "known", GameName: "already-known" }],
    } };
    await mount();
    expect(mockNames.mock.calls[0][2]).toEqual(["player"]);
    expect(displayedNames()).toEqual(["already-known", "current"]);
  });

  it("does not loop when the name service returns no names or unrelated identities", async () => {
    mockNames.mockResolvedValueOnce([{ Subject: "someone-else", GameName: "wrong-player", TagLine: "TEST" }]);
    await mount();
    expect(mockNames).toHaveBeenCalledTimes(1);
    expect(mockMerge).not.toHaveBeenCalled();
    expect(displayedNames()).toEqual(["unresolved"]);
  });

  it("skips lookup for already named players and empty subjects", async () => {
    mockCache.detailsById = { "match-a": { ...detail(), players: [{ subject: "player", gameName: "known" }, { subject: "" }] as MatchDetailsData["players"] } };
    await mount();
    expect(mockNames).not.toHaveBeenCalled();
  });

  it("rejects the original lookup after switching away and back to the exact same session", async () => {
    const old = deferred<ReturnType<typeof names>>();
    const originalUser = mockUserState.user;
    mockNames.mockReturnValueOnce(old.promise).mockResolvedValueOnce(names("account-b")).mockResolvedValueOnce(names("returned-a"));
    await mount();
    mockUserState.user = { ...originalUser, id: "b" };
    mockCache.authKey = "ap|b";
    mockCache.detailsById = { "match-a": detail() };
    await rerender();
    mockUserState.user = originalUser;
    mockCache.authKey = "ap|a";
    mockCache.detailsById = { "match-a": detail() };
    await rerender();
    await act(async () => { old.resolve(names("obsolete-a")); });
    expect(displayedNames()).toEqual(["returned-a"]);
  });

  it("handles rejected detail refresh without leaking upstream errors", async () => {
    await mount();
    mockFetch.mockRejectedValueOnce(new Error("private-detail-token"));
    const refresh = renderer!.root.find((node) => String(node.type) === "AppRefreshControl");
    await act(async () => { await refresh.props.onRefresh(); });
    expect(mockFetch.mock.calls[0][2]).toBe(true);
    expect(renderer!.root.find((node) => String(node.type) === "MatchStatePanel").props.body).toBe("match_ui.states.error_body");
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("private-detail-token");
  });

  it.each(["matchId", "credentials"])("does not request with missing %s", async (missing) => {
    mockCache.detailsById = {};
    if (missing === "matchId") mockParams.id = "";
    else mockUserState.user = defaultUser;
    await mount();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockNames).not.toHaveBeenCalled();
    expect(renderer!.root.findAll((node) => String(node.type) === "MatchStatePanel")).toHaveLength(1);
  });
});
