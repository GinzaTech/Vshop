import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, Text, type AppStateStatus } from "react-native";
import CombatSessionScreen from "~/features/combat/CombatSessionScreen";
import AppRefreshControl from "~/components/ui/AppRefreshControl";

let mockFocused = true;
const account = (id: string) => ({ id, region: "ap", accessToken: `access-${id}`, entitlementsToken: `ent-${id}`, name: id, TagLine: "test" });
let mockUser = account("one");
const mockFetchSession = jest.fn();
const mockMatchDetails = jest.fn();
const mockMMR = jest.fn();
const mockContent = jest.fn();
const mockCompetitive = jest.fn();
let mockLanguage = "en";
const mockTranslate = jest.fn((key: string, _options?: { defaultValue?: string }) => key);
const snapshot = (id = "match-one") => ({
  state: "live", matchId: id, pregameMatch: null, namesBySubject: { one: "Player One" },
  currentGameMatch: { MatchID: id, MapID: "map", Players: [{ Subject: "one", TeamID: "Blue", CharacterID: "agent" }] },
});
let mockSnapshot = snapshot();
let mockSessionKey: string | null = "ap|one";
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const ReactRuntime = jest.requireActual<typeof import("react")>("react");
    ReactRuntime.useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: Object.assign(
  <T,>(select: (state: { user: typeof mockUser }) => T) => select({ user: mockUser }),
  { getState: () => ({ user: mockUser }) },
) }));
jest.mock("~/hooks/useCombatStore", () => ({ useCombatStore: <T,>(select: (state: { snapshot: typeof mockSnapshot; sessionKey: string | null; loading: boolean; fetchSession: typeof mockFetchSession }) => T) => select({ snapshot: mockSnapshot, sessionKey: mockSessionKey, loading: false, fetchSession: mockFetchSession }) }));
jest.mock("~/utils/valorant-api", () => ({
  getContent: (...args: unknown[]) => mockContent(...args),
  getCompetitiveMMR: (...args: unknown[]) => mockMMR(...args),
  matchDetails: (...args: unknown[]) => mockMatchDetails(...args),
}));
jest.mock("~/features/combat/session-insights", () => ({
  ...jest.requireActual("~/features/combat/session-insights"),
  fetchCompetitivePerformanceBatch: (...args: unknown[]) => mockCompetitive(...args),
}));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ maps: [], competitiveTiers: [] }), getAgent: () => ({ agents: [] }) }));
jest.mock("~/utils/screen-orientation", () => ({ lockScreenOrientation: jest.fn().mockResolvedValue(false) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockTranslate, i18n: { resolvedLanguage: mockLanguage } }) }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "Image" }));
jest.mock("~/components/ui/AppRefreshControl", () => "RefreshControl");
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
const details = (kills: number, matchId = "match-one", allyRoundsWon = 7, enemyRoundsWon = 4) => ({
  matchInfo: { matchId },
  teams: [{ teamId: "Red", roundsWon: enemyRoundsWon }, { teamId: "Blue", roundsWon: allyRoundsWon }],
  players: [{ subject: "one", stats: { kills, deaths: 2, assists: 3, roundsPlayed: 10, score: 2000 } }], roundResults: [],
});

