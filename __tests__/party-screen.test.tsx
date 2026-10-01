import React from "react";
import { FlatList, Switch, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PartyScreen from "~/features/party/PartyScreen";
import type { PartyActions, PartyScreenProps, PartyViewModel } from "~/features/party/party-types";

jest.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, options: { defaultValue: string; [key: string]: unknown }) =>
    options.defaultValue.replace(/{{(\w+)}}/g, (_: string, name: string) => String(options[name])) }),
}));
jest.mock("react-native-reanimated", () => {
  const { View, Easing } = require("react-native") as typeof import("react-native");
  const animation = { duration: () => animation, reduceMotion: () => animation };
  return { __esModule: true, default: { View }, Easing, FadeInDown: animation, ReduceMotion: { System: "system" },
    cancelAnimation: jest.fn(), useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(), withSpring: (value: number) => value };
});
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => true }));
jest.mock("~/utils/flow-tracer", () => ({ flowTracer: { track: jest.fn() } }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }) }));

function makeModel(overrides: Partial<PartyViewModel> = {}): PartyViewModel {
  return {
    partyId: "party-1", queueId: "unrated", queueLabel: "Unrated", privacy: "CLOSED", code: null,
    queueOptions: [{ id: "unrated", label: "Unrated", enabled: true }, { id: "swiftplay", label: "Swiftplay", enabled: true },
      { id: "disabled", label: "Unavailable queue", enabled: false }],
    partyState: "DEFAULT", isLeader: true, isQueueing: false, canStartQueue: true, canManage: true, canReady: true, canJoinParty: true,
    members: [{ id: "self", name: "A very long real player name", tag: "123", isSelf: true, isLeader: true, ready: true }],
    friends: [{ id: "friend-1", name: "A real friend with a long name", presence: "available", activityLabel: "In lobby", canInvite: true }],
    friendConnectionStatus: "connected", ...overrides,
  };
}
function makeActions(): PartyActions {
  return { onRefresh: jest.fn(), onClose: jest.fn(), onStartQueue: jest.fn(), onCancelQueue: jest.fn(),
    onLeave: jest.fn(), onReady: jest.fn(), onQueueChange: jest.fn(), onPrivacyChange: jest.fn(),
    onGenerateCode: jest.fn(), onCopyCode: jest.fn(), onShareCode: jest.fn().mockResolvedValue(undefined),
    onJoinCode: jest.fn(), onInviteByName: jest.fn(), onInvite: jest.fn(), onAllFriends: jest.fn() };
}
let renderer: TestRenderer.ReactTestRenderer;
function mount(overrides: Partial<PartyScreenProps> = {}) {
  const props: PartyScreenProps = { model: makeModel(), actions: makeActions(), refreshing: false,
    busyAction: null, errorMessage: null, ...overrides };
  act(() => { renderer = TestRenderer.create(<PartyScreen {...props} />); });
  return props;
}
function button(label: string) { return renderer.root.findAll(node => node.props.accessibilityRole === "button" &&
  (node.props.accessibilityLabel === label || node.findAllByType(Text).some(text => text.props.children === label)))[0]; }
function text(value: string) { return renderer.root.findAllByType(Text).filter(node => node.props.children === value); }
async function press(label: string) { await act(async () => { await button(label).props.onPress(); }); }
afterEach(() => { act(() => renderer?.unmount()); });

