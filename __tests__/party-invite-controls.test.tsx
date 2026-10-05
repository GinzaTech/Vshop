import React from "react";
import { Keyboard, Modal, StyleSheet, Text, TextInput, useWindowDimensions } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PartyScreen from "~/features/party/PartyScreen";
import type { PartyActions, PartyScreenProps, PartyViewModel } from "~/features/party/party-types";
import { partyStyles as s } from "~/features/party/party.styles";

let mockBlur: (() => void) | undefined;
jest.mock("expo-router", () => ({ useFocusEffect: (callback: () => (() => void)) => {
  const ReactModule = require("react") as typeof React;
  ReactModule.useEffect(() => { mockBlur = callback(); return mockBlur; }, [callback]);
} }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => true }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/features/party/PartyMemberCard", () => () => null);
jest.mock("~/features/party/PartyFriendRail", () => () => null);
jest.mock("~/components/ui/GlassCard", () => {
  const { View } = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock("~/components/ui/ValorantButton", () => {
  const { Pressable, Text: NativeText } = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: ({ title, onPress, disabled, loading, style }: {
    title: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: object;
  }) => <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading}
    accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} onPress={onPress} style={style}><NativeText>{title}</NativeText></Pressable> };
});
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }) }));

function model(overrides: Partial<PartyViewModel> = {}): PartyViewModel {
  return { partyId: "party", partyState: "DEFAULT", queueId: "unrated", queueLabel: "Unrated", queueOptions: [],
    privacy: "CLOSED", code: "REAL-CODE", members: [], friends: [], friendConnectionStatus: "connected", isLeader: true,
    isQueueing: false, canStartQueue: true, canManage: true, canReady: true, canJoinParty: true, ...overrides };
}
function actions(): PartyActions {
  return { onRefresh: jest.fn(), onClose: jest.fn(), onStartQueue: jest.fn(), onCancelQueue: jest.fn(), onLeave: jest.fn(),
    onReady: jest.fn(), onQueueChange: jest.fn(), onPrivacyChange: jest.fn(), onGenerateCode: jest.fn(), onCopyCode: jest.fn(),
    onShareCode: jest.fn().mockResolvedValue(undefined), onJoinCode: jest.fn(), onInviteByName: jest.fn(), onInvite: jest.fn(), onAllFriends: jest.fn() };
}
let renderer: TestRenderer.ReactTestRenderer;
let props: PartyScreenProps;
function mount(overrides: Partial<PartyScreenProps> = {}) {
  props = { model: model(), actions: actions(), busyAction: null, refreshing: false, errorMessage: null, ...overrides };
  act(() => { renderer = TestRenderer.create(<PartyScreen {...props} />); });
}
function button(label: string) { return renderer.root.findAll(node => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === label)[0]; }
function buttonStyle(label: string) {
  const style = button(label).props.style;
  return StyleSheet.flatten(typeof style === "function" ? style({ pressed: false }) : style);
}
async function press(label: string) { await act(async () => { button(label).props.onPress(); }); }
function input(value: string) { act(() => renderer.root.findByType(TextInput).props.onChangeText(value)); }
function update(overrides: Partial<PartyScreenProps>) { props = { ...props, ...overrides }; act(() => renderer.update(<PartyScreen {...props} />)); }
afterEach(() => { act(() => renderer?.unmount()); jest.restoreAllMocks(); });

