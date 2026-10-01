import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { usePartyController } from "~/features/party/usePartyController";
import type { CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { useRiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useChatStore } from "~/utils/chat-store";
import { Share } from "react-native";

const account = (id: string) => ({ id, region: "ap", accessToken: `access-${id}`, entitlementsToken: `ent-${id}`, name: id, TagLine: "AP", progress: { level: 0 } });
let mockUser = account("self");
let mockEnabled = true;
let mockGeneration = 0;
let mockOwner: string | null = null;
let mockTranslations: Record<string, string> = {};
const mockTranslate = (key: string, options?: { defaultValue?: string }) => mockTranslations[key] ?? options?.defaultValue ?? key;
const snapshot = (): CombatSessionSnapshot => ({ state: "idle", matchId: null, pregameMatch: null, currentGameMatch: null, partyId: "party", namesBySubject: {}, party: { ID: "party", State: "DEFAULT", EligibleQueues: ["competitive", "swiftplay"], MatchmakingData: { QueueID: "competitive" }, Members: [{ Subject: "self", IsReady: true, IsOwner: true }] } });
let mockSnapshot = snapshot();
const mockFetch = jest.fn();
const mockReadParty = jest.fn();
const mockQueue = jest.fn();
const mockPrivacy = jest.fn();
const mockInvite = jest.fn();
const mockJoin = jest.fn();
const mockStart = jest.fn();
const mockCancel = jest.fn();
const mockLeave = jest.fn();
const mockReady = jest.fn();
const mockCode = jest.fn();
const mockDisableCode = jest.fn();
const mockCopy = jest.fn();
const mockMakeCustom = jest.fn();
const mockMakeDefault = jest.fn();
const mockCustomStart = jest.fn();
const customParty = () => ({ ...snapshot().party!, Version: 2, State: "CUSTOM_GAME_SETUP", EligibleQueues: [], MatchmakingData: { QueueID: "" }, CustomGameData: { Settings: { Map: "actual-map", Mode: "actual-mode", GameRules: null } } });
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: Object.assign(<T,>(select: (state: { user: typeof mockUser }) => T) => select({ user: mockUser }), { getState: () => ({ user: mockUser }) }) }));
jest.mock("~/hooks/useCombatStore", () => ({ useCombatStore: Object.assign(<T,>(select: (state: { snapshot: CombatSessionSnapshot; sessionKey: string; fetchSession: typeof mockFetch }) => T) => select({ snapshot: mockSnapshot, sessionKey: mockOwner ?? `ap|${mockUser.id}`, fetchSession: mockFetch }), { getState: () => ({ snapshot: mockSnapshot, sessionKey: mockOwner ?? `ap|${mockUser.id}`, fetchSession: mockFetch }) }) }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: <T,>(select: (state: { cacheByAuth: object }) => T) => select({ cacheByAuth: {} }) }));
jest.mock("~/utils/session-operations", () => ({ getSessionGeneration: () => mockGeneration }));
jest.mock("~/services/riot/party-api", () => ({ ...jest.requireActual("~/services/riot/party-api"), joinPartyWithCode: (...args: unknown[]) => mockJoin(...args), getPartyState: (...args: unknown[]) => mockReadParty(...args), setPartyQueue: (...args: unknown[]) => mockQueue(...args), setPartyAccessibility: (...args: unknown[]) => mockPrivacy(...args), invitePartyFriend: (...args: unknown[]) => mockInvite(...args) }));
jest.mock("~/services/riot/party-custom-api", () => ({ makePartyCustom: (...args: unknown[]) => mockMakeCustom(...args), makePartyDefault: (...args: unknown[]) => mockMakeDefault(...args), startPartyCustomGame: (...args: unknown[]) => mockCustomStart(...args) }));
jest.mock("~/services/riot/combat-api", () => ({ enterMatchmakingQueue: (...args: unknown[]) => mockStart(...args), leaveMatchmakingQueue: (...args: unknown[]) => mockCancel(...args), removeFromParty: (...args: unknown[]) => mockLeave(...args), setPartyReady: (...args: unknown[]) => mockReady(...args), generatePartyInviteCode: (...args: unknown[]) => mockCode(...args), disablePartyInviteCode: (...args: unknown[]) => mockDisableCode(...args) }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ cards: [], competitiveTiers: [] }) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: (...args: unknown[]) => mockCopy(...args) }));
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: mockTranslate }) }));
let result: ReturnType<typeof usePartyController>;
function Probe() {
  const session = useRiotScreenSession(mockUser);
  const controller = usePartyController({ session, snapshot: mockSnapshot, enabled: mockEnabled });
  React.useLayoutEffect(() => { result = controller; }, [controller]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function observeAction(action: void | Promise<unknown>) {
  const outcome = { settled: false, value: undefined as unknown };
  const promise = Promise.resolve(action).then((value) => { outcome.settled = true; outcome.value = value; return value; });
  return { outcome, promise };
}

describe("party controller action and refresh ownership", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<Probe />); }); };
  const update = async () => { await act(async () => { renderer.update(<Probe />); }); };
  const advance = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  beforeEach(() => {
    jest.useFakeTimers(); mockUser = account("self"); mockEnabled = true; mockGeneration = 0; mockOwner = null; mockTranslations = {}; mockSnapshot = snapshot();
    mockFetch.mockReset().mockImplementation(async () => mockSnapshot);
    mockReadParty.mockReset().mockImplementation(async () => mockSnapshot.party);
    [mockQueue, mockPrivacy, mockInvite, mockStart, mockCancel, mockReady, mockCode, mockDisableCode].forEach((mock) => mock.mockReset().mockResolvedValue({ ID: "party", Members: [] }));
    mockLeave.mockReset().mockResolvedValue(undefined); mockCopy.mockReset().mockResolvedValue(undefined);
    mockJoin.mockReset().mockResolvedValue({ CurrentPartyID: "joined" });
    jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction });
    mockMakeCustom.mockReset().mockImplementation(async () => customParty());
    mockMakeDefault.mockReset().mockImplementation(async (_session: unknown, _party: string, queue: string) => ({ ...snapshot().party!, Version: 3, MatchmakingData: { QueueID: queue } }));
    mockCustomStart.mockReset().mockImplementation(async () => ({ ...customParty(), Version: 3, State: "CUSTOM_GAME_STARTING" }));
    useChatStore.getState().resetChatSession();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
  it("polls every 3s only while enabled and shares a pending manual refresh", async () => {
    await mount(); expect(mockFetch).toHaveBeenCalledTimes(1);
    await advance(2999); expect(mockFetch).toHaveBeenCalledTimes(1);
    await advance(1); expect(mockFetch).toHaveBeenCalledTimes(2);
    const pending = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(pending.promise);
    let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => { first = Promise.resolve(result.actions.onRefresh()); second = Promise.resolve(result.actions.onRefresh()); });
    await advance(10_000); expect(mockFetch).toHaveBeenCalledTimes(3);
    await act(async () => { pending.resolve(mockSnapshot); await Promise.all([first, second]); });
    mockEnabled = false; await update(); await advance(10_000); expect(mockFetch).toHaveBeenCalledTimes(3);
    await act(async () => { await result.actions.onRefresh(); }); expect(mockFetch).toHaveBeenCalledTimes(3);
  });
  it("shares only the current code and treats dismissal as success", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "current-code" } }; await mount();
    await act(async () => { expect(await result.actions.onShareCode()).toBe(true); });
    expect(Share.share).toHaveBeenCalledWith({ message: "current-code" });
    expect(result.errorMessage).toBeNull(); expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it("generates rather than disabling an existing code", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "existing" } }; await mount();
    await act(async () => { await result.actions.onGenerateCode(); });
    expect(mockCode).toHaveBeenCalledTimes(1); expect(mockDisableCode).not.toHaveBeenCalled();
  });
  it.each(["", "name", "#tag", "name#", "name#tag#extra", "name\n#tag", "n".repeat(257) + "#tag"])("rejects invalid manual invite %p before transport", async (name) => {
    await mount(); await act(async () => { expect(await result.actions.onInviteByName(name)).toBe(false); });
    expect(mockInvite).not.toHaveBeenCalled(); expect(result.errorMessage).toBeTruthy();
  });
  it("invites a trimmed Riot ID only with management authority", async () => {
    await mount(); await act(async () => { await result.actions.onInviteByName(" Name # Tag "); });
    expect(mockInvite).toHaveBeenCalledWith(expect.anything(), "party", "Name", "Tag");
  });
  it("accepts join acknowledgement immediately, hides the old party and blocks retained actions", async () => {
    await mount(); const old = result.actions; const follow = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(follow.promise);
    await act(async () => { expect(await old.onJoinCode(" code ")).toEqual({ CurrentPartyID: "joined" }); });
    expect(result.busyAction).toBeNull(); expect(result.model.partyId).toBe("joined"); expect(result.model.members).toEqual([]);
    await act(async () => { await old.onReady(false); await result.actions.onJoinCode("second"); });
    expect(mockReady).not.toHaveBeenCalled(); expect(mockJoin).toHaveBeenCalledTimes(1);
    await advance(0); await act(async () => { follow.reject(new Error("network")); });
    expect(result.model.partyId).toBe("joined"); expect(result.errorMessage).not.toMatch(/action failed/i);
  });
  it("joins confirmed absence and handles failure without inventing a party", async () => {
    mockSnapshot = { ...mockSnapshot, party: null, partyId: null }; mockReadParty.mockResolvedValue(null); await mount();
    mockJoin.mockRejectedValueOnce(new Error("network"));
    await act(async () => { expect(await result.actions.onJoinCode("code")).toBe(false); });
    expect(result.errorMessage).toMatch(/join/i); expect(result.model.partyId).toBeNull();
    await act(async () => { expect(await result.actions.onJoinCode("code")).toEqual({ CurrentPartyID: "joined" }); });
  });
  it("blocks unconfirmed absence while the initial read is pending", async () => {
    mockSnapshot = { ...mockSnapshot, party: null, partyId: null };
    const initial = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(initial.promise);
    await mount(); expect(result.model.canJoinParty).toBe(false);
    await act(async () => { expect(await result.actions.onJoinCode("code")).toBe(false); }); expect(mockJoin).not.toHaveBeenCalled();
    await act(async () => { initial.resolve(mockSnapshot); });
  });
  it("allows a sequential join only after confirming the expected new party", async () => {
    await mount(); const retained = result.actions;
    await act(async () => { await result.actions.onJoinCode("first"); });
    mockSnapshot = { ...mockSnapshot, partyId: "joined", party: { ...mockSnapshot.party!, ID: "joined" } };
    await update(); await advance(0); expect(result.model.canJoinParty).toBe(true);
    await act(async () => { expect(await retained.onJoinCode("stale")).toBe(false); });
    mockJoin.mockResolvedValueOnce({ CurrentPartyID: "second" });
    await act(async () => { expect(await result.actions.onJoinCode("next")).toEqual({ CurrentPartyID: "second" }); });
    expect(result.model.partyId).toBe("second"); expect(mockJoin).toHaveBeenCalledTimes(2);
  });
  it("retires a confirmed join transition so confirmed departure can appear", async () => {
    await mount(); await act(async () => { await result.actions.onJoinCode("code"); });
    mockSnapshot = { ...mockSnapshot, partyId: "joined", party: { ...mockSnapshot.party!, ID: "joined" } }; await update(); await advance(0);
    mockSnapshot = { ...mockSnapshot, partyId: null, party: null }; mockReadParty.mockResolvedValueOnce(null); await update();
    await act(async () => { await result.actions.onRefresh(); }); expect(result.model.partyId).toBeNull();
  });
  it("accepts join if discovery reached the same destination before the acknowledgement", async () => {
    await mount(); const post = deferred<{ CurrentPartyID: string }>(); mockJoin.mockReturnValueOnce(post.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onJoinCode("code")); });
    mockSnapshot = { ...mockSnapshot, partyId: "joined", party: { ...mockSnapshot.party!, ID: "joined" } }; await update();
    await act(async () => { post.resolve({ CurrentPartyID: "joined" }); expect(await action).toEqual({ CurrentPartyID: "joined" }); });
  });
  it("blocks manual invite for nonleaders and shares no unavailable code", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: true, IsOwner: false }] } };
    await mount(); await act(async () => { expect(await result.actions.onInviteByName("Name#Tag")).toBe(false); expect(await result.actions.onShareCode()).toBe(false); });
    expect(mockInvite).not.toHaveBeenCalled(); expect(Share.share).not.toHaveBeenCalled();
  });
  it("reports native share failure and rejects invalid join input without transport", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "code" } }; await mount();
    jest.mocked(Share.share).mockRejectedValueOnce(new Error("native"));
    await act(async () => { expect(await result.actions.onShareCode()).toBe(false); });
    expect(result.errorMessage).toBeTruthy();
    await act(async () => { expect(await result.actions.onJoinCode("bad\ncode")).toBe(false); });
    expect(mockJoin).not.toHaveBeenCalled();
  });
  it.each(["token", "region"] as const)("blocks retained join/share/invite after %s rotation", async (change) => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "code" } }; await mount(); const retained = result.actions;
    mockUser = { ...mockUser, ...(change === "token" ? { accessToken: "new-token" } : { region: "eu" }) };
    await act(async () => { await retained.onJoinCode("code"); await retained.onShareCode(); await retained.onInviteByName("Name#Tag"); });
    expect(mockJoin).not.toHaveBeenCalled(); expect(Share.share).not.toHaveBeenCalled(); expect(mockInvite).not.toHaveBeenCalled();
  });
  it("waits for an old pending read only in the background and never displays its old party", async () => {
    await mount(); const oldRead = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(oldRead.promise);
    act(() => { void result.actions.onRefresh(); });
    await act(async () => { expect(await result.actions.onJoinCode("code")).toEqual({ CurrentPartyID: "joined" }); });
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => { oldRead.resolve(mockSnapshot); });
    expect(result.model.partyId).toBe("joined"); expect(result.model.members).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
  it.each(["pregame", "live", "queue"] as const)("blocks join in %s", async (phase) => {
    mockSnapshot = phase === "queue" ? { ...mockSnapshot, party: { ...mockSnapshot.party!, State: "MATCHMAKING" } } : { ...mockSnapshot, state: phase };
    await mount(); await act(async () => { expect(await result.actions.onJoinCode("code")).toBe(false); }); expect(mockJoin).not.toHaveBeenCalled();
  });
  it.each(["account", "party", "live", "focus", "generation"] as const)("discards pending join after %s changes", async (change) => {
    await mount(); const post = deferred<{ CurrentPartyID: string }>(); mockJoin.mockReturnValueOnce(post.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onJoinCode("code")); void result.actions.onJoinCode("code"); });
    if (change === "account") mockUser = account("other");
    if (change === "party") mockSnapshot = { ...mockSnapshot, partyId: "other", party: { ...mockSnapshot.party!, ID: "other" } };
    if (change === "live") mockSnapshot = { ...mockSnapshot, state: "live" };
    if (change === "focus") mockEnabled = false;
    if (change === "generation") mockGeneration++;
    await update(); await act(async () => { post.resolve({ CurrentPartyID: "joined" }); expect(await action).toBe(false); });
    expect(mockJoin).toHaveBeenCalledTimes(1); expect(result.model.partyId).not.toBe("joined");
  });
  it("shows ready immediately while keeping authority and duplicate guards until acknowledgement", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: false, IsOwner: true }] } };
    await mount();
    const pending = deferred<object>(); mockReady.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>;
    act(() => { action = Promise.resolve(result.actions.onReady(true)); void result.actions.onReady(true); });
    expect(result.model.members.find((member) => member.isSelf)?.ready).toBe(true);
    expect(result.model.canStartQueue).toBe(false);
    expect(mockSnapshot.party?.Members[0].IsReady).toBe(false);
    expect(result.busyAction).toBe("ready"); expect(mockReady).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ ...mockSnapshot.party!, Version: 2, Members: [{ Subject: "self", IsReady: true, IsOwner: true }] }); await action; });
    expect(result.model.members[0].ready).toBe(true); expect(result.busyAction).toBeNull();
    await advance(0); expect(result.model.members[0].ready).toBe(true);
  });

  it.each(["pregame", "live"] as const)("accepts ready/start receipts after a same-session %s transition without resurrecting Party", async (state) => {
    for (const kind of ["ready", "start", "custom"] as const) {
      mockSnapshot = kind === "custom" ? { ...snapshot(), party: customParty() } : snapshot();
      await mount();
      const pending = deferred<object>();
      const operation = kind === "ready" ? mockReady : kind === "start" ? mockStart : mockCustomStart;
      operation.mockReturnValueOnce(pending.promise);
      const confirmed = { ...mockSnapshot.party!, State: kind === "custom" ? "CUSTOM_GAME_STARTING" : "MATCHMAKING",
        Members: [{ Subject: "self", IsReady: kind !== "ready", IsOwner: true }] };
      let action!: Promise<unknown>;
      act(() => { action = Promise.resolve(kind === "ready" ? result.actions.onReady(false) : result.actions.onStartQueue()); });
      mockSnapshot = { ...mockSnapshot, state, matchId: "match", party: null, partyId: null }; await update();
      await act(async () => { pending.resolve(confirmed); expect(await action).toEqual(confirmed); });
      expect(result.model.partyId).toBeNull(); expect(result.model.members).toEqual([]); expect(result.busyAction).toBeNull();
      expect(result.errorMessage).toBeNull();
      act(() => renderer.unmount());
    }
  });

  it("does not accept Ready after idle party disappearance", async () => {
    await mount(); const pending = deferred<object>(); mockReady.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onReady(false)); });
    mockSnapshot = { ...mockSnapshot, party: null, partyId: null }; await update();
    await act(async () => { pending.resolve({ ...snapshot().party!, Members: [{ Subject: "self", IsReady: false }] }); expect(await action).toBe(false); });
  });

  it.each([undefined, 2])("expires mismatching Ready receipt after its fresh-read budget (version %s)", async (Version) => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Version } };
    await mount();
    const confirmed = { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: false, IsOwner: true }] };
    mockReady.mockResolvedValueOnce(confirmed);
    await act(async () => { await result.actions.onReady(false); });
    await advance(0); expect(result.model.members[0].ready).toBe(false);
    await advance(6000); expect(result.model.members[0].ready).toBe(false);
    await act(async () => { await result.actions.onRefresh(); });
    expect(result.model.members[0].ready).toBe(true); expect(result.model.canStartQueue).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it("keeps a newer receipt read-only after repeated strictly older versions, then resolves on a fresh matching version", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Version: 1 } };
    await mount(); const retainedJoin = result.actions.onJoinCode;
    const confirmed = { ...mockSnapshot.party!, Version: 2, Members: [{ Subject: "self", IsReady: false, IsOwner: true }] };
    mockReady.mockResolvedValueOnce(confirmed);
    await act(async () => { await result.actions.onReady(false); });
    await advance(0); await advance(9000);
    expect(result.model.members[0].ready).toBe(false); expect(result.model.canReady).toBe(false); expect(result.model.canManage).toBe(false);
    const before = mockReady.mock.calls.length;
    await act(async () => { await result.actions.onReady(true); }); expect(mockReady).toHaveBeenCalledTimes(before);
    await act(async () => { expect(await retainedJoin("ABC123")).toBe(false); expect(await result.actions.onJoinCode("ABC123")).toBe(false); });
    expect(mockJoin).not.toHaveBeenCalled();
    mockSnapshot = { ...mockSnapshot, party: confirmed };
    await act(async () => { await result.actions.onRefresh(); });
    expect(result.model.canReady).toBe(true); expect(result.model.canManage).toBe(true); expect(result.errorMessage).toBeNull();
    await act(async () => { await result.actions.onJoinCode("ABC123"); }); expect(mockJoin).toHaveBeenCalledTimes(1);
  });

  it("rechecks strictly older uncertainty before accepting a pending Join", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Version: 2 } };
    await mount(); const confirmed = { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: false, IsOwner: true }] };
    mockReady.mockResolvedValueOnce(confirmed); await act(async () => { await result.actions.onReady(false); });
    await advance(0); await advance(6000);
    const pending = deferred<{ CurrentPartyID: string }>(); mockJoin.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onJoinCode("ABC123")); });
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Version: 1 } }; await update();
    await act(async () => { pending.resolve({ CurrentPartyID: "joined" }); expect(await action).toBe(false); });
    expect(result.model.partyId).toBe("party");
  });

  it.each(["network", "null", "contradictory"])("rolls optimistic ready back on %s failure", async (failure) => {
    await mount(); const pending = deferred<object | null>(); mockReady.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onReady(false)); });
    expect(result.model.members[0].ready).toBe(false);
    await act(async () => {
      if (failure === "network") pending.reject(new Error("network"));
      else pending.resolve(failure === "null" ? null : mockSnapshot.party);
      expect(await action).toBe(false);
    });
    expect(result.model.members[0].ready).toBe(true); expect(result.busyAction).toBeNull(); expect(result.errorMessage).toBeTruthy();
  });

  it("discards pending ready presentation after party/focus changes", async () => {
    await mount(); const pending = deferred<object>(); mockReady.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onReady(false)); });
    expect(result.model.members[0].ready).toBe(false);
    mockEnabled = false; await update(); expect(result.model.members[0].ready).toBe(true);
    mockEnabled = true; mockSnapshot = { ...mockSnapshot, partyId: "new", party: { ...mockSnapshot.party!, ID: "new" } }; await update();
    expect(result.model.members[0].ready).toBe(true);
    await act(async () => { pending.resolve({ ...snapshot().party!, Members: [{ Subject: "self", IsReady: false }] }); await action; });
    expect(result.model.partyId).toBe("new"); expect(result.model.members[0].ready).toBe(true); expect(result.errorMessage).toBeNull();
  });

  it("retains a good party after a nullable combat response and failed strict read", async () => {
    await mount();
    mockFetch.mockResolvedValueOnce({ ...mockSnapshot, party: null, partyId: null }); mockReadParty.mockRejectedValueOnce(new Error("network"));
    await act(async () => { await result.actions.onRefresh(); });
    expect(result.model.partyId).toBe("party"); expect(result.errorMessage).toBeTruthy();
    mockFetch.mockResolvedValueOnce({ ...mockSnapshot, party: null, partyId: null }); mockReadParty.mockResolvedValueOnce(null);
    await act(async () => { await result.actions.onRefresh(); });
    expect(result.model.partyId).toBeNull();
  });
  it("does no mutations on mount/poll; deduplicates presses and refreshes after success", async () => {
    await mount(); await advance(3000); expect(mockQueue).not.toHaveBeenCalled(); expect(mockStart).not.toHaveBeenCalled();
    const pending = deferred<object>(); mockQueue.mockReturnValueOnce(pending.promise);
    let first!: Promise<unknown>;
    act(() => { first = Promise.resolve(result.actions.onQueueChange("swiftplay")); void result.actions.onQueueChange("swiftplay"); });
    expect(mockQueue).toHaveBeenCalledTimes(1); expect(result.busyAction).toBe("queue");
    await act(async () => { pending.resolve({ ID: "party" }); await first; });
    expect(result.busyAction).toBeNull(); expect(mockFetch).toHaveBeenCalledTimes(2);
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(3);
  });
  it("blocks stale retained actions after blur/account/token/generation/party changes", async () => {
    await mount(); const actions = result.actions;
    mockEnabled = false; await update(); await act(async () => { await actions.onStartQueue(); }); expect(mockStart).not.toHaveBeenCalled();
    mockEnabled = true; await update(); mockUser = account("other"); await act(async () => { await actions.onStartQueue(); }); expect(mockStart).not.toHaveBeenCalled();
    mockUser = account("self"); mockUser.accessToken = "rotated"; await act(async () => { await actions.onStartQueue(); }); expect(mockStart).not.toHaveBeenCalled();
    mockUser = account("self"); mockGeneration++; await act(async () => { await actions.onStartQueue(); }); expect(mockStart).not.toHaveBeenCalled();
    await update(); const current = result.actions; mockSnapshot = { ...mockSnapshot, partyId: "changed", party: { ...mockSnapshot.party!, ID: "changed" } };
    await act(async () => { await current.onStartQueue(); }); expect(mockStart).not.toHaveBeenCalled();
  });
  it("does not refresh or show a stale mutation error in another account", async () => {
    await mount(); const pending = deferred<never>(); mockStart.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onStartQueue()); });
    mockUser = account("other"); mockSnapshot = { ...snapshot(), party: null, partyId: null }; await update();
    const before = mockFetch.mock.calls.length;
    await act(async () => { pending.reject(new Error("old secret")); await action; });
    expect(mockFetch).toHaveBeenCalledTimes(before); expect(result.errorMessage).toBeNull(); expect(result.model.members).toEqual([]);
  });
  it("rejects null mutation results and keeps authoritative model unchanged", async () => {
    await mount(); mockPrivacy.mockResolvedValueOnce(null);
    await act(async () => { expect(await result.actions.onPrivacyChange("CLOSED")).toBe(false); });
    expect(result.errorMessage).toBeTruthy(); expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it("resolves invitation from the live friend Riot ID and never invites party members", async () => {
    useChatStore.getState().setStatus("authenticated");
    useChatStore.getState().setFriends([{ id: "friend", gameName: "Name", tagLine: "AP", status: "", show: "chat" }]);
    await mount();
    act(() => { useChatStore.getState().updateFriendNames([{ id: "friend", gameName: "Changed", tagLine: "VN" }]); });
    await act(async () => { await result.actions.onInvite("friend"); });
    expect(mockInvite).toHaveBeenCalledWith(expect.objectContaining({ id: "self" }), "party", "Changed", "VN");
    await act(async () => { await result.actions.onInvite("self"); }); expect(mockInvite).toHaveBeenCalledTimes(1);
  });
  it("guards eligibility and leader-only management", async () => {
    await mount(); await act(async () => { await result.actions.onQueueChange("unsupported"); }); expect(mockQueue).not.toHaveBeenCalled();
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: true }] } }; await update();
    await act(async () => { await result.actions.onStartQueue(); await result.actions.onPrivacyChange("OPEN"); });
    expect(mockStart).not.toHaveBeenCalled(); expect(mockPrivacy).not.toHaveBeenCalled();
  });
  it("retains good data when legacy polling publishes null into route props before strict read fails", async () => {
    await mount(); const pending = deferred<never>(); mockReadParty.mockReturnValueOnce(pending.promise);
    mockFetch.mockImplementationOnce(async () => { mockSnapshot = { ...mockSnapshot, party: null, partyId: null }; return mockSnapshot; });
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onRefresh()); });
    await update();
    expect(result.model.partyId).toBe("party");
    await act(async () => { pending.reject(new Error("temporary")); await action; });
    expect(result.model.partyId).toBe("party");
  });
  it("does not show a stale action failure after the party changes", async () => {
    await mount(); const pending = deferred<never>(); mockStart.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onStartQueue()); });
    mockSnapshot = { ...mockSnapshot, partyId: "new", party: { ...mockSnapshot.party!, ID: "new" } }; await update();
    await act(async () => { pending.reject(new Error("old failure")); await action; });
    expect(result.errorMessage).toBeNull();
  });
  it("fetches after mutation settlement even if an older read wave was pending", async () => {
    await mount(); const old = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(old.promise);
    act(() => { void result.actions.onRefresh(); });
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onPrivacyChange("OPEN")); });
    await act(async () => { old.resolve(mockSnapshot); await action; });
    await advance(0);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
  it("hides an old account snapshot while the new owner refresh is pending", async () => {
    await mount(); mockUser = account("other"); mockOwner = "ap|self";
    mockFetch.mockReturnValueOnce(deferred<CombatSessionSnapshot>().promise);
    await update();
    expect(result.model.members).toEqual([]); expect(result.model.partyId).toBeNull();
  });
  it("never cancels matchmaking after pregame/live detection, even with lingering party queue state", async () => {
    mockSnapshot = { ...mockSnapshot, state: "pregame", party: { ...mockSnapshot.party!, State: "MATCHMAKING" } }; await mount();
    await act(async () => { await result.actions.onCancelQueue(); }); expect(mockCancel).not.toHaveBeenCalled();
  });
  it("waits for an old account refresh before starting a new wave", async () => {
    const old = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(old.promise); await mount();
    mockUser = account("other"); mockSnapshot = { ...snapshot(), party: null, partyId: null }; await update();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => { old.resolve(snapshot()); });
    await advance(3000);
    expect(mockFetch).toHaveBeenCalledTimes(2); expect(result.model.partyId).toBeNull();
  });
  it("drops old focus completions and clears stale busy UI after blur/refocus", async () => {
    await mount(); const old = deferred<object>(); mockStart.mockReturnValueOnce(old.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onStartQueue()); });
    mockEnabled = false; await update(); mockEnabled = true; await update();
    expect(result.busyAction).toBeNull();
    const before = mockFetch.mock.calls.length;
    await act(async () => { old.resolve({ ID: "party" }); expect(await action).toBe(false); });
    expect(mockFetch).toHaveBeenCalledTimes(before);
  });
  it("does not spin the pull-to-refresh indicator for automatic polling", async () => {
    const pending = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(pending.promise); await mount();
    expect(result.refreshing).toBe(false);
    await act(async () => { pending.resolve(mockSnapshot); });
  });
  it("pauses new poll waves during mutations and ignores a pre-action read behind the queue receipt", async () => {
    await mount(); const old = deferred<CombatSessionSnapshot>(); const change = deferred<object>(); const fresh = deferred<CombatSessionSnapshot>();
    const original = mockSnapshot;
    mockFetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    await advance(3000); expect(result.refreshing).toBe(false);
    mockQueue.mockReturnValueOnce(change.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onQueueChange("swiftplay")); });
    await advance(9000); expect(mockFetch).toHaveBeenCalledTimes(2);
    const receipt = { ...original.party!, Version: 2, MatchmakingData: { QueueID: "swiftplay" } };
    await act(async () => { change.resolve(receipt); });
    expect(result.model.queueId).toBe("swiftplay");
    await advance(0);
    mockSnapshot = { ...original, party: { ...original.party!, Version: 1 } };
    await act(async () => { old.resolve(mockSnapshot); }); await update();
    expect(result.model.queueId).toBe("swiftplay"); expect(mockFetch).toHaveBeenCalledTimes(3);
    await act(async () => { fresh.resolve(mockSnapshot); await action; });
    expect(result.model.queueId).toBe("swiftplay");
  });
  it("uses a newer receipt for leader permissions until the legacy store catches up", async () => {
    await mount();
    mockPrivacy.mockResolvedValueOnce({ ...mockSnapshot.party!, Version: 2, Members: [{ Subject: "self", IsReady: true, IsOwner: false }] });
    await act(async () => { await result.actions.onPrivacyChange("OPEN"); });
    await act(async () => { await result.actions.onStartQueue(); });
    expect(mockStart).not.toHaveBeenCalled();
  });
  it("localizes queue labels and known friend activity while preserving real queue IDs", async () => {
    mockTranslations = { "session_labels.queue.competitive": "Xếp hạng", "session_labels.queue.swiftplay": "Đấu nhanh", "friends_page.in_game": "Trong trận" };
    const store = useChatStore.getState(); store.setStatus("authenticated");
    store.setFriends([{ id: "friend", gameName: "Name", tagLine: "AP", show: "chat", status: "", presence: { sessionLoopState: "INGAME" } }]);
    await mount();
    expect(result.model.queueLabel).toBe("Xếp hạng");
    expect(result.model.queueOptions).toEqual([{ id: "competitive", label: "Xếp hạng", enabled: true }, { id: "swiftplay", label: "Đấu nhanh", enabled: true }, { id: "custom", label: "Custom", enabled: true }]);
    expect(result.model.friends[0].activityLabel).toBe("Trong trận");
  });
  it("preserves ready/leave/code operations and queues cancel only in matchmaking", async () => {
    await mount();
    await act(async () => { await result.actions.onReady(false); await result.actions.onGenerateCode(); await result.actions.onLeave(); });
    expect(mockReady).toHaveBeenCalledWith("access-self", "ent-self", "ap", "party", "self", false);
    expect(mockCode).toHaveBeenCalledTimes(1); expect(mockLeave).toHaveBeenCalledTimes(1);
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "code", State: "MATCHMAKING" } }; await update();
    await act(async () => { await result.actions.onCancelQueue(); await result.actions.onCopyCode(); });
    expect(mockCancel).toHaveBeenCalledTimes(1); expect(mockCopy).toHaveBeenCalledWith("code");
  });
  it("renders Custom only after accepted conversion, retains real normal choices, and never starts on selection", async () => {
    await mount(); const pending = deferred<object>(); mockMakeCustom.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onQueueChange("custom")); void result.actions.onQueueChange("custom"); });
    expect(mockMakeCustom).toHaveBeenCalledTimes(1); expect(result.model.queueId).toBe("competitive");
    expect(mockCustomStart).not.toHaveBeenCalled(); expect(mockStart).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(customParty()); await action; });
    expect(result.model.queueId).toBe("custom");
    expect(result.model.queueOptions.find((option) => option.id === "swiftplay")?.label).toBe("Swiftplay (previously available)");
    await act(async () => { await result.actions.onQueueChange("custom"); });
    expect(mockMakeCustom).toHaveBeenCalledTimes(1);
    await act(async () => { await result.actions.onQueueChange("swiftplay"); });
    expect(mockMakeDefault).toHaveBeenCalledWith(expect.objectContaining({ id: "self" }), "party", "swiftplay");
    expect(mockQueue).not.toHaveBeenCalled(); expect(result.model.queueId).toBe("swiftplay");
  });
  it("starts configured Custom only from explicit press and deduplicates presses", async () => {
    mockSnapshot = { ...mockSnapshot, party: customParty() }; await mount();
    expect(mockCustomStart).not.toHaveBeenCalled();
    const pending = deferred<object>(); mockCustomStart.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onStartQueue()); void result.actions.onStartQueue(); });
    expect(mockCustomStart).toHaveBeenCalledTimes(1); expect(mockStart).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ ...customParty(), Version: 3 }); await action; });
  });
  it("keeps Custom on rejected default conversion and original mode on unsupported custom conversion", async () => {
    await mount(); mockMakeCustom.mockRejectedValueOnce(new Error("HTTP 404"));
    await act(async () => { expect(await result.actions.onQueueChange("custom")).toBe(false); });
    expect(result.model.queueId).toBe("competitive");
    await act(async () => { await result.actions.onQueueChange("custom"); });
    mockMakeDefault.mockRejectedValueOnce(new Error("Wrong queue receipt"));
    await act(async () => { expect(await result.actions.onQueueChange("swiftplay")).toBe(false); });
    expect(result.model.queueId).toBe("custom"); expect(result.errorMessage).toBeTruthy();
  });
  it("suppresses stale Custom receipts after party/account changes and enforces leader guards", async () => {
    await mount(); const pending = deferred<object>(); mockMakeCustom.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onQueueChange("custom")); });
    mockSnapshot = { ...mockSnapshot, partyId: "other-party", party: { ...mockSnapshot.party!, ID: "other-party" } }; await update();
    await act(async () => { pending.resolve(customParty()); expect(await action).toBe(false); });
    expect(result.model.partyId).toBe("other-party"); expect(result.model.queueId).toBe("competitive");
    mockSnapshot = { ...snapshot(), party: { ...customParty(), Members: [{ Subject: "self", IsReady: true }] } }; await update();
    await act(async () => { await result.actions.onStartQueue(); }); expect(mockCustomStart).not.toHaveBeenCalled();
  });
  it("preserves ready, privacy, code and leave actions in Custom setup", async () => {
    mockSnapshot = { ...mockSnapshot, party: customParty() }; await mount();
    await act(async () => { await result.actions.onReady(false); await result.actions.onPrivacyChange("CLOSED"); await result.actions.onGenerateCode(); await result.actions.onLeave(); });
    expect(mockReady).toHaveBeenCalledTimes(1); expect(mockPrivacy).toHaveBeenCalledTimes(1); expect(mockCode).toHaveBeenCalledTimes(1); expect(mockLeave).toHaveBeenCalledTimes(1);
  });
  it("does not apply a Custom receipt or reuse normal queue history after account changes", async () => {
    await mount(); const pending = deferred<object>(); mockMakeCustom.mockReturnValueOnce(pending.promise);
    let action!: Promise<unknown>; act(() => { action = Promise.resolve(result.actions.onQueueChange("custom")); });
    mockUser = account("other"); mockSnapshot = { ...snapshot(), party: { ...customParty(), Members: [{ Subject: "other", IsReady: true, IsOwner: true }] } }; await update();
    await act(async () => { pending.resolve(customParty()); expect(await action).toBe(false); });
    expect(result.model.members[0].id).toBe("other"); expect(result.model.queueOptions.map((option) => option.id)).toEqual(["custom"]);
  });
  it("localizes Custom and the candidate qualification through existing queue translations", async () => {
    mockTranslations = { "session_labels.queue.custom": "Tùy chỉnh", "session_labels.queue.competitive": "Xếp hạng", "party_page.previously_available": "từng có" };
    await mount(); await act(async () => { await result.actions.onQueueChange("custom"); });
    expect(result.model.queueLabel).toBe("Tùy chỉnh");
    expect(result.model.queueOptions.find((option) => option.id === "competitive")?.label).toBe("Xếp hạng (từng có)");
  });
  it("uses only active-account progress for the hidden self level", async () => {
    mockUser = { ...mockUser, progress: { level: 345 } };
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Members: [{ Subject: "self", IsReady: true, IsOwner: true, PlayerIdentity: { HideAccountLevel: true, AccountLevel: 100 } }] } };
    await mount(); expect(result.model.members[0].level).toBe(345);
    mockUser = { ...account("other"), progress: { level: 900 } }; await update();
    expect(result.model.members[0].level).toBeUndefined();
  });
  it("finishes confirmed Start before a deferred follow-up read and never waits for the 3s poll", async () => {
    await mount(); const post = deferred<object>(); const follow = deferred<CombatSessionSnapshot>();
    const confirmed = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    mockStart.mockReturnValueOnce(post.promise); mockFetch.mockReturnValueOnce(follow.promise);
    let action!: ReturnType<typeof observeAction>;
    act(() => { action = observeAction(result.actions.onStartQueue()); void result.actions.onStartQueue(); });
    expect(mockStart).toHaveBeenCalledTimes(1); expect(action.outcome.settled).toBe(false); expect(result.model.isQueueing).toBe(false);
    await act(async () => { post.resolve(confirmed); });
    expect(action.outcome).toEqual({ settled: true, value: confirmed }); expect(result.busyAction).toBeNull();
    expect(result.model.isQueueing).toBe(true); expect(mockFetch).toHaveBeenCalledTimes(1);
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => { follow.resolve({ ...mockSnapshot, party: confirmed }); });
    await advance(3000); expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it("acknowledges Start while an older read is still pending and reconciles without overlapping waves", async () => {
    await mount(); const old = deferred<CombatSessionSnapshot>(); const follow = deferred<CombatSessionSnapshot>();
    mockFetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(follow.promise);
    act(() => { void result.actions.onRefresh(); });
    const confirmed = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" }; mockStart.mockResolvedValueOnce(confirmed);
    let action!: ReturnType<typeof observeAction>; await act(async () => { action = observeAction(result.actions.onStartQueue()); });
    expect(action.outcome).toEqual({ settled: true, value: confirmed }); expect(result.busyAction).toBeNull();
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => { old.resolve(mockSnapshot); }); expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.model.isQueueing).toBe(true);
    await act(async () => { follow.resolve({ ...mockSnapshot, party: confirmed }); });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it("does not turn accepted Start into action failure when background reconciliation fails", async () => {
    await mount(); const confirmed = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    mockStart.mockResolvedValueOnce(confirmed); mockFetch.mockRejectedValueOnce(new Error("network"));
    await act(async () => { expect(await result.actions.onStartQueue()).toEqual(confirmed); });
    expect(result.busyAction).toBeNull(); await advance(0);
    expect(result.model.isQueueing).toBe(true); expect(result.errorMessage).toMatch(/refresh/i); expect(result.errorMessage).not.toMatch(/action failed/i);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it("finishes Cancel immediately and prevents the preceding Start read from undoing its newer receipt", async () => {
    await mount(); const startRead = deferred<CombatSessionSnapshot>(); const cancelRead = deferred<CombatSessionSnapshot>();
    const started = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    const cancelled = { ...mockSnapshot.party!, Version: 3, State: "DEFAULT" };
    mockStart.mockResolvedValueOnce(started); mockCancel.mockResolvedValueOnce(cancelled);
    mockFetch.mockReturnValueOnce(startRead.promise).mockReturnValueOnce(cancelRead.promise);
    await act(async () => { expect(await result.actions.onStartQueue()).toEqual(started); }); await advance(0);
    let action!: ReturnType<typeof observeAction>; await act(async () => { action = observeAction(result.actions.onCancelQueue()); });
    expect(action.outcome).toEqual({ settled: true, value: cancelled }); expect(result.busyAction).toBeNull(); expect(result.model.isQueueing).toBe(false);
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => { startRead.resolve({ ...mockSnapshot, party: started }); }); expect(result.model.isQueueing).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    await act(async () => { cancelRead.reject(new Error("network")); });
    expect(result.model.isQueueing).toBe(false); expect(result.errorMessage).not.toMatch(/action failed/i);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(mockCancel).toHaveBeenCalledTimes(1);
  });
  it.each(["queue", "privacy", "ready"] as const)("finishes accepted %s without blocking on reconciliation", async (kind) => {
    await mount(); const follow = deferred<CombatSessionSnapshot>(); const confirmed = { ...mockSnapshot.party!, Version: 2,
      ...(kind === "ready" ? { Members: [{ Subject: "self", IsReady: false, IsOwner: true }] } : {}) };
    mockFetch.mockReturnValueOnce(follow.promise);
    const operation = kind === "queue" ? mockQueue : kind === "privacy" ? mockPrivacy : mockReady; operation.mockResolvedValueOnce(confirmed);
    let action!: ReturnType<typeof observeAction>;
    await act(async () => { action = observeAction(kind === "queue" ? result.actions.onQueueChange("swiftplay") : kind === "privacy" ? result.actions.onPrivacyChange("CLOSED") : result.actions.onReady(false)); });
    expect(action.outcome).toEqual({ settled: true, value: confirmed }); expect(result.busyAction).toBeNull(); expect(operation).toHaveBeenCalledTimes(1);
    await advance(0); await act(async () => { follow.resolve({ ...mockSnapshot, party: confirmed }); });
  });
  it("accepts void Leave without inventing absence and lets the follow-up read discover it", async () => {
    await mount(); const follow = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(follow.promise); mockReadParty.mockResolvedValueOnce(null);
    let action!: ReturnType<typeof observeAction>; await act(async () => { action = observeAction(result.actions.onLeave()); });
    expect(action.outcome).toEqual({ settled: true, value: true }); expect(result.model.partyId).toBe("party"); expect(result.busyAction).toBeNull();
    await advance(0); await act(async () => { follow.resolve({ ...mockSnapshot, partyId: null, party: null }); });
    expect(result.model.partyId).toBeNull(); expect(mockLeave).toHaveBeenCalledTimes(1);
  });
  it("cancels queued reconciliation on unmount and ignores it after party rotation", async () => {
    await mount(); mockStart.mockResolvedValueOnce({ ...mockSnapshot.party!, State: "MATCHMAKING", Version: 2 });
    await act(async () => { await result.actions.onStartQueue(); });
    mockSnapshot = { ...mockSnapshot, partyId: "other", party: { ...mockSnapshot.party!, ID: "other" } }; await update();
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(1);
    act(() => { renderer.unmount(); }); await advance(10_000); expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it("rejects a mismatched receipt rather than reporting a confirmed Start for another party", async () => {
    await mount(); mockStart.mockResolvedValueOnce({ ...mockSnapshot.party!, ID: "wrong-party", State: "MATCHMAKING" });
    await act(async () => { expect(await result.actions.onStartQueue()).toBe(false); });
    expect(result.errorMessage).toMatch(/action failed/i); await advance(0); expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it.each(["queue", "privacy", "ready", "custom"] as const)("does not silently roll back a versionless %s receipt during bounded confirmation", async (kind) => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, Accessibility: "OPEN" } }; await mount();
    const confirmed = kind === "custom" ? { ...customParty(), Version: undefined } : {
      ...mockSnapshot.party!, Version: undefined,
      ...(kind === "queue" ? { MatchmakingData: { QueueID: "swiftplay" } } : {}),
      ...(kind === "privacy" ? { Accessibility: "CLOSED" as const } : {}),
      ...(kind === "ready" ? { Members: [{ Subject: "self", IsReady: false, IsOwner: true }] } : {}),
    };
    const operation = kind === "custom" ? mockMakeCustom : kind === "queue" ? mockQueue : kind === "privacy" ? mockPrivacy : mockReady;
    operation.mockResolvedValueOnce(confirmed);
    await act(async () => {
      const action = kind === "custom" ? result.actions.onQueueChange("custom") : kind === "queue" ? result.actions.onQueueChange("swiftplay") : kind === "privacy" ? result.actions.onPrivacyChange("CLOSED") : result.actions.onReady(false);
      expect(await action).toEqual(confirmed);
    });
    await advance(0); await advance(6000);
    if (kind === "queue") expect(result.model.queueId).toBe("swiftplay");
    if (kind === "custom") expect(result.model.queueId).toBe("custom");
    if (kind === "privacy") expect(result.model.privacy).toBe("CLOSED");
    if (kind === "ready") expect(result.model.members[0].ready).toBe(false);
    expect(result.errorMessage).toMatch(/refresh|confirm/i); expect(result.errorMessage).not.toMatch(/action failed/i);
    expect(operation).toHaveBeenCalledTimes(1);
    mockFetch.mockResolvedValueOnce({ ...mockSnapshot, party: confirmed });
    await act(async () => { await result.actions.onRefresh(); }); expect(result.errorMessage).toBeNull();
  });
  it("keeps a confirmed Start successful when later reads confirm party absence", async () => {
    await mount(); const confirmed = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    mockStart.mockResolvedValueOnce(confirmed); mockFetch.mockResolvedValueOnce({ ...mockSnapshot, party: null, partyId: null }); mockReadParty.mockResolvedValueOnce(null);
    await act(async () => { expect(await result.actions.onStartQueue()).toEqual(confirmed); });
    expect(result.model.isQueueing).toBe(true); await advance(0);
    expect(result.model.partyId).toBeNull(); expect(result.errorMessage).toBeNull(); expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it("does not false-fail an accepted Start when the same party already reached pregame", async () => {
    await mount(); const post = deferred<object>(); const confirmed = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    mockStart.mockReturnValueOnce(post.promise); let action!: ReturnType<typeof observeAction>;
    act(() => { action = observeAction(result.actions.onStartQueue()); });
    mockSnapshot = { ...mockSnapshot, state: "pregame", matchId: "match" }; await update();
    await act(async () => { post.resolve(confirmed); });
    expect(action.outcome).toEqual({ settled: true, value: confirmed }); expect(result.errorMessage).toBeNull();
  });
  it("coalesces queued reconciliation behind the newest accepted action and allows a higher server version", async () => {
    await mount(); const queued = { ...mockSnapshot.party!, Version: 2, MatchmakingData: { QueueID: "swiftplay" } };
    const privateParty = { ...queued, Version: 3, Accessibility: "CLOSED" as const };
    mockQueue.mockResolvedValueOnce(queued); mockPrivacy.mockResolvedValueOnce(privateParty);
    const follow = deferred<CombatSessionSnapshot>(); mockFetch.mockReturnValueOnce(follow.promise);
    await act(async () => { await result.actions.onQueueChange("swiftplay"); await result.actions.onPrivacyChange("CLOSED"); });
    expect(result.model.queueId).toBe("swiftplay"); expect(result.model.privacy).toBe("CLOSED"); expect(mockFetch).toHaveBeenCalledTimes(1);
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(2);
    await act(async () => { follow.resolve({ ...mockSnapshot, party: { ...privateParty, Version: 4, Accessibility: "OPEN" } }); });
    expect(result.model.privacy).toBe("OPEN"); expect(mockQueue).toHaveBeenCalledTimes(1); expect(mockPrivacy).toHaveBeenCalledTimes(1);
  });
  it("copies locally without scheduling a snapshot reconciliation", async () => {
    mockSnapshot = { ...mockSnapshot, party: { ...mockSnapshot.party!, InviteCode: "code" } }; await mount();
    await act(async () => { expect(await result.actions.onCopyCode()).toBe(true); });
    await advance(0); expect(mockFetch).toHaveBeenCalledTimes(1); expect(mockCopy).toHaveBeenCalledTimes(1);
  });
  it("accepts void Leave if discovery already confirmed absence while the request was pending", async () => {
    await mount(); const post = deferred<void>(); mockLeave.mockReturnValueOnce(post.promise);
    let action!: ReturnType<typeof observeAction>; act(() => { action = observeAction(result.actions.onLeave()); });
    mockSnapshot = { ...mockSnapshot, party: null, partyId: null }; await update();
    await act(async () => { post.resolve(undefined); });
    expect(action.outcome).toEqual({ settled: true, value: true });
    mockReadParty.mockResolvedValueOnce(null); await advance(0); expect(result.model.partyId).toBeNull();
  });
  it("keeps the newest accepted receipt when an older read ties its numeric version", async () => {
    await mount(); const started = { ...mockSnapshot.party!, Version: 2, State: "MATCHMAKING" };
    const cancelled = { ...mockSnapshot.party!, Version: 2, State: "DEFAULT" };
    mockStart.mockResolvedValueOnce(started); mockCancel.mockResolvedValueOnce(cancelled);
    await act(async () => { await result.actions.onStartQueue(); await result.actions.onCancelQueue(); });
    mockSnapshot = { ...mockSnapshot, party: started }; await update();
    expect(result.model.isQueueing).toBe(false);
    await advance(0); expect(result.model.isQueueing).toBe(false);
  });
});
