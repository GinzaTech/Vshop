import React from "react";
import { Modal, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import AgentSelectModal from "~/features/party/AgentSelectModal";
import type { AgentSelectModalProps } from "~/features/party/party-types";

let mockReduceMotion = false;
jest.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
}) }));
jest.mock("react-native-reanimated", () => {
  const { View, Easing } = require("react-native") as typeof import("react-native");
  const animation = { duration: () => animation, reduceMotion: () => animation };
  return { __esModule: true, default: { View }, Easing, FadeInDown: animation, ReduceMotion: { System: "system" },
    cancelAnimation: jest.fn(), useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(), withSpring: (value: number) => value };
});
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduceMotion }));
jest.mock("~/utils/flow-tracer", () => ({ flowTracer: { track: jest.fn() } }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 12, bottom: 12, left: 0, right: 0 }) }));

function agent(uuid: string, displayName: string): ValorantAgent {
  return { uuid, displayName, displayIcon: "", role: { uuid: "role", description: "", displayIcon: "" } };
}
let renderer: TestRenderer.ReactTestRenderer;
function mount(overrides: Partial<AgentSelectModalProps> = {}) {
  const props: AgentSelectModalProps = { visible: true, agents: [agent("a", "A very long real agent name"), agent("b", "Other agent")],
    selectedAgentId: null, unavailableAgentIds: ["b"], locking: false, errorMessage: null,
    onSelect: jest.fn(), onLock: jest.fn(), onClose: jest.fn(), ...overrides };
  act(() => { renderer = TestRenderer.create(<AgentSelectModal {...props} />); }); return props;
}
function button(label: string) { return renderer.root.findAll(node => node.props.accessibilityRole === "button" &&
  (node.props.accessibilityLabel === label || node.findAllByType(Text).some(text => text.props.children === label)))[0]; }
async function press(label: string) { await act(async () => { await button(label).props.onPress(); }); }
afterEach(() => { act(() => renderer?.unmount()); mockReduceMotion = false; });

describe("Pregame-only agent modal", () => {
  it("does not render a closed modal", () => { mount({ visible: false }); expect(renderer.toJSON()).toBeNull(); });
  it("renders a grid without role filters and marks unavailable agents disabled", () => {
    mount(); expect(button("Other agent").props.accessibilityState.disabled).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === "Duelist")).toBe(false);
    expect(renderer.root.findAllByType(Text).find(node => node.props.children === "A very long real agent name")?.props.numberOfLines).toBe(1);
  });
  it("selection invokes only onSelect and is accessible after the parent updates", async () => {
    const props = mount(); await press("A very long real agent name");
    expect(props.onSelect).toHaveBeenCalledWith("a"); expect(props.onLock).not.toHaveBeenCalled();
    act(() => renderer.update(<AgentSelectModal {...props} selectedAgentId="a" />));
    expect(button("A very long real agent name").props.accessibilityState.selected).toBe(true);
  });
  it.each([null, "b", "unknown"])("disables Lock for invalid selection %s", selectedAgentId => {
    mount({ selectedAgentId }); expect(button("Lock agent").props.accessibilityState.disabled).toBe(true);
  });
  it("locks only by explicit button press and does not close on success itself", async () => {
    const props = mount({ selectedAgentId: "a" }); expect(props.onLock).not.toHaveBeenCalled(); await press("Lock agent");
    expect(props.onLock).toHaveBeenCalledTimes(1); expect(props.onClose).not.toHaveBeenCalled();
  });
  it("close and Android back call only local onClose", async () => {
    const props = mount(); await press("Close agent selection");
    act(() => renderer.root.findByType(Modal).props.onRequestClose());
    expect(props.onClose).toHaveBeenCalledTimes(2); expect(props.onLock).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled();
  });
  it("locks every interaction while locking", () => {
    mount({ locking: true, selectedAgentId: "a" });
    ["Lock agent", "A very long real agent name", "Close agent selection"]
      .forEach(label => expect(button(label).props.accessibilityState.disabled).toBe(true));
  });
  it("guards two lock presses before a parent render", async () => {
    let resolve!: () => void; const onLock = jest.fn(() => new Promise<void>(done => { resolve = done; }));
    mount({ selectedAgentId: "a", onLock }); const lock = button("Lock agent");
    act(() => { void lock.props.onPress(); void lock.props.onPress(); });
    expect(onLock).toHaveBeenCalledTimes(1); await act(async () => { resolve(); });
  });
  it("keeps parent failure visible with selected agent and supports retry", () => {
    mount({ selectedAgentId: "a", errorMessage: "Lock failed. Try again." });
    expect(renderer.root.findAllByType(Text).find(node => node.props.children === "Lock failed. Try again.")?.props.accessibilityRole).toBe("alert");
    expect(button("A very long real agent name").props.accessibilityState.selected).toBe(true);
    expect(button("Lock agent").props.accessibilityState.disabled).toBe(false);
  });
  it("retains modal on callback rejection", async () => {
    const props = mount({ selectedAgentId: "a", onLock: jest.fn().mockRejectedValue(new Error("failure")) });
    await press("Lock agent"); expect(props.onClose).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === "Unable to lock agent. Please try again.")).toBe(true);
  });
  it("uses native modal isolation and no transition under Reduce Motion", () => {
    mockReduceMotion = true; mount(); expect(renderer.root.findByType(Modal).props.animationType).toBe("none");
    expect(renderer.root.findAll(node => node.props.accessibilityViewIsModal === true).length).toBeGreaterThan(0);
  });
  it("shows empty agents as unavailable with Lock disabled", () => {
    mount({ agents: [] }); expect(button("Lock agent").props.accessibilityState.disabled).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === "Agents unavailable")).toBe(true);
  });
  it("does not select unavailable agents and retains selected accessible state", () => {
    const props = mount({ selectedAgentId: "b" });
    const unavailable = button("Other agent");
    expect(unavailable.props.accessibilityState).toMatchObject({ selected: true, disabled: true });
    act(() => unavailable.props.onPress()); expect(props.onSelect).not.toHaveBeenCalled();
  });
  it("supports agent images and keeps returned false lock failures visible", async () => {
    mount({ agents: [{ ...agent("a", "Real agent"), displayIcon: "https://example.com/agent.png" }],
      selectedAgentId: "a", unavailableAgentIds: undefined, onLock: jest.fn().mockResolvedValue(false) });
    await press("Lock agent");
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === "Unable to lock agent. Please try again.")).toBe(true);
  });
});