it("keeps explicit Generate, Copy and Share with an existing code and dispatches only callbacks", async () => {
  mount(); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  await press("Generate"); await press("Copy"); await press("Share");
  [props.actions.onGenerateCode, props.actions.onCopyCode, props.actions.onShareCode].forEach(fn => expect(fn).toHaveBeenCalledTimes(1));
});
it("opens labeled code input on demand, trims it, submits once and dismisses keyboard", async () => {
  const dismiss = jest.spyOn(Keyboard, "dismiss"); mount(); await press("Join by code");
  expect(renderer.root.findByType(Modal).props.animationType).toBe("none");
  expect(renderer.root.findByType(TextInput).props.accessibilityLabel).toBe("Party code");
  input("  ABC-123  "); await press("Join party");
  expect(props.actions.onJoinCode).toHaveBeenCalledWith("ABC-123");
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0); expect(dismiss).toHaveBeenCalled();
});
it("validates Name#Tag locally and preserves a rejected form for retry", async () => {
  mount(); await press("Invite by Riot ID"); input("MissingTag"); await press("Send invite");
  expect(props.actions.onInviteByName).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Text).some(node => node.props.accessibilityRole === "alert")).toBe(true);
  props.actions.onInviteByName = jest.fn().mockRejectedValue(new Error("private transport details"));
  update({ actions: { ...props.actions } }); input("  Player Name#TAG  "); await press("Send invite");
  expect(props.actions.onInviteByName).toHaveBeenCalledWith("Player Name#TAG");
  expect(renderer.root.findByType(TextInput).props.value).toBe("  Player Name#TAG  ");
  expect(button("Send invite").props.accessibilityState.disabled).toBe(false);
});
it("blocks whitespace code and duplicate submission before parent busy props render", async () => {
  let resolve!: () => void; mount(); await press("Join by code"); input("   "); await press("Join party");
  expect(props.actions.onJoinCode).not.toHaveBeenCalled();
  props.actions.onJoinCode = jest.fn(() => new Promise<void>(done => { resolve = done; })); update({ actions: { ...props.actions } });
  input("CODE"); const submit = button("Join party"); act(() => { submit.props.onPress(); submit.props.onPress(); });
  expect(props.actions.onJoinCode).toHaveBeenCalledTimes(1); expect(button("Join party").props.accessibilityState.busy).toBe(true);
  await act(async () => resolve());
});
it("resets on close, party transition and blur and ignores saved stale submit handlers", async () => {
  mount(); await press("Invite by Riot ID"); input("Old#TAG"); const staleSubmit = button("Send invite").props.onPress;
  await press("Close invite form"); await press("Invite by Riot ID");
  expect(renderer.root.findByType(TextInput).props.value).toBe("");
  act(() => staleSubmit()); expect(props.actions.onInviteByName).not.toHaveBeenCalled();
  update({ model: model({ partyId: "new-party" }) }); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  await press("Join by code"); act(() => mockBlur?.()); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});
it("does not let old completion close a newly opened form", async () => {
  let resolve!: () => void; mount(); props.actions.onJoinCode = jest.fn(() => new Promise<void>(done => { resolve = done; }));
  update({ actions: { ...props.actions } }); await press("Join by code"); input("OLD"); act(() => button("Join party").props.onPress());
  await press("Close invite form"); update({ model: model({ partyId: "new-party" }) });
  await act(async () => resolve()); await press("Join by code");
  expect(renderer.root.findByType(TextInput).props.value).toBe("");
});
it("rejects stale submit after blur and resets the input when permission disappears", async () => {
  mount(); await press("Join by code"); input("OLD"); const stale = button("Join party").props.onPress;
  act(() => mockBlur?.()); act(() => stale()); expect(props.actions.onJoinCode).not.toHaveBeenCalled();
  act(() => renderer.unmount()); mount(); await press("Invite by Riot ID"); input("Player#TAG");
  update({ model: model({ canManage: false }) }); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});
it("keeps false and parent-error results visible, then allows a successful invite retry", async () => {
  mount(); props.actions.onInviteByName = jest.fn().mockResolvedValue(false); update({ actions: { ...props.actions } });
  await press("Invite by Riot ID"); input("Name#TAG"); await press("Send invite");
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
  props.actions.onInviteByName = jest.fn().mockResolvedValue(undefined); update({ actions: { ...props.actions }, errorMessage: "Server rejected" });
  await press("Send invite"); expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
  update({ errorMessage: null }); await press("Send invite"); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});
it("blocks unavailable code controls, keyboard whitespace submission and supports native back", async () => {
  mount({ model: model({ code: null, canManage: false }) });
  expect(button("Generate").props.accessibilityState.disabled).toBe(true);
  expect(button("Copy")).toBeUndefined(); expect(button("Share")).toBeUndefined();
  await press("Join by code"); input("CODE WITH SPACE");
  await act(async () => renderer.root.findByType(TextInput).props.onSubmitEditing());
  expect(props.actions.onJoinCode).not.toHaveBeenCalled();
  act(() => renderer.root.findByType(Modal).props.onRequestClose());
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});

it("shows the actual selectable code prominently, with adjacent icon actions and separated forms", () => {
  mount();
  const code = renderer.root.findAllByType(Text).find(node => node.props.children === "REAL-CODE")!;
  expect(code.props.selectable).toBe(true);
  expect(code.props.numberOfLines).toBeUndefined();
  expect(code.props.adjustsFontSizeToFit).not.toBe(true);
  expect(StyleSheet.flatten(code.props.style).fontSize).toBe(22);
  const tools = renderer.root.findByProps({ testID: "party-code-tools" });
  expect([...new Set(tools.findAll(node => node.props.accessibilityRole === "button").map(node => node.props.accessibilityLabel))]).toEqual(["Copy", "Share"]);
  const lower = renderer.root.findByProps({ testID: "party-code-form-actions" });
  expect([...new Set(lower.findAll(node => node.props.accessibilityRole === "button").map(node => node.props.accessibilityLabel))]).toEqual(["Join by code", "Invite by Riot ID"]);
  expect(renderer.root.findByProps({ testID: "party-code-divider" })).toBeTruthy();
});

