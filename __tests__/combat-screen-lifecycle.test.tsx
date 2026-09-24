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
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
const details = (kills: number) => ({ players: [{ subject: "one", stats: { kills, deaths: 2, assists: 3, roundsPlayed: 10, score: 2000 } }], roundResults: [] });

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
    await advance(10_000);
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
    await advance(10_000);
    expect(visibleText()).toContain("12/2/3");
    expect(console.warn).toHaveBeenCalledWith("[combat] Refresh failed", { message: "redacted" });
  });

  it("rejects an old match response after the match changes", async () => {
    const old = deferred<ReturnType<typeof details>>();
    mockMatchDetails.mockReturnValueOnce(old.promise).mockResolvedValue(details(22));
    await mountMatch();
    mockSnapshot = snapshot("match-two");
    await update();
    await act(async () => { old.resolve(details(99)); });
    expect(visibleText()).not.toContain("99/2/3");
    await advance(10_000);
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
    await advance(10_000);
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
});
