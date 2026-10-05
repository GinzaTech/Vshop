import React from "react";
import { FlatList, StyleSheet, Switch, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { CachedImage } from "~/components/CachedImage";
import GlassCard from "~/components/ui/GlassCard";
import { TYPOGRAPHY } from "~/constants/DesignSystem";
import PartyMemberCard from "~/features/party/PartyMemberCard";
import PartyScreen from "~/features/party/PartyScreen";
import type { PartyActions, PartyMemberView, PartyScreenProps, PartyViewModel } from "~/features/party/party-types";

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

function makeMember(index: number, overrides: Partial<PartyMemberView> = {}): PartyMemberView {
  return { id: `member-${index}`, name: `Player ${index}`, tag: `TAG${index}`, avatarUrl: `https://example.com/avatar-${index}.png`,
    rankIconUrl: `https://example.com/rank-${index}.png`, rankName: "Gold 1", rr: index, level: index + 1, pingMs: index,
    ready: index === 0, isSelf: index === 0, isLeader: index === 0, ...overrides };
}

function makeModel(overrides: Partial<PartyViewModel> = {}): PartyViewModel {
  return { partyId: "party-compact", queueId: "unrated", queueLabel: "Unrated", privacy: "CLOSED", code: null,
    queueOptions: [{ id: "unrated", label: "Unrated", enabled: true }], partyState: "DEFAULT", isLeader: true,
    isQueueing: false, canStartQueue: true, canManage: true, canReady: true, canJoinParty: true,
    members: Array.from({ length: 5 }, (_, index) => makeMember(index)), friends: [], friendConnectionStatus: "authenticated",
    ...overrides };
}

function makeActions(): PartyActions {
  return { onRefresh: jest.fn(), onClose: jest.fn(), onStartQueue: jest.fn(), onCancelQueue: jest.fn(), onLeave: jest.fn(),
    onReady: jest.fn(), onQueueChange: jest.fn(), onPrivacyChange: jest.fn(), onGenerateCode: jest.fn(), onCopyCode: jest.fn(),
    onShareCode: jest.fn().mockResolvedValue(undefined), onJoinCode: jest.fn(), onInviteByName: jest.fn(), onInvite: jest.fn(),
    onAllFriends: jest.fn() };
}

let renderer: TestRenderer.ReactTestRenderer | undefined;
function root() { return renderer!.root; }
function mount(overrides: Partial<PartyScreenProps> = {}) {
  const props: PartyScreenProps = { model: makeModel(), actions: makeActions(), refreshing: false,
    busyAction: null, errorMessage: null, ...overrides };
  act(() => { renderer = TestRenderer.create(<PartyScreen {...props} />); });
  return props;
}
function mountMember(member: PartyMemberView, disabled = false, busy = false) {
  const onReady = jest.fn();
  act(() => { renderer = TestRenderer.create(<PartyMemberCard member={member} disabled={disabled} busy={busy} onReady={onReady} />); });
  return onReady;
}
function texts(node: TestRenderer.ReactTestInstance, label: string) {
  return node.findAllByType(Text).filter(text => text.props.children === label);
}
function teamPanel() {
  const panels = root().findAllByType(GlassCard).filter(node => node.props.testID === "party-team-panel");
  expect(panels).toHaveLength(1);
  return panels[0];
}
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; });