it("shows an honest empty state and primary Generate without inactive copy/share controls", async () => {
  mount({ model: model({ code: null }) });
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === "No code yet")).toBe(true);
  expect(button("Copy")).toBeUndefined(); expect(button("Share")).toBeUndefined();
  expect(buttonStyle("Generate").backgroundColor).toBe(s.primary.backgroundColor);
  expect(props.actions.onGenerateCode).not.toHaveBeenCalled();
  await press("Generate"); expect(props.actions.onGenerateCode).toHaveBeenCalledTimes(1);
});

it.each([null, "REAL-CODE"])("keeps Generate within the existing compact row for code %j", code => {
  mount({ model: model({ code }) });
  let ancestor = button("Generate").parent;
  while (ancestor && ancestor.props.testID !== "party-code-header" && ancestor.props.testID !== "party-code-value-row") ancestor = ancestor.parent;
  expect(ancestor?.props.testID).toBe(code ? "party-code-header" : "party-code-value-row");
  expect(buttonStyle("Generate").alignSelf).not.toBe("stretch");
  expect(buttonStyle("Generate").minHeight).toBeGreaterThanOrEqual(48);
  if (code) expect(buttonStyle("Generate").backgroundColor).toBeUndefined();
  else expect(ancestor?.findAllByType(Text).some(node => node.props.children === "No code yet")).toBe(true);
});

it("allows the code header label and Generate to wrap without forced zero-basis text", () => {
  mount();
  const header = renderer.root.findByProps({ testID: "party-code-header" });
  expect(StyleSheet.flatten(header.props.style).flexWrap).toBe("wrap");
  const labelGroup = renderer.root.findByProps({ testID: "party-code-header-label" });
  const style = StyleSheet.flatten(labelGroup.props.style);
  expect(style.flexBasis).toBe("auto"); expect(style.maxWidth).toBe("100%");
  expect(style.flexShrink).toBe(1);
});

it.each(["code", "share"] as const)("exposes busy %s and disables every code panel action", pending => {
  mount({ busyAction: pending });
  for (const label of ["Generate", "Copy", "Share", "Join by code", "Invite by Riot ID"]) {
    expect(button(label).props.accessibilityState.disabled).toBe(true);
    expect(buttonStyle(label).minHeight).toBeGreaterThanOrEqual(48);
  }
  expect(button(pending === "code" ? "Generate" : "Share").props.accessibilityState.busy).toBe(true);
});

it.each([1, 2, 3])("keeps the entire long code and adapts lower actions at font scale %s", fontScale => {
  jest.spyOn(require("react-native") as { useWindowDimensions: typeof useWindowDimensions }, "useWindowDimensions")
    .mockReturnValue({ width: 360, height: 800, scale: 1, fontScale });
  const longCode = "Ab0_-".repeat(12);
  mount({ model: model({ code: longCode }) });
  const code = renderer.root.findAllByType(Text).find(node => node.props.children === longCode)!;
  expect(code.props.selectable).toBe(true); expect(code.props.maxFontSizeMultiplier).toBe(2);
  expect(code.props.numberOfLines).toBeUndefined(); expect(code.props.adjustsFontSizeToFit).not.toBe(true);
  const style = StyleSheet.flatten(renderer.root.findByProps({ testID: "party-code-form-actions" }).props.style);
  expect(style.flexDirection).toBe(fontScale > 1.3 ? "column" : "row");
});

it("stacks lower actions below 360dp and exposes pressed feedback without reducing touch bounds", () => {
  jest.spyOn(require("react-native") as { useWindowDimensions: typeof useWindowDimensions }, "useWindowDimensions")
    .mockReturnValue({ width: 320, height: 800, scale: 1, fontScale: 1 });
  mount();
  expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "party-code-form-actions" }).props.style).flexDirection).toBe("column");
  for (const label of ["Generate", "Copy", "Share", "Join by code", "Invite by Riot ID"]) {
    const style = StyleSheet.flatten(button(label).props.style({ pressed: true }));
    expect(style.opacity).toBe(0.5); expect(style.minHeight).toBeGreaterThanOrEqual(48);
  }
});

