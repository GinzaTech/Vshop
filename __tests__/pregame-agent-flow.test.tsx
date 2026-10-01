import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, type AppStateStatus } from "react-native";
import { usePregameAgentFlow } from "~/features/party/usePregameAgentFlow";
import type { CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { invalidateSessionOperations } from "~/utils/session-operations";

let mockFocused = true;
const account = (id: string) => ({ id, region: "ap", accessToken: `test-access-${id}`, entitlementsToken: `test-ent-${id}` });
let mockUser = account("self");
const mockLock = jest.fn();
const mockFetch = jest.fn();
let mockSnapshot: CombatSessionSnapshot;
const mockEnter = jest.fn();
jest.mock("~/services/riot/pregame-actions", () => ({ selectAndLockPregameAgent: (...args: unknown[]) => mockLock(...args) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockUser }) } }));
jest.mock("~/hooks/useCombatStore", () => ({ useCombatStore: Object.assign(
  <T,>(select: (state: { fetchSession: typeof mockFetch }) => T) => select({ fetchSession: mockFetch }),
  { getState: () => ({ snapshot: mockSnapshot, sessionKey: `${mockUser.region}|${mockUser.id}` }) },
) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
jest.mock("expo-router", () => ({ useFocusEffect: (effect: () => (() => void) | undefined) => {
  const runtime = jest.requireActual<typeof import("react")>("react");
  runtime.useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
} }));

function player(subject: string, characterId = "", state: PreGameTeam["Players"][number]["CharacterSelectionState"] = ""): PreGameTeam["Players"][number] {
  return { Subject: subject, CharacterID: characterId, CharacterSelectionState: state, PregamePlayerState: "joined",
    CompetitiveTier: 0, IsCaptain: false,
    PlayerIdentity: { Subject: subject, PlayerCardID: "", PlayerTitleID: "", AccountLevel: 1, PreferredLevelBorderID: "", Incognito: false, HideAccountLevel: false },
    SeasonalBadgeInfo: { SeasonID: "", NumberOfWins: 0, WinsByTier: null, Rank: 0, LeaderboardRank: 0 },
  };
}
function pregame(id: string): CombatSessionSnapshot {
  const team: PreGameTeam = { TeamID: "Blue", Players: [player(mockUser.id)] };
  return { state: "pregame", matchId: id, partyId: null, party: null, currentGameMatch: null, namesBySubject: {},
    pregameMatch: {
      ID: id, Version: 1, Teams: [team], AllyTeam: team, EnemyTeam: null,
      ObserverSubjects: [], MatchCoaches: [], EnemyTeamSize: 5, EnemyTeamLockCount: 0,
      PregameState: "character_select_active", LastUpdated: "", MapID: "map", MapSelectPool: [], BannedMapIDs: [],
      MapSelectSteps: [], MapSelectStep: 0, Team1: "Blue", GamePodID: "pod", Mode: "mode", VoiceSessionID: "",
      MUCName: "", TeamMatchToken: "", QueueID: "unrated", ProvisioningFlowID: "Matchmaking", IsRanked: false,
      PhaseTimeRemainingNS: 0, StepTimeRemainingNS: 0, altModesFlagADA: false, TournamentMetadata: null, RosterMetadata: null,
    },
  };
}
function live(id: string): CombatSessionSnapshot {
  return { ...pregame(id), state: "live", pregameMatch: null };
}
function lockedReceipt(snapshot: CombatSessionSnapshot): LockCharacterResponse {
  const response = snapshot.pregameMatch!;
  const team: PreGameTeam = { TeamID: "Blue", Players: [player(mockUser.id, "agent", "locked")] };
  return { ...response, AllyTeam: team, Teams: [team] };
}
const agents: readonly ValorantAgent[] = ["agent", "other"].map((uuid) => ({ uuid, displayName: uuid, role: { uuid: "role", description: "", displayIcon: "" } }));
let flow: ReturnType<typeof usePregameAgentFlow>;
function Probe({ enabled = true }: { enabled?: boolean }) {
  const result = usePregameAgentFlow({ session: mockUser, snapshot: mockSnapshot, enabled, agents, onEnterMatch: mockEnter });
  React.useEffect(() => { flow = result; });
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("pregame agent lifecycle", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let changeState: (state: AppStateStatus) => void;
  let sequence = 0;
  const render = async (enabled = true) => { await act(async () => {
    if (renderer) renderer.update(<Probe enabled={enabled} />);
    else renderer = TestRenderer.create(<Probe enabled={enabled} />);
  }); };
  const select = (id = "agent") => act(() => flow.onSelect(id));
  const close = () => act(() => flow.onClose());
  const unmount = () => { act(() => renderer?.unmount()); renderer = undefined; };
  beforeEach(() => {
    renderer = undefined; mockFocused = true; mockUser = account("self");
    mockSnapshot = pregame(`match-${++sequence}`);
    mockEnter.mockReset(); mockLock.mockReset().mockResolvedValue(mockSnapshot.pregameMatch);
    mockFetch.mockReset().mockImplementation(async () => mockSnapshot);
    Object.defineProperty(AppState, "currentState", { configurable: true, writable: true, value: "active" });
    const listeners = new Set<(state: AppStateStatus) => void>();
    changeState = (state) => { listeners.forEach((listener) => listener(state)); };
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      listeners.add(listener); return { remove: jest.fn(() => listeners.delete(listener)) };
    });
  });
  afterEach(() => { unmount(); jest.restoreAllMocks(); });

  it("keeps idle Party empty and selecting/closing local; reopens manually or automatically for a new match", async () => {
    const current = mockSnapshot;
    mockSnapshot = { ...current, state: "idle", matchId: null, pregameMatch: null };
    await render(); expect(flow.visible).toBe(false);
    mockSnapshot = current; await render(); expect(flow.visible).toBe(true);
    select(); expect(flow.selectedAgentId).toBe("agent"); close();
    await render(); expect(flow.visible).toBe(false);
    act(() => flow.onOpen()); expect(flow.visible).toBe(true);
    close(); mockSnapshot = pregame(`${current.matchId}-new`); await render();
    expect(flow.visible).toBe(true); expect(flow.selectedAgentId).toBeNull();
    expect(mockLock).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled(); expect(mockEnter).not.toHaveBeenCalled();
  });
  it("preserves dismissal over unmount and token renewal, scoped by account/region/match", async () => {
    await render(); close(); unmount(); mockUser = { ...mockUser, accessToken: "renewed" };
    await render(); expect(flow.visible).toBe(false);
    unmount(); mockUser = account("another"); mockSnapshot = pregame(mockSnapshot.matchId!);
    await render(); expect(flow.visible).toBe(true);
    close(); unmount(); mockUser = { ...mockUser, region: "eu" }; await render(); expect(flow.visible).toBe(true);
  });
  it("opens the live tracker once across remount/renewal without selecting", async () => {
    mockSnapshot = live(mockSnapshot.matchId!); await render();
    expect(flow.visible).toBe(false); expect(mockEnter).toHaveBeenCalledTimes(1);
    unmount(); mockUser = { ...mockUser, entitlementsToken: "renewed" }; await render();
    act(() => flow.onOpen()); expect(flow.visible).toBe(false);
    expect(mockEnter).toHaveBeenCalledTimes(1); expect(mockLock).not.toHaveBeenCalled();
  });
  it("already-locked self enters once without a popup", async () => {
    mockSnapshot.pregameMatch!.AllyTeam = { TeamID: "Blue", Players: [player("self", "agent", "locked")] };
    await render(); expect(flow.visible).toBe(false); expect(mockEnter).toHaveBeenCalledTimes(1);
    unmount(); await render(); expect(mockEnter).toHaveBeenCalledTimes(1);
    act(() => flow.onOpen()); expect(flow.visible).toBe(false); expect(mockLock).not.toHaveBeenCalled();
  });
  it("only auto-opens while enabled, focused and foreground with matching usable pregame data", async () => {
    await render(false); expect(flow.visible).toBe(false);
    mockFocused = false; await render(); expect(flow.visible).toBe(false);
    mockFocused = true; AppState.currentState = "background"; await render(); expect(flow.visible).toBe(false);
    await act(async () => { AppState.currentState = "active"; changeState("active"); });
    expect(flow.visible).toBe(true);
  });
  it.each(["missing", "mismatch", "no-self", "provisioned"])("rejects invalid pregame snapshot: %s", async (kind) => {
    if (kind === "missing") mockSnapshot = { ...mockSnapshot, pregameMatch: null };
    if (kind === "mismatch") mockSnapshot.pregameMatch!.ID = "other-match";
    if (kind === "no-self") mockSnapshot.pregameMatch!.AllyTeam = null;
    if (kind === "provisioned") mockSnapshot.pregameMatch!.PregameState = "provisioned";
    await render(); expect(flow.visible).toBe(false); expect(mockEnter).not.toHaveBeenCalled();
  });
  it("rejects unknown/ally-locked agents and drops a selection that becomes unavailable", async () => {
    await render(); select("unknown"); expect(flow.selectedAgentId).toBeNull();
    mockSnapshot.pregameMatch!.AllyTeam = { TeamID: "Blue", Players: [player("self"), player("ally", "other", "locked")] };
    await render(); select("other"); expect(flow.selectedAgentId).toBeNull();
    select(); mockSnapshot = { ...mockSnapshot, pregameMatch: { ...mockSnapshot.pregameMatch!, AllyTeam: { TeamID: "Blue", Players: [player("self"), player("ally", "agent", "locked")] } } };
    await render(); await act(async () => { await flow.onLock(); });
    expect(flow.selectedAgentId).toBeNull(); expect(mockLock).not.toHaveBeenCalled();
  });
  it("requires a selection and preserves the popup/selection with translated error on lock failure", async () => {
    await render(); await act(async () => { await flow.onLock(); });
    expect(flow.errorMessage).toBe("Choose an agent before trying to lock."); expect(mockLock).not.toHaveBeenCalled();
    select(); mockLock.mockRejectedValue(new Error("private server details"));
    await act(async () => { await flow.onLock(); });
    expect(flow.visible).toBe(true); expect(flow.selectedAgentId).toBe("agent"); expect(flow.locking).toBe(false);
    expect(flow.errorMessage).toBe("Unable to lock that agent right now."); expect(mockEnter).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  });
  it("deduplicates double presses, enters on the receipt before refresh settles and cannot reopen after success", async () => {
    const old = deferred<LockCharacterResponse>(); const refreshed = deferred<CombatSessionSnapshot>();
    mockLock.mockReturnValue(old.promise); mockFetch.mockReturnValue(refreshed.promise);
    await render(); select(); let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => { first = flow.onLock(); second = flow.onLock(); });
    expect(flow.locking).toBe(true); expect(mockLock).toHaveBeenCalledTimes(1);
    select("other"); expect(flow.selectedAgentId).toBe("agent");
    await act(async () => { old.resolve(mockSnapshot.pregameMatch!); });
    expect(mockFetch).toHaveBeenCalledTimes(1); expect(mockEnter).toHaveBeenCalledTimes(1);
    expect(flow.visible).toBe(false); expect(flow.locking).toBe(false);
    await act(async () => { refreshed.resolve(mockSnapshot); await first; await second; });
    expect(mockEnter).toHaveBeenCalledTimes(1); expect(flow.visible).toBe(false); expect(flow.locking).toBe(false);
    act(() => flow.onOpen()); expect(flow.visible).toBe(false); unmount(); await render(); expect(mockEnter).toHaveBeenCalledTimes(1);
  });
  it.each(["match", "account", "access", "entitlements", "generation", "disabled", "blur", "background", "unmount"])("drops stale lock success after %s", async (kind) => {
    const old = deferred<LockCharacterResponse>(); mockLock.mockReturnValue(old.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    const guard: () => boolean = mockLock.mock.calls[0][0].isCurrent;
    const response = mockSnapshot.pregameMatch!;
    if (kind === "match") mockSnapshot = pregame(`${mockSnapshot.matchId}-new`);
    if (kind === "account") mockUser = account("new-account");
    if (kind === "access") mockUser = { ...mockUser, accessToken: "renewed" };
    if (kind === "entitlements") mockUser = { ...mockUser, entitlementsToken: "renewed" };
    if (kind === "generation") invalidateSessionOperations();
    if (kind === "blur") mockFocused = false;
    if (kind === "background") await act(async () => { AppState.currentState = "background"; changeState("background"); });
    if (kind === "unmount") unmount(); else await render(kind !== "disabled");
    expect(guard()).toBe(false);
    await act(async () => { old.resolve(response); await task; });
    expect(mockEnter).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
    if (kind === "match") expect(flow.visible).toBe(true);
  });
  it("drops a stale failure and invalidates a retained handler", async () => {
    const old = deferred<never>(); mockLock.mockReturnValue(old.promise);
    await render(); select(); const retained = flow.onLock; let task!: Promise<unknown>;
    act(() => { task = retained(); });
    mockSnapshot = pregame(`${mockSnapshot.matchId}-next`); await render();
    await act(async () => { old.reject(new Error("old")); await task; await retained(); });
    expect(flow.errorMessage).toBeNull(); expect(flow.visible).toBe(true); expect(mockLock).toHaveBeenCalledTimes(1);
  });
  it("drops completion when account/match changes in the store before React rerenders", async () => {
    const old = deferred<LockCharacterResponse>(); mockLock.mockReturnValue(old.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    const response = mockSnapshot.pregameMatch!; mockSnapshot = pregame(`${mockSnapshot.matchId}-new`);
    await act(async () => { old.resolve(response); await task; });
    expect(mockFetch).not.toHaveBeenCalled(); expect(mockEnter).not.toHaveBeenCalled();
  });
  it("does not retarget a confirmed receipt or close a replacement match popup when refresh settles", async () => {
    const refreshed = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValue(refreshed.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    await act(async () => { await Promise.resolve(); }); expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockEnter).toHaveBeenCalledTimes(1);
    mockSnapshot = pregame(`${mockSnapshot.matchId}-replacement`); await render(); expect(flow.visible).toBe(true);
    await act(async () => { refreshed.resolve(mockSnapshot); await task; });
    expect(mockEnter).toHaveBeenCalledTimes(1); expect(flow.visible).toBe(true);
  });

  it("invalidates mutation permission when an ally locks the selected agent before React rerenders", async () => {
    const old = deferred<never>(); mockLock.mockReturnValue(old.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    const guard: () => boolean = mockLock.mock.calls[0][0].isCurrent;
    mockSnapshot = { ...mockSnapshot, pregameMatch: { ...mockSnapshot.pregameMatch!, AllyTeam: { TeamID: "Blue", Players: [player("self"), player("ally", "agent", "locked")] } } };
    expect(guard()).toBe(false);
    await render(); await act(async () => { old.reject(new Error("unavailable")); await task; });
    expect(flow.locking).toBe(false); expect(flow.selectedAgentId).toBeNull(); expect(mockEnter).not.toHaveBeenCalled();
  });
  it("rejects a retained Lock handler if self has already locked in the store", async () => {
    await render(); select(); const retained = flow.onLock;
    mockSnapshot = { ...mockSnapshot, pregameMatch: { ...mockSnapshot.pregameMatch!, AllyTeam: { TeamID: "Blue", Players: [player("self", "agent", "locked")] } } };
    await act(async () => { await retained(); }); expect(mockLock).not.toHaveBeenCalled();
  });
  it("bounds the persistent ledger and preserves recent once-only entries", async () => {
    const first = mockSnapshot.matchId!;
    await render(); close();
    for (let index = 0; index < 130; index += 1) {
      mockSnapshot = pregame(`${first}-bounded-${index}`); await render(); close();
    }
    unmount(); await render(); expect(flow.visible).toBe(false);
    mockSnapshot = pregame(first); await render(); expect(flow.visible).toBe(true);
  });

  it("lets a new match select and lock without waiting for an obsolete hanging action", async () => {
    const old = deferred<LockCharacterResponse>(); mockLock.mockReturnValueOnce(old.promise);
    await render(); select(); let first!: Promise<unknown>; act(() => { first = flow.onLock(); });
    const oldResponse = mockSnapshot.pregameMatch!;
    mockSnapshot = pregame(`${mockSnapshot.matchId}-replacement`); mockLock.mockResolvedValue(mockSnapshot.pregameMatch); await render();
    select("other"); expect(flow.selectedAgentId).toBe("other");
    await act(async () => { await flow.onLock(); }); expect(mockLock).toHaveBeenCalledTimes(2); expect(mockEnter).toHaveBeenCalledTimes(1);
    await act(async () => { old.resolve(oldResponse); await first; }); expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it.each(["account", "access", "generation", "blur", "background", "unmount"])("does not navigate again after confirmed entry and refresh invalidation by %s", async (kind) => {
    const refreshed = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(refreshed.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    await act(async () => { await Promise.resolve(); }); expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockEnter).toHaveBeenCalledTimes(1);
    const response = mockSnapshot;
    if (kind === "account") mockUser = account("new-account");
    if (kind === "access") mockUser = { ...mockUser, accessToken: "renewed" };
    if (kind === "generation") invalidateSessionOperations();
    if (kind === "blur") mockFocused = false;
    if (kind === "background") await act(async () => { AppState.currentState = "background"; changeState("background"); });
    if (kind === "unmount") unmount(); else await render();
    await act(async () => { refreshed.resolve(response); await task; }); expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it("keeps a validated lock successful when the best-effort refresh rejects", async () => {
    const receipt = lockedReceipt(mockSnapshot); mockLock.mockResolvedValueOnce(receipt);
    mockFetch.mockRejectedValueOnce(new Error("refresh offline after successful lock"));
    await render(); select(); await act(async () => { await flow.onLock(); });
    expect(mockFetch).toHaveBeenCalledTimes(1); expect(mockEnter).toHaveBeenCalledTimes(1);
    expect(flow.visible).toBe(false); expect(flow.locking).toBe(false); expect(flow.errorMessage).toBeNull();
    expect(flow.selectedAgentId).toBe("agent");
    act(() => flow.onOpen()); expect(flow.visible).toBe(false);
    unmount(); await render(); expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it.each(["live", "idle"] as const)("enters once on the validated receipt despite a follow-up %s snapshot", async (phase) => {
    const id = mockSnapshot.matchId!; mockLock.mockResolvedValueOnce(lockedReceipt(mockSnapshot));
    mockFetch.mockImplementationOnce(async () => {
      mockSnapshot = phase === "live" ? live(id) : { ...mockSnapshot, state: "idle", matchId: null, pregameMatch: null };
      return mockSnapshot;
    });
    await render(); select(); await act(async () => { await flow.onLock(); });
    expect(mockEnter).toHaveBeenCalledTimes(1); expect(flow.errorMessage).toBeNull();
    expect(flow.visible).toBe(false); expect(flow.locking).toBe(false);
    await render(); expect(mockEnter).toHaveBeenCalledTimes(1);
    if (phase === "idle") { mockSnapshot = live(id); await render(); expect(mockEnter).toHaveBeenCalledTimes(1); }
    expect(mockLock).toHaveBeenCalledTimes(1);
  });

  it("accepts a validated bound receipt if the same match is already live before React rerenders", async () => {
    const old = deferred<LockCharacterResponse>(); mockLock.mockReturnValueOnce(old.promise);
    const id = mockSnapshot.matchId!; const receipt = lockedReceipt(mockSnapshot);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    mockSnapshot = live(id);
    await act(async () => { old.resolve(receipt); await task; });
    expect(mockEnter).toHaveBeenCalledTimes(1); expect(flow.visible).toBe(false); expect(flow.errorMessage).toBeNull();
    await render(); expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it("does not revive an old action across background/foreground events batched before render", async () => {
    const old = deferred<LockCharacterResponse>(); mockLock.mockReturnValueOnce(old.promise);
    await render(); select(); let task!: Promise<unknown>; act(() => { task = flow.onLock(); });
    await act(async () => {
      AppState.currentState = "background"; changeState("background");
      AppState.currentState = "active"; changeState("active");
      old.resolve(mockSnapshot.pregameMatch!); await task;
    });
    expect(mockFetch).not.toHaveBeenCalled(); expect(mockEnter).not.toHaveBeenCalled();
  });
});