describe("Combat mounted screen lifecycle", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let changeState: (state: AppStateStatus) => void;
  let remove: jest.Mock;
  const visibleText = () => renderer.root.findAllByType(Text).flatMap((node) => node.props.children).filter((child) => typeof child === "string").join(" ");
  const update = async () => { await act(async () => { renderer.update(<CombatSessionScreen />); }); };
  const advance = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocused = true;
    mockLanguage = "en";
    mockTranslate.mockClear();
    mockUser = account("one");
    mockSnapshot = snapshot();
    mockSessionKey = "ap|one";
    mockFetchSession.mockReset().mockResolvedValue(mockSnapshot);
    mockContent.mockReset().mockResolvedValue({ Seasons: [] });
    mockMMR.mockReset().mockResolvedValue(null);
    mockCompetitive.mockReset().mockResolvedValue({});
    mockMatchDetails.mockReset().mockResolvedValue(null);
    changeState = () => undefined;
    remove = jest.fn();
    Object.defineProperty(AppState, "currentState", { configurable: true, value: "active", writable: true });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => { changeState = listener; return { remove }; });
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
  const mountMatch = async () => {
    await act(async () => { renderer = TestRenderer.create(<CombatSessionScreen />); });
    await act(async () => { renderer.root.findAllByProps({ accessibilityLabel: "Show current match statistics" })[0].props.onPress(); });
  };

  it("stops match detail polling on blur and resumes once on focus", async () => {
    await mountMatch();
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    mockFocused = false;
    await update();
    await advance(30_000);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    mockFocused = true;
    await update();
    expect(mockMatchDetails).toHaveBeenCalledTimes(2);
  });

  it("pauses both pollers while backgrounded and cleans up the AppState listener", async () => {
    await mountMatch();
    const count = mockFetchSession.mock.calls.length;
    await act(async () => { AppState.currentState = "background"; changeState("background"); });
    await advance(30_000);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    expect(mockFetchSession).toHaveBeenCalledTimes(count);
    await act(async () => { AppState.currentState = "active"; changeState("active"); });
    expect(mockMatchDetails).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("does not overlap slow match detail requests, including a quick blur/refocus", async () => {
    const pending = deferred<null>();
    mockMatchDetails.mockReturnValue(pending.promise);
    await mountMatch();
    await advance(30_000);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    mockFocused = false;
    await update();
    mockFocused = true;
    await update();
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(null); });
    await advance(3_000);
    expect(mockMatchDetails).toHaveBeenCalledTimes(2);
  });

  it("does not refetch the snapshot on unrelated account object updates", async () => {
    await mountMatch();
    mockUser = { ...mockUser, name: "updated name" };
    await update();
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
  });

  it("does not start downstream rank requests after account rotation during content fetch", async () => {
    const old = deferred<{ Seasons: [] }>();
    mockContent.mockReturnValue(old.promise);
    await mountMatch();
    mockUser = account("two");
    await act(async () => { old.resolve({ Seasons: [] }); });
    expect(mockMMR).not.toHaveBeenCalled();
  });

  it("hides the previous account roster immediately while the new snapshot is pending", async () => {
    await mountMatch();
    expect(visibleText()).toContain("Player One");
    mockUser = account("two");
    mockFetchSession.mockReturnValue(new Promise(() => undefined));
    await update();
    expect(visibleText()).not.toContain("Player One");
    expect(mockMatchDetails.mock.calls.every((call) => call[0] === "access-one")).toBe(true);
  });

  it("keeps ready match statistics after a transient refresh failure", async () => {
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockRejectedValueOnce(new Error("network timeout"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountMatch();
    expect(visibleText()).toContain("12/2/3");
    await advance(3_000);
    expect(visibleText()).toContain("12/2/3");
    expect(console.warn).toHaveBeenCalledWith("[combat] Refresh failed", { message: "redacted" });
  });

  it("rejects an old match response after the match changes", async () => {
    const old = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockReturnValueOnce(old.promise).mockResolvedValue(details(22, "match-two"));
    await mountMatch();
    mockSnapshot = snapshot("match-two");
    await update();
    await act(async () => { old.resolve(details(99)); });
    expect(visibleText()).not.toContain("99/2/3");
    await advance(3_000);
    expect(visibleText()).toContain("22/2/3");
  });

  it("ignores an in-flight match response after backgrounding, even before effects flush", async () => {
    const old = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockReturnValueOnce(old.promise);
    await mountMatch();
    await act(async () => {
      AppState.currentState = "background";
      changeState("background");
      old.resolve(details(99));
    });
    expect(visibleText()).not.toContain("99/2/3");
  });

  it("cleans pending timers on unmount", async () => {
    await mountMatch();
    act(() => renderer.unmount());
    await advance(60_000);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight snapshot refresh with the pull-to-refresh handler", async () => {
    const pending = deferred<ReturnType<typeof snapshot>>();
    mockFetchSession.mockReturnValueOnce(pending.promise);
    await mountMatch();
    const refresh = renderer.root.findByType(AppRefreshControl).props.onRefresh;
    let refreshPromise!: Promise<unknown>;
    act(() => { refreshPromise = refresh(); });
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(mockSnapshot); await refreshPromise; });
    await advance(3_000);
    expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });

  it("does not request snapshots through a retained refresh handler after blur", async () => {
    await mountMatch();
    const refresh = renderer.root.findByType(AppRefreshControl).props.onRefresh;
    mockFocused = false;
    await update();
    await act(async () => { await refresh(); });
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
  });

  it("does not request snapshots without credentials", async () => {
    await mountMatch();
    mockUser = { ...mockUser, accessToken: "" };
    await update();
    const refresh = renderer.root.findByType(AppRefreshControl).props.onRefresh;
    await act(async () => { await refresh(); });
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
  });

  it("updates the live score in COMP mode and shares each request with MATCH stats", async () => {
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockResolvedValue(details(13, "match-one", 8, 4));
    await act(async () => { renderer = TestRenderer.create(<CombatSessionScreen />); });
    expect(visibleText()).toContain("7 : 4");
    expect(visibleText()).toContain("combat_session_page.stats_competitive_short");
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: "Show current match statistics" }).props.onPress(); });
    expect(visibleText()).toContain("12/2/3");
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    await advance(2_999);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockMatchDetails).toHaveBeenCalledTimes(2);
    expect(visibleText()).toContain("8 : 4");
    expect(visibleText()).toContain("13/2/3");
  });

  it("shows an unavailable score on initial failure and hides it in pregame", async () => {
    mockMatchDetails.mockRejectedValue(new Error("not published"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountMatch();
    expect(visibleText()).toContain("— : —");
    expect(visibleText()).toContain("combat_session_page.score_unavailable");
    expect(visibleText()).not.toContain("0 : 0");
    mockSnapshot = { ...snapshot(), state: "pregame" };
    await update();
    expect(visibleText()).not.toContain("— : —");
    const count = mockFetchSession.mock.calls.length;
    await advance(3_000);
    expect(mockFetchSession).toHaveBeenCalledTimes(count + 1);
    expect(mockMatchDetails).toHaveBeenCalledTimes(1);
  });

  it("does not infer a Blue score when the current player is absent", async () => {
    mockSnapshot = { ...snapshot(), currentGameMatch: { ...snapshot().currentGameMatch,
      Players: [{ Subject: "someone-else", TeamID: "Blue", CharacterID: "agent" }],
    } };
    mockMatchDetails.mockResolvedValue(details(12));
    await mountMatch();
    expect(visibleText()).toContain("— : —");
    expect(visibleText()).not.toContain("7 : 4");
  });

  it("retains a good score on null, failure, or mismatched match data", async () => {
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(details(99, "unrelated-match", 99, 98));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await mountMatch();
    for (let wave = 0; wave < 3; wave++) {
      expect(visibleText()).toContain("7 : 4");
      await advance(3_000);
    }
    expect(visibleText()).toContain("7 : 4");
    expect(visibleText()).not.toContain("99 : 98");
    expect(visibleText()).not.toContain("99/2/3");
    expect(mockMatchDetails).toHaveBeenCalledTimes(4);
  });

  it("retains the good score across blur and rejects a pending completion", async () => {
    const pending = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockReturnValueOnce(pending.promise);
    await mountMatch();
    await advance(3_000);
    mockFocused = false;
    await update();
    await act(async () => { pending.resolve(details(99, "match-one", 99, 98)); });
    mockMatchDetails.mockResolvedValue(null);
    mockFocused = true;
    await update();
    expect(visibleText()).toContain("7 : 4");
    expect(visibleText()).not.toContain("99 : 98");
  });

  it("clears a previous match score immediately and rejects its pending wave", async () => {
    const pending = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockReturnValueOnce(pending.promise);
    await mountMatch();
    await advance(3_000);
    mockSnapshot = snapshot("match-two");
    await update();
    expect(visibleText()).toContain("— : —");
    expect(visibleText()).not.toContain("7 : 4");
    await act(async () => { pending.resolve(details(99, "match-one", 99, 98)); });
    expect(visibleText()).not.toContain("99 : 98");
    mockMatchDetails.mockResolvedValue(details(22, "match-two", 2, 1));
    await advance(3_000);
    expect(visibleText()).toContain("2 : 1");
  });

  it("clears a previous account score and rejects its pending wave", async () => {
    const pending = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockReturnValueOnce(pending.promise);
    await mountMatch();
    await advance(3_000);
    mockUser = account("two");
    await update();
    expect(visibleText()).not.toContain("7 : 4");
    await act(async () => { pending.resolve(details(99, "match-one", 99, 98)); });
    expect(visibleText()).not.toContain("99 : 98");
  });

  it("uses a Vietnamese unavailable fallback without requiring an i18n file edit", async () => {
    mockLanguage = "vi";
    await mountMatch();
    expect(mockTranslate).toHaveBeenCalledWith("combat_session_page.score_unavailable", {
      defaultValue: "Chưa có tỉ số; dữ liệu có thể chỉ xuất hiện sau trận.",
    });
  });

  it("clears the score on token rotation and ignores the old pending result", async () => {
    const pending = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockResolvedValueOnce(details(12)).mockReturnValueOnce(pending.promise);
    await mountMatch();
    await advance(3_000);
    mockUser = { ...mockUser, entitlementsToken: "rotated" };
    await update();
    expect(visibleText()).toContain("— : —");
    expect(visibleText()).not.toContain("7 : 4");
    await act(async () => { pending.resolve(details(99, "match-one", 99, 98)); });
    expect(visibleText()).not.toContain("99 : 98");
    mockMatchDetails.mockResolvedValue(details(22, "match-one", 2, 1));
    await advance(3_000);
    expect(visibleText()).toContain("2 : 1");
  });
});