describe("Party callback-only sheet", () => {
  it("names the Custom start action correctly and permits confirmed leave from Custom setup", async () => {
    const model = makeModel({ queueId: "custom", queueLabel: "Custom", partyState: "CUSTOM_GAME_SETUP" });
    const { actions } = mount({ model });
    expect(button("Start Custom Game").props.accessibilityState.disabled).toBe(false);
    expect(text("1")).toHaveLength(0);
    await press("Leave");
    expect(actions.onLeave).not.toHaveBeenCalled();
    await press("Confirm leave");
    expect(actions.onLeave).toHaveBeenCalledTimes(1);
  });

  it("renders the white Party hierarchy, real identity, unavailable data and supplied chat without agents", () => {
    mount({ chat: <Text>Existing party chat</Text> });
    ["Party", "Members", "Online friends", "Settings", "Invite", "Level unavailable", "Ping unavailable", "Rank unavailable",
      "Existing party chat"].forEach(label => expect(text(label).length).toBeGreaterThan(0));
    expect(text("A very long real player name")[0].props.numberOfLines).toBe(1);
    expect(text("A real friend with a long name")[0].props.numberOfLines).toBe(1);
    expect(text("Select agent")).toHaveLength(0);
    expect(text("Duelist")).toHaveLength(0);
  });
  it("calls explicit start, refresh, close, generate and all-friends callbacks", async () => {
    const { actions } = mount();
    await press("Start Queue"); await press("Refresh party"); await press("Close party");
    await press("Generate"); await press("All friends");
    [actions.onStartQueue, actions.onRefresh, actions.onClose, actions.onGenerateCode, actions.onAllFriends]
      .forEach(callback => expect(callback).toHaveBeenCalledTimes(1));
  });
  it("changes queue and privacy only after an option is explicitly pressed", async () => {
    const { actions } = mount();
    await press("Queue: Unrated");
    expect(actions.onQueueChange).not.toHaveBeenCalled();
    expect(button("Unavailable queue").props.accessibilityState.disabled).toBe(true);
    await press("Swiftplay");
    expect(actions.onQueueChange).toHaveBeenCalledWith("swiftplay");
    await press("Privacy: Closed");
    expect(actions.onPrivacyChange).not.toHaveBeenCalled();
    await press("Open");
    expect(actions.onPrivacyChange).toHaveBeenCalledWith("OPEN");
  });
  it("dismisses selectors locally without changing the current setting", async () => {
    const { actions } = mount(); await press("Queue: Unrated"); await press("Close selector");
    expect(actions.onQueueChange).not.toHaveBeenCalled();
    expect(button("Swiftplay")).toBeUndefined();
  });
  it("requires local leave confirmation and supports keeping the party", async () => {
    const { actions } = mount(); await press("Leave");
    expect(actions.onLeave).not.toHaveBeenCalled();
    await press("Stay in party"); expect(actions.onLeave).not.toHaveBeenCalled();
    await press("Leave"); await press("Confirm leave");
    expect(actions.onLeave).toHaveBeenCalledTimes(1);
  });
  it("invites from the accessible friend avatar and exposes an invitation hint", async () => {
    const { actions } = mount();
    expect(button("Invite A real friend with a long name").props.accessibilityHint).toBe("Sends a party invitation");
    await press("Invite A real friend with a long name");
    expect(actions.onInvite).toHaveBeenCalledWith("friend-1");
  });
  it("uses a controlled native Ready switch with accessible checked state", async () => {
    const { actions } = mount(); const control = renderer.root.findByType(Switch);
    expect(control.props.accessibilityRole).toBe("switch");
    expect(control.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    await act(async () => { await control.props.onValueChange(false); });
    expect(actions.onReady).toHaveBeenCalledWith(false);
    expect(renderer.root.findByType(Switch).props.value).toBe(true);
  });
  it("locks mutations during a busy action and refresh while refreshing", () => {
    mount({ busyAction: "invite", refreshing: true });
    ["Start Queue", "Leave", "Generate", "Queue: Unrated", "Privacy: Closed", "Invite A real friend with a long name", "Refresh party"]
      .forEach(label => expect(button(label).props.accessibilityState.disabled).toBe(true));
    expect(renderer.root.findByType(Switch).props.disabled).toBe(true);
  });
  it("locks immediately against two start presses before the parent updates", async () => {
    let resolve!: () => void; const actions = makeActions();
    actions.onStartQueue = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    mount({ actions }); const start = button("Start Queue");
    act(() => { void start.props.onPress(); void start.props.onPress(); });
    expect(actions.onStartQueue).toHaveBeenCalledTimes(1);
    expect(button("Start Queue").props.accessibilityState.busy).toBe(true);
    await act(async () => { resolve(); });
  });
  it("renders actual member metadata and switches to cancel and copy from parent data", async () => {
    const model = makeModel({ isQueueing: true, code: "REAL-CODE", members: [{ id: "self", name: "Real name", ready: false,
      isSelf: true, isLeader: false, level: 5, pingMs: 0, rankName: "Gold 1", rr: 0 }] });
    const { actions } = mount({ model });
    ["Level 5", "0 ms", "Gold 1 · 0 RR", "REAL-CODE", "Not ready"].forEach(label => expect(text(label).length).toBeGreaterThan(0));
    await press("Cancel Queue"); await press("Copy");
    expect(actions.onCancelQueue).toHaveBeenCalledTimes(1); expect(actions.onCopyCode).toHaveBeenCalledTimes(1);
  });
  it("preserves data and shows parent action errors", () => {
    mount({ errorMessage: "Invite failed. Try again." });
    expect(text("Invite failed. Try again.")[0].props.accessibilityRole).toBe("alert");
    expect(text("A very long real player name")).toHaveLength(1);
  });
  it("shows empty/disconnected availability and keeps a refreshable list mounted", () => {
    mount({ model: makeModel({ partyId: null, members: [], friends: [], friendConnectionStatus: "disconnected",
      canManage: false, canReady: false, canStartQueue: false, privacy: null, queueLabel: "" }) });
    expect(text("Members unavailable")).toHaveLength(1); expect(text("Friends unavailable")).toHaveLength(1);
    expect(renderer.root.findAllByType(FlatList).length).toBeGreaterThan(0);
    expect(button("Start Queue").props.accessibilityState.disabled).toBe(true);
  });
  it("shows rejected callback errors and unlocks controls for retry", async () => {
    const actions = makeActions(); actions.onInvite = jest.fn().mockRejectedValue(new Error("failure"));
    mount({ actions }); await press("Invite A real friend with a long name");
    expect(text("Action failed. Please try again.")).toHaveLength(1);
    expect(button("Invite A real friend with a long name").props.accessibilityState.disabled).toBe(false);
  });
  it("drops leave confirmation when the supplied party changes", async () => {
    const props = mount(); await press("Leave");
    act(() => renderer.update(<PartyScreen {...props} model={makeModel({ partyId: "party-2" })} />));
    expect(button("Confirm leave")).toBeUndefined();
    expect(props.actions.onLeave).not.toHaveBeenCalled();
  });
  it("keeps a failed queue selector open for retry", async () => {
    const actions = makeActions(); actions.onQueueChange = jest.fn().mockResolvedValue(false);
    mount({ actions }); await press("Queue: Unrated"); await press("Swiftplay");
    expect(button("Swiftplay")).toBeDefined();
    expect(text("Action failed. Please try again.").length).toBeGreaterThan(0);
  });
  it("renders available, busy and away friends with images and truthful fallback labels", () => {
    mount({ model: makeModel({ members: [{ id: "other", name: "", tag: "#TAG", ready: false, isSelf: false,
      isLeader: false, avatarUrl: "https://example.com/member.png", rankIconUrl: "https://example.com/rank.png", rankName: "Gold" }],
      friends: [{ id: "a", name: "", presence: "away", activityLabel: "", canInvite: false },
        { id: "b", name: "Busy friend", avatarUrl: "https://example.com/friend.png", presence: "busy", activityLabel: "", canInvite: false }] }) });
    ["Away", "Busy", "Gold"].forEach(label => expect(text(label)).toHaveLength(1));
    expect(text("Name unavailable").length).toBe(2);
    expect(button("Invite Busy friend").props.accessibilityValue.text).toBe("Busy");
    expect(button("Invite Busy friend").props.accessibilityState.disabled).toBe(true);
    expect(renderer.root.findAllByType(Switch)).toHaveLength(0);
  });
  it("explains a connected empty friend rail and preserves cached friends while disconnected", () => {
    const props = mount({ model: makeModel({ friends: [] }) });
    expect(text("No online friends")).toHaveLength(1);
    act(() => renderer.update(<PartyScreen {...props} model={makeModel({ friendConnectionStatus: "disconnected" })} />));
    expect(text("Friends unavailable")).toHaveLength(1);
    expect(button("Invite A real friend with a long name").props.accessibilityState.disabled).toBe(true);
  });
  it("uses the pull-to-refresh callback and exposes invitation progress", async () => {
    let resolve!: () => void; const actions = makeActions();
    actions.onInvite = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    mount({ actions });
    const refresh = renderer.root.findByType(FlatList).props.refreshControl;
    await act(async () => { await refresh.props.onRefresh(); });
    expect(actions.onRefresh).toHaveBeenCalledTimes(1);
    act(() => { void button("Invite A real friend with a long name").props.onPress(); });
    expect(text("Sending invitation…")).toHaveLength(1);
    await act(async () => { resolve(); });
  });
  it("allows invitations for the real XMPP authenticated connection status", () => {
    mount({ model: makeModel({ friendConnectionStatus: "authenticated" }) });
    expect(button("Invite A real friend with a long name").props.accessibilityState.disabled).toBe(false);
  });
  it("keeps selectors open when the controller reports an error through props", async () => {
    let resolve!: () => void; const actions = makeActions();
    actions.onQueueChange = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    const props = mount({ actions }); await press("Queue: Unrated");
    act(() => { void button("Swiftplay").props.onPress(); });
    await act(async () => {
      renderer.update(<PartyScreen {...props} errorMessage="Queue update failed" />);
      resolve();
    });
    expect(button("Swiftplay")).toBeDefined();
  });
  it("keeps leave confirmation open when the controller reports an error through props", async () => {
    let resolve!: () => void; const actions = makeActions();
    actions.onLeave = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    const props = mount({ actions }); await press("Leave");
    act(() => { void button("Confirm leave").props.onPress(); });
    await act(async () => {
      renderer.update(<PartyScreen {...props} errorMessage="Leave failed" />);
      resolve();
    });
    expect(button("Confirm leave")).toBeDefined();
  });
});