it("keeps explicit regeneration and current controller guards when an existing code is replaced", async () => {
  mount(); await press("Generate"); update({ model: model({ code: "NEXT-CODE" }) }); await press("Generate");
  expect(props.actions.onGenerateCode).toHaveBeenCalledTimes(2);
  update({ model: model({ canManage: false }) }); await press("Generate");
  expect(props.actions.onGenerateCode).toHaveBeenCalledTimes(2);
  update({ refreshing: true }); await press("Copy"); await press("Share");
  expect(props.actions.onCopyCode).not.toHaveBeenCalled(); expect(props.actions.onShareCode).not.toHaveBeenCalled();
});
it("joins from Custom setup only when the controller permits it and blocks refresh races", async () => {
  mount({ model: model({ partyState: "CUSTOM_GAME_SETUP" }) }); await press("Join by code"); input("CODE");
  update({ refreshing: true }); const stale = button("Join party").props.onPress; act(() => stale());
  expect(props.actions.onJoinCode).not.toHaveBeenCalled(); update({ refreshing: false }); await press("Join party");
  expect(props.actions.onJoinCode).toHaveBeenCalledWith("CODE");
});
it("uses join permission independently of membership and limits manual invite to idle manageable parties", () => {
  mount({ model: model({ partyId: null, canManage: false, canReady: false }) });
  expect(button("Join by code").props.accessibilityState.disabled).toBe(false);
  expect(button("Invite by Riot ID").props.accessibilityState.disabled).toBe(true);
  update({ model: model({ isLeader: false, canManage: false, canReady: true }) }); expect(button("Invite by Riot ID").props.accessibilityState.disabled).toBe(true);
  update({ model: model({ isQueueing: true, canJoinParty: false }) });
  expect(button("Join by code").props.accessibilityState.disabled).toBe(true); expect(button("Invite by Riot ID").props.accessibilityState.disabled).toBe(true);
});
it.each(["CODE!", "CODE/123", "éCODE", "A".repeat(65), "CODE\nTAIL"])("rejects backend-invalid join code %j before callback", async code => {
  mount(); await press("Join by code"); input(code); await press("Join party");
  expect(props.actions.onJoinCode).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Text).some(node => node.props.accessibilityRole === "alert")).toBe(true);
});
it.each(["a", "Ab0_-", "A".repeat(64)])("accepts backend-valid join code %j", async code => {
  mount(); await press("Join by code"); input(code); await press("Join party");
  expect(props.actions.onJoinCode).toHaveBeenCalledWith(code);
});
it.each(["Name\u0000#TAG", "Name\t#TAG", "Name#TA\u007fG", "\nName#TAG", "Name#TAG\r"])("rejects control characters in raw Riot ID %j", async riotId => {
  mount(); await press("Invite by Riot ID"); input(riotId); await press("Send invite");
  expect(props.actions.onInviteByName).not.toHaveBeenCalled();
});
it("rejects saved submit and open handlers after manage permission is revoked", async () => {
  mount(); const open = button("Invite by Riot ID").props.onPress;
  await press("Invite by Riot ID"); input("Name#TAG"); const submit = button("Send invite").props.onPress;
  update({ model: model({ canManage: false }) });
  act(() => { submit(); open(); });
  expect(props.actions.onInviteByName).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});
it("keeps parent errors in the form and disables form controls while globally busy", async () => {
  mount(); await press("Join by code"); input("CODE"); update({ errorMessage: "Join rejected", busyAction: "join" });
  expect(button("Join party").props.accessibilityState.disabled).toBe(true);
  expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === "Join rejected")).toBe(true);
});
it("compacts every section while retaining touch targets and scalable minimum heights", () => {
  expect(s.heading.fontSize).toBe(22); expect(s.sectionTitle.fontSize).toBe(18); expect(s.title.fontSize).toBe(14);
  expect(s.memberProfile.minHeight).toBe(48); expect(s.readyTouch.minHeight).toBe(48); expect(s.settingsRow.minHeight).toBe(56);
  expect(s.friendCard.width).toBe(96); expect(s.friendAvatar.width).toBe(48); expect(s.primary.minHeight).toBe(48);
  expect(s.friendStatus.minHeight).toBe(40); expect(s.friendStatus.lineHeight).toBe(20);
  mount(); for (const label of ["Generate", "Copy", "Share", "Join by code", "Invite by Riot ID"]) {
    expect(buttonStyle(label).minHeight).toBeGreaterThanOrEqual(48);
  }
});
it("keeps form text scaling capped, labels visible and the background hidden from accessibility", async () => {
  mount(); await press("Invite by Riot ID");
  const field = renderer.root.findByType(TextInput);
  expect(field.props.maxFontSizeMultiplier).toBe(2);
  expect(field.props.accessibilityLabel).toBe("Riot ID (Name#Tag)");
  expect(field.props.autoCorrect).toBe(false);
  expect(renderer.root.findAll(node => node.props.accessibilityViewIsModal === true).length).toBeGreaterThan(0);
  expect(renderer.root.findAll(node => node.props.importantForAccessibility === "no-hide-descendants").length).toBeGreaterThan(0);
});