describe("Combat compact Team frame", () => {
  it.each([false, true])("shows only the rank icon at the row's right edge (self=%s)", isSelf => {
    const member = makeMember(0, { isSelf });
    mountMember(member);
    expect(texts(root(), "Gold 1 · 0 RR")).toHaveLength(0);
    const row = root().findAllByType(View).find(node => node.props.testID === `party-member-${member.id}`)!;
    const icon = row.findAllByType(CachedImage).find(node => node.props.source.uri === member.rankIconUrl)!;
    const slot = row.findAllByType(View).find(node => node.props.testID === `party-rank-${member.id}`)!;
    expect(slot).toBeDefined();
    let owner = icon.parent;
    while (owner && owner !== row && owner.props.testID !== `party-rank-${member.id}`) owner = owner.parent;
    expect(owner?.props.testID).toBe(`party-rank-${member.id}`);
    const nativeRow = row.findAll(node => typeof node.type === "string" && node.props.testID === `party-member-${member.id}`)[0];
    const children = nativeRow.children.filter((child): child is TestRenderer.ReactTestInstance => typeof child !== "string");
    expect(children[children.length - 1].props.testID).toBe(`party-rank-${member.id}`);
    expect(StyleSheet.flatten(slot.props.style)).toMatchObject({ alignItems: "flex-end", flexShrink: 0 });
    expect(slot.props.accessibilityLabel).toBe("Gold 1 · 0 RR");
    expect(slot.props.accessibilityRole).toBe("image");
  });
  it("contains all five members in one shared flat GlassCard without nested member GlassCards", () => {
    const { model } = mount();
    const panel = teamPanel();
    expect(panel.props.variant).toBe("flat");
    const heading = texts(panel, "Members")[0];
    expect(heading.props.accessibilityRole).toBe("header");
    expect(StyleSheet.flatten(heading.props.style).fontSize).toBe(14);
    expect(panel.findAllByType(GlassCard)).toHaveLength(1);
    const rows = panel.findAllByType(View).filter(node => typeof node.props.testID === "string" && node.props.testID.startsWith("party-member-"));
    expect(rows.map(row => row.props.testID)).toEqual(model.members.map(member => `party-member-${member.id}`));
    model.members.forEach(member => expect(texts(panel, member.name)).toHaveLength(1));
  });

  it("keeps one stable team item in the outer FlatList and preserves queue header, footer and refresh ownership", async () => {
    const { actions, model } = mount({ chat: <Text>Existing team chat</Text> });
    const list = root().findByType(FlatList);
    expect(list.props.data).toEqual([model.members]);
    expect(list.props.keyExtractor(list.props.data[0], 0)).toBe("team");
    const header = list.props.ListHeaderComponent;
    let headerRenderer!: TestRenderer.ReactTestRenderer;
    let footerRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      headerRenderer = TestRenderer.create(header);
      footerRenderer = TestRenderer.create(list.props.ListFooterComponent);
    });
    try {
      expect(texts(headerRenderer.root, "Unrated")).toHaveLength(1);
      expect(texts(headerRenderer.root, "Members")).toHaveLength(0);
      expect(texts(teamPanel(), "Members")).toHaveLength(1);
      ["Online friends", "Settings", "Invite", "Existing team chat"].forEach(label => expect(texts(footerRenderer.root, label)).toHaveLength(1));
      await act(async () => { await list.props.refreshControl.props.onRefresh(); });
      expect(actions.onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      act(() => { headerRenderer.unmount(); footerRenderer.unmount(); });
    }
  });

  it("renders a member as a native row instead of a separate GlassCard", () => {
    const member = makeMember(1);
    mountMember(member);
    expect(root().findAllByType(GlassCard)).toHaveLength(0);
    expect(root().findAllByType(View).filter(node => node.props.testID === `party-member-${member.id}`)).toHaveLength(1);
  });

  it("preserves the entire custom roster beyond five members without mutating its order", () => {
    const members = Object.freeze(Array.from({ length: 6 }, (_, index) => Object.freeze(makeMember(index))));
    mount({ model: makeModel({ queueId: "custom", partyState: "CUSTOM_GAME_SETUP", members }) });
    const panel = teamPanel();
    expect(panel.findAllByType(PartyMemberCard).map(row => row.props.member.id)).toEqual(members.map(member => member.id));
    members.forEach(member => expect(texts(panel, member.name)).toHaveLength(1));
    expect(panel.findAllByType(Switch)).toHaveLength(1);
    expect(members.map(member => member.id)).toEqual(["member-0", "member-1", "member-2", "member-3", "member-4", "member-5"]);
  });

  it("keeps an empty roster and unavailable message inside the same refreshable team frame", async () => {
    const { actions } = mount({ model: makeModel({ partyId: null, members: [], canReady: false, canManage: false, canStartQueue: false }) });
    const panel = teamPanel();
    expect(texts(panel, "Members")).toHaveLength(1);
    expect(texts(panel, "Members unavailable")).toHaveLength(1);
    expect(texts(root(), "Members unavailable")).toHaveLength(1);
    expect(panel.findAllByType(GlassCard)).toHaveLength(1);
    expect(panel.findAllByType(PartyMemberCard)).toHaveLength(0);
    expect(root().findAllByType(Switch)).toHaveLength(0);
    const list = root().findByType(FlatList);
    expect(list.props.data).toEqual([[]]);
    expect(list.props.refreshControl.props.enabled).toBe(true);
    await act(async () => { await list.props.refreshControl.props.onRefresh(); });
    expect(actions.onRefresh).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1, 2, 3, 4])("shrinks member %i avatar, rank image, name and metadata while preserving their values", index => {
    const member = makeMember(index);
    mountMember(member);
    const images = root().findAllByType(CachedImage);
    const avatar = images.find(image => image.props.source.uri === member.avatarUrl)!;
    const rank = images.find(image => image.props.source.uri === member.rankIconUrl)!;
    expect(StyleSheet.flatten(avatar.props.style)).toMatchObject({ width: 32, height: 32 });
    expect(StyleSheet.flatten(rank.props.style)).toMatchObject({ width: 20, height: 20 });
    expect(avatar.props.accessible).toBe(false);
    expect(rank.props.accessible).toBe(false);
    const name = texts(root(), member.name)[0];
    expect(name.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(name.props.style).fontSize).toBe(13);
    expect(StyleSheet.flatten(name.props.style).fontSize).toBe(TYPOGRAPHY.bodyCompact);
    [`#TAG${index}`, `Level ${index + 1}`, `${index} ms`, index === 0 ? "Ready" : "Not ready"].forEach(label => {
      const caption = texts(root(), label).find(node => StyleSheet.flatten(node.props.style).fontSize === 11);
      expect(caption).toBeDefined();
      expect(StyleSheet.flatten(caption!.props.style).fontSize).toBe(TYPOGRAPHY.captionSmall);
    });
    expect(texts(root(), `Gold 1 · ${index} RR`)).toHaveLength(0);
    const rankLabel = root().findAllByType(View).find(node => node.props.testID === `party-rank-${member.id}`)!;
    expect(rankLabel.props.accessibilityLabel).toBe(`Gold 1 · ${index} RR`);
    if (member.isSelf) expect(StyleSheet.flatten(texts(root(), "YOU")[0].props.style).fontSize).toBe(11);
  });

  it("keeps the self switch in the compact horizontal row with a full 48dp touch target", () => {
    const member = makeMember(0);
    mountMember(member);
    const row = root().findAllByType(View).find(node => node.props.testID === `party-member-${member.id}`)!;
    expect(row).toBeDefined();
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe("row");
    const control = row.findByType(Switch);
    const touchParents: TestRenderer.ReactTestInstance[] = [];
    for (let node = control.parent; node && node !== row; node = node.parent) touchParents.push(node);
    expect(touchParents.some(node => {
      if (node.type !== View) return false;
      const style = StyleSheet.flatten(node.props.style);
      return typeof style?.minHeight === "number" && style.minHeight >= 48 &&
        typeof style?.minWidth === "number" && style.minWidth >= 48;
    })).toBe(true);
    expect(texts(row, "Ready")).toHaveLength(1);
  });

  it("preserves exactly one controlled native readiness switch for self and no teammate switches", async () => {
    const { actions } = mount();
    const switches = root().findAllByType(Switch);
    expect(switches).toHaveLength(1);
    expect(switches[0].props.accessibilityRole).toBe("switch");
    expect(switches[0].props.accessibilityState).toMatchObject({ checked: true, disabled: false, busy: false });
    await act(async () => { await switches[0].props.onValueChange(false); });
    expect(actions.onReady).toHaveBeenCalledTimes(1);
    expect(actions.onReady).toHaveBeenCalledWith(false);
    expect(root().findByType(Switch).props.value).toBe(true);
  });

  it.each([
    { label: "ready request", busyAction: "ready" as const, refreshing: false, canReady: true, busy: true },
    { label: "other action", busyAction: "invite" as const, refreshing: false, canReady: true, busy: false },
    { label: "refresh", busyAction: null, refreshing: true, canReady: true, busy: false },
    { label: "unavailable readiness", busyAction: null, refreshing: false, canReady: false, busy: false },
  ])("preserves disabled and busy readiness semantics during $label", async ({ busyAction, refreshing, canReady, busy }) => {
    const { actions } = mount({ busyAction, refreshing, model: makeModel({ canReady }) });
    const control = root().findByType(Switch);
    expect(control.props.disabled).toBe(true);
    expect(control.props.accessibilityState).toMatchObject({ checked: true, disabled: true, busy });
    await act(async () => { await control.props.onValueChange(false); });
    expect(actions.onReady).not.toHaveBeenCalled();
  });

  it("locks readiness immediately while its callback is pending and follows the latest parent value", async () => {
    let resolve!: () => void;
    const actions = { ...makeActions(), onReady: jest.fn(() => new Promise<void>(done => { resolve = done; })) };
    const props = mount({ actions });
    const control = root().findByType(Switch);
    act(() => { void control.props.onValueChange(false); void control.props.onValueChange(false); });
    expect(actions.onReady).toHaveBeenCalledTimes(1);
    expect(root().findByType(Switch).props.accessibilityState).toMatchObject({ checked: true, disabled: true, busy: true });
    await act(async () => { resolve(); });
    expect(root().findByType(Switch).props.disabled).toBe(false);
    expect(root().findByType(Switch).props.value).toBe(true);
    const members = props.model.members.map(member => member.isSelf ? { ...member, ready: false } : member);
    act(() => renderer!.update(<PartyScreen {...props} model={{ ...props.model, members }} />));
    expect(root().findByType(Switch).props.value).toBe(false);
    expect(root().findByType(Switch).props.accessibilityState.checked).toBe(false);
    expect(actions.onReady).toHaveBeenCalledTimes(1);
  });

  it("retains team identities and unlocks readiness for retry after a callback rejection", async () => {
    const actions = { ...makeActions(), onReady: jest.fn().mockRejectedValue(new Error("ready failed")) };
    mount({ actions });
    await act(async () => { await root().findByType(Switch).props.onValueChange(false); });
    expect(texts(root(), "Action failed. Please try again.")).toHaveLength(1);
    expect(root().findByType(Switch).props.accessibilityState).toMatchObject({ checked: true, disabled: false, busy: false });
    expect(texts(teamPanel(), "Player 0")).toHaveLength(1);
  });

  it("preserves every cached row while refreshing and exposes readiness busy only for a readiness request", () => {
    const props = mount();
    act(() => renderer!.update(<PartyScreen {...props} refreshing errorMessage="Temporary refresh error" />));
    const panel = teamPanel();
    props.model.members.forEach(member => expect(texts(panel, member.name)).toHaveLength(1));
    expect(root().findByType(Switch).props.accessibilityState).toMatchObject({ checked: true, disabled: true, busy: false });
    const refresh = root().findByType(FlatList).props.refreshControl;
    expect(refresh.props.refreshing).toBe(true);
    expect(refresh.props.enabled).toBe(false);
  });

  it("keeps missing member data truthful and never adds readiness to a teammate", () => {
    mountMember({ id: "unknown", name: "", isSelf: false, isLeader: false, ready: false });
    ["Name unavailable", "Level unavailable", "Ping unavailable", "Not ready"].forEach(label => {
      expect(texts(root(), label)).toHaveLength(1);
    });
    expect(root().findAllByType(CachedImage)).toHaveLength(0);
    const fallback = root().findAllByType(View).filter(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.width === 32 && style?.height === 32;
    });
    expect(fallback).toHaveLength(1);
    expect(root().findAllByType(Switch)).toHaveLength(0);
    expect(texts(root(), "Rank unavailable")).toHaveLength(0);
    expect(root().findAllByType(View).find(node => node.props.testID === "party-rank-unknown")!.props.accessibilityLabel).toBe("Rank unavailable");
    expect(texts(root(), "0 ms")).toHaveLength(0);
    expect(texts(root(), "Level 0")).toHaveLength(0);
  });

  it("retains a rank name without fabricated RR and does not duplicate a supplied tag prefix", () => {
    mountMember({ id: "rank-only", name: "Rank only", tag: "#REAL", rankName: "Gold 1", ready: false, isSelf: false, isLeader: false });
    expect(texts(root(), "Gold 1")).toHaveLength(0);
    expect(root().findAllByType(View).find(node => node.props.testID === "party-rank-rank-only")!.props.accessibilityLabel).toBe("Gold 1");
    expect(texts(root(), "#REAL")).toHaveLength(1);
    expect(texts(root(), "Gold 1 · 0 RR")).toHaveLength(0);
    expect(root().findAllByType(Switch)).toHaveLength(0);
  });
});
