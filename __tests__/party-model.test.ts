import { buildPartyViewModel } from "~/features/party/party-model";
import type { CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { useChatStore, type ChatFriend } from "~/utils/chat-store";

const session = { id: "self", region: "ap", accessToken: "test", entitlementsToken: "test" };
const makeSnapshot = (party: CombatSessionSnapshot["party"]): CombatSessionSnapshot => ({ state: "idle", partyId: party?.ID ?? null, party, matchId: null, pregameMatch: null, currentGameMatch: null, namesBySubject: { self: "Me#AP", friend: "Teammate#VN" } });
const party = { ID: "party", State: "DEFAULT", Accessibility: "OPEN" as const, MatchmakingData: { QueueID: "competitive", PreferredGamePods: ["selected", "other"] }, EligibleQueues: ["competitive", "swiftplay"], Members: [
  { Subject: "self", IsReady: true, IsOwner: true, CompetitiveTier: 18, PlayerIdentity: { PlayerCardID: "card", AccountLevel: 100 }, Pings: [{ GamePodID: "unselected", Ping: 1 }, { GamePodID: "selected", Ping: 42 }, { GamePodID: "other", Ping: 3 }] },
  { Subject: "friend", IsReady: true },
] };
const assets = { cards: [{ uuid: "card", smallArt: "https://example.com/card.png" }], competitiveTiers: [{ tiers: [{ tier: 18, tierName: "Diamond 1", smallIcon: "https://example.com/rank.png" }] }] };
const friend = (id: string, show = "chat"): ChatFriend => ({ id, gameName: "Name", tagLine: "Tag", show, status: "" });
const build = (p: CombatSessionSnapshot["party"] = party, options: Partial<Parameters<typeof buildPartyViewModel>[0]> = {}) => buildPartyViewModel({ session, snapshot: makeSnapshot(p), assets, friends: {}, friendConnectionStatus: "authenticated", ...options });

describe("party view model", () => {
  it("allows joining confirmed idle parties without requiring leadership and explicit absence", () => {
    expect(build().canJoinParty).toBe(true);
    expect(build({ ...party, State: "CUSTOM_GAME_SETUP", Members: [{ Subject: "self", IsReady: false }] }).canJoinParty).toBe(true);
    expect(build(null).canJoinParty).toBe(true);
  });
  it.each(["UNKNOWN", "MATCHMAKING", "MATCHMADE", "", undefined])("blocks joining party state %p", (State) => {
    expect(build({ ...party, State }).canJoinParty).toBe(false);
  });
  it("blocks active matches and inconsistent or incomplete snapshots", () => {
    for (const patch of [
      { state: "pregame" as const }, { state: "live" as const }, { matchId: "match" },
      { pregameMatch: {} }, { currentGameMatch: {} }, { partyId: "other" },
      { party: undefined }, { party: { ID: "party", State: "DEFAULT" } },
    ]) {
      const snapshot = { ...makeSnapshot(party), ...patch } as CombatSessionSnapshot;
      expect(build(party, { snapshot }).canJoinParty).toBe(false);
    }
    expect(build(null, { snapshot: { ...makeSnapshot(null), partyId: "stale" } }).canJoinParty).toBe(false);
  });
  it("maps actual identity, names, rank and only the first explicitly selected pod ping", () => {
    const model = build();
    expect(model.members[0]).toMatchObject({ id: "self", name: "Me", tag: "AP", level: 100, pingMs: 42, rankName: "Diamond 1", isSelf: true, isLeader: true, avatarUrl: "https://example.com/card.png" });
    expect(model).toMatchObject({ isLeader: true, canManage: true, canStartQueue: true, canReady: true, privacy: "OPEN" });
    expect(model.queueOptions.map((q) => q.id)).toEqual(["competitive", "swiftplay", "custom"]);
  });
  it.each(["HideAccountLevel", "Incognito"])("respects identity privacy %s", (flag) => {
    const p = { ...party, Members: [{ ...party.Members[0], PlayerIdentity: { ...party.Members[0].PlayerIdentity, [flag]: true } }] };
    expect(build(p).members[0].level).toBeUndefined();
  });
  it("uses a validated own progress level for self while preserving other member privacy", () => {
    const p = { ...party, Members: [
      { ...party.Members[0], PlayerIdentity: { AccountLevel: 100, HideAccountLevel: true } },
      { Subject: "friend", IsReady: true, PlayerIdentity: { AccountLevel: 90, HideAccountLevel: true } },
    ] };
    const model = build(p, { selfLevel: 345 });
    expect(model.members[0].level).toBe(345); expect(model.members[1].level).toBeUndefined();
    for (const selfLevel of [0, -1, 1.5, Infinity]) expect(build(p, { selfLevel }).members[0].level).toBeUndefined();
    expect(build(p, { selfLevel: 345, session: { ...session, id: "another-account" } }).members[0].level).toBeUndefined();
  });
  it("keeps missing/malformed data unavailable and current queue disabled if ineligible", () => {
    const p = { ID: "party", Members: [{ Subject: "self", IsReady: false, Pings: [{ GamePodID: "selected", Ping: -1 }], CompetitiveTier: "18", PlayerIdentity: { AccountLevel: "100" } }], MatchmakingData: { QueueID: "new-mode", PreferredGamePods: ["selected"] }, EligibleQueues: [null, "swiftplay", "swiftplay"] };
    const model = build(p as unknown as NonNullable<CombatSessionSnapshot["party"]>);
    expect(model.members[0]).toMatchObject({ name: "Me", ready: false });
    expect(model.members[0].level).toBeUndefined();
    expect(model.members[0].pingMs).toBeUndefined();
    expect(model.members[0].rankName).toBeUndefined();
    expect(model.queueOptions).toEqual([{ id: "swiftplay", label: "Swiftplay", enabled: true }, { id: "new-mode", label: "New Mode", enabled: false }, { id: "custom", label: "Custom", enabled: false }]);
    expect(model.canManage).toBe(false);
  });
  it.each(["UNKNOWN", "MATCHMAKING", "MATCHMADE", "", undefined])("does not permit default-state management for %s", (State) => {
    const model = build({ ...party, State });
    expect(model.canManage).toBe(false);
    expect(model.canStartQueue).toBe(false);
    expect(model.isQueueing).toBe(State === "MATCHMAKING");
  });
  it("requires ownership, readiness, eligible queue and idle match state", () => {
    expect(build({ ...party, Members: [{ Subject: "self", IsReady: true }] }).canManage).toBe(false);
    expect(build({ ...party, Members: [{ ...party.Members[0], IsReady: false }] }).canStartQueue).toBe(false);
    expect(build({ ...party, RestrictedSeconds: 30 }).canStartQueue).toBe(false);
    expect(build({ ...party, QueueIneligibilities: ["restriction"] }).canStartQueue).toBe(false);
    expect(build(party, { snapshot: { ...makeSnapshot(party), state: "pregame" } }).canManage).toBe(false);
    expect(build(null)).toMatchObject({ partyId: null, members: [], canManage: false, canReady: false });
  });
  it("uses cached rank only for self and only the matching account", () => {
    const p = { ...party, Members: party.Members.map(({ CompetitiveTier, ...member }) => member) };
    const selfCache = { authKey: "ap|self", competitiveRank: { currentTier: 18, currentName: "Diamond 1", currentIcon: "https://example.com/rank.png" } };
    expect(build(p, { selfCache }).members[0].rankName).toBe("Diamond 1");
    expect(build(p, { selfCache }).members[1].rankName).toBeUndefined();
    expect(build(p, { selfCache: { ...selfCache, authKey: "ap|other" } }).members[0].rankName).toBeUndefined();
  });
  it("uses connected presence, excludes self/party/offline/away/DND, and disables unresolved Riot IDs", () => {
    const friends = { self: friend("self"), friend: friend("friend"), offline: friend("offline", "offline"), online: { ...friend("online"), presence: { playerCardId: "card", sessionLoopState: "INGAME" } }, away: friend("away", "away"), busy: friend("busy", "dnd"), unknown: { ...friend("unknown"), gameName: "Unknown", tagLine: "" } };
    const model = build(party, { friends });
    expect(model.friends.map((f) => f.id).sort()).toEqual(["online", "unknown"]);
    expect(model.friends.find((f) => f.id === "online")).toMatchObject({ avatarUrl: "https://example.com/card.png", canInvite: true });
    expect(model.friends.find((f) => f.id === "unknown")?.canInvite).toBe(false);
    expect(build(party, { friends, friendConnectionStatus: "disconnected" }).friends).toEqual([]);
  });

  it.each(["offline", " OFFLINE ", "away", " AWAY ", "dnd", "DND", " DnD "])("excludes %s even with known card/activity metadata", (show) => {
    const candidate = { ...friend("candidate", show), presence: { playerCardId: "card", sessionLoopState: "MENUS" } };
    expect(build(party, { friends: { candidate } }).friends).toEqual([]);
  });
  it.each(["chat", "online", "dnd", "mobile"])("excludes current %s when confirmed Valorant isIdle is true", (show) => {
    const candidate = { ...friend("candidate", show), presence: { playerCardId: "card", sessionLoopState: "MENUS", isIdle: true } };
    expect(build(party, { friends: { candidate } }).friends).toEqual([]);
  });
  it.each([false, undefined])("keeps current non-away friends with isIdle=%s and preserves permissions", (isIdle) => {
    const candidate = { ...friend("candidate", "chat"), presence: { playerCardId: "card", isIdle } };
    expect(build(party, { friends: { candidate } }).friends[0]).toMatchObject({ id: "candidate", canInvite: true });
    expect(build(null, { friends: { candidate } }).friends[0]?.canInvite).toBe(false);
  });

  it.each(["chat", "online", "mobile", " MOBILE "])("keeps current %s without changing invite permissions", (show) => {
    const friends = { candidate: friend("candidate", show), unresolved: { ...friend("unresolved", show), tagLine: "" } };
    const model = build(party, { friends });
    expect(model.friends.map((entry) => entry.id)).toEqual(["candidate", "unresolved"]);
    expect(model.friends[0].canInvite).toBe(true);
    expect(model.friends[1].canInvite).toBe(false);
    expect(model.friends[0].presence).toBe("available");
    expect(build(null, { friends }).friends.every((entry) => !entry.canInvite)).toBe(true);
  });

  it.each(["connecting", "disconnected", "error"])("does not display cached current-looking friends while %s", (friendConnectionStatus) => {
    expect(build(party, { friends: { candidate: friend("candidate", "dnd") }, friendConnectionStatus }).friends).toEqual([]);
  });

  it("drops and restores the rail on live status changes and never revives a reset account's friends", () => {
    const store = useChatStore.getState();
    const current = () => {
      const chat = useChatStore.getState();
      return build(party, { friends: chat.friends, friendConnectionStatus: chat.status });
    };
    try {
      store.resetChatSession();
      store.setStatus("authenticated");
      store.setFriends([friend("candidate", "chat")]);
      const roster = useChatStore.getState().friends;
      expect(current().friends.map((entry) => entry.id)).toEqual(["candidate"]);
      expect(useChatStore.getState().friends).toBe(roster);
      for (const show of ["away", "offline", "dnd"]) {
        store.updateFriendPresence("candidate", "", show);
        expect(current().friends).toEqual([]);
        store.updateFriendPresence("candidate", "", "mobile");
        expect(current().friends.map((entry) => entry.id)).toEqual(["candidate"]);
      }
      store.setStatus("connecting");
      store.setStatus("authenticated");
      expect(current().friends).toEqual([]);
      store.updateFriendPresence("candidate", "", "dnd");
      expect(current().friends).toEqual([]);
      store.updateFriendPresence("candidate", "", "dnd", { isIdle: true });
      expect(current().friends).toEqual([]);
      store.updateFriendPresence("candidate", "", "dnd", { isIdle: false });
      expect(current().friends).toEqual([]);
      store.updateFriendPresence("candidate", "", "chat", { isIdle: false });
      expect(current().friends[0]).toMatchObject({ id: "candidate", presence: "available", canInvite: true });
      store.resetChatSession();
      store.setStatus("authenticated");
      expect(current().friends).toEqual([]);
      store.setFriends([friend("other-account", "chat")]);
      expect(current().friends.map((entry) => entry.id)).toEqual(["other-account"]);
    } finally { store.resetChatSession(); }
  });
});
