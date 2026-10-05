import React from "react";
import { TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import LocalUiQaScreen from "~/mocks/ui-qa";
import { createUiQaTransport, QA_USER, createQaLoadout, QA_WRITE_DELAY_MS } from "~/mocks/ui-qa-data";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import { ProfileExpressionSection } from "~/features/profile/ProfileEquipmentSections";
jest.mock("~/components/ui/refractive-glass", () => jest.requireActual("./helpers/refractive-glass-mock"));

const mockRiot = jest.fn((...args: unknown[]) => { void args; throw new Error("QA must never call real Riot"); });
const mockUserRead = jest.fn(() => { throw new Error("QA must not access the real session"); });
const mockCacheRead = jest.fn(() => { throw new Error("QA must not access persistent profile cache"); });
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  return { __esModule: true, default: { View: require("react-native").View },
    cancelAnimation: jest.fn(), useReducedMotion: () => false, ReduceMotion: { System: "system" },
    Easing: { out: () => undefined, inOut: () => undefined, cubic: () => undefined, bezier: () => undefined },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(), withTiming: (value: number) => value,
  };
});
jest.mock("~/utils/valorant-api", () => ({ playerLoadout: (...args: unknown[]) => mockRiot(...args), updatePlayerLoadoutV3First: (...args: unknown[]) => mockRiot(...args) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => mockUserRead() } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => mockCacheRead() } }));
jest.mock("~/utils/profile-cache", () => ({ PROFILE_LOADOUT_CACHE_VERSION: 5 }));
jest.mock("~/utils/recovery-update", () => ({ startRecoveryUpdate: jest.fn(() => { throw new Error("Local QA must not apply a real update"); }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("~/mocks/profile-ui", () => ({ PROFILE_DEMO_RANK: null }));
jest.mock("~/components/GalleryProfile", () => ({ FALLBACK_IMAGE: "fallback", formatSpraySlot: (slot: string) => slot }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/LiquidGlassSurface", () => ({ LiquidGlassDecoration: "LiquidGlassDecoration", LIQUID_GLASS_CARD_STYLE: {} }));
jest.mock("~/components/ui/LiquidGlassBackdrop", () => ({ __esModule: true, default: "LiquidGlassBackdrop" }));
jest.mock("~/components/SkinShowcaseCard", () => ({ __esModule: true, default: "SkinShowcaseCard" }));
jest.mock("~/components/ui/ValorantButton", () => {
  const ReactModule = require("react") as typeof React;
  const { Pressable: Button, Text: Label } = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: ({ title, onPress }: { title: string; onPress: () => void }) =>
    ReactModule.createElement(Button, { accessibilityRole: "button", accessibilityLabel: title, onPress }, ReactModule.createElement(Label, null, title)) };
});
jest.mock("react-native-paper/lib/module/components/Portal/Portal", () => ({ __esModule: true, default: "Portal" }));
jest.mock("react-native-paper/lib/module/components/Modal", () => ({ __esModule: true, default: "Modal" }));
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({ __esModule: true, default: "Searchbar" }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));
jest.mock("~/utils/content-tier", () => ({ getContentTierVisual: () => ({ cardBackground: "white", border: "gray", accent: "red" }) }));

const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
describe("Local QA drives actual Profile hooks and pickers", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const stats = () => JSON.parse(renderer.root.findByProps({ testID: "ui-qa-transport-stats" }).props.children) as {
    writeCount: number; inFlight: number; maxInFlight: number; serverVersion: number;
    desiredSkin: string; desiredTitle: string; serverSkin: string; serverTitle: string; failNext: boolean;
  };
  const press = (id: string) => act(() => renderer.root.findByProps({ testID: id })
    .find((node) => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function").props.onPress());
  const choose = (name: string) => act(() => {
    const button = renderer.root.findAllByType(TouchableOpacity).find((node) => node.findAll((text) => text.props.children === name).length > 0);
    expect(button).toBeDefined(); expect(button!.props.disabled).toBe(false); button!.props.onPress();
  });
  const chooseExpression = (kind: "spray" | "flex", id: string) => act(() => {
    const button = renderer.root.findAllByType(TouchableOpacity).find((node) => node.findAll((child) => child.props.cacheId === `${kind}:${id}:display`).length > 0);
    expect(button).toBeDefined(); expect(button!.props.disabled).toBe(false); button!.props.onPress();
  });
  beforeEach(async () => { jest.useFakeTimers(); jest.clearAllMocks(); await act(async () => { renderer = TestRenderer.create(<LocalUiQaScreen />); }); });
  afterEach(async () => {
    await act(async () => { renderer.unmount(); await flush(); }); jest.useRealTimers();
    expect(mockRiot).not.toHaveBeenCalled(); expect(mockUserRead).not.toHaveBeenCalled(); expect(mockCacheRead).not.toHaveBeenCalled();
  });
  it("closes selections immediately, keeps other pickers available, coalesces rapid skins and writes only one full payload at a time", async () => {
    press("ui-qa-open-weapon"); choose("QASkinB");
    expect(renderer.root.findByType(ProfilePickerModal).props.pickerState).toBeNull();
    expect(stats().desiredSkin).toBe("QASkinB"); await act(flush);
    expect(stats()).toMatchObject({ writeCount: 1, inFlight: 1, maxInFlight: 1, serverVersion: 1 });
    press("ui-qa-open-title"); choose("QATitleB");
    press("ui-qa-open-weapon"); choose("QASkinA"); press("ui-qa-open-weapon"); choose("QASkinC");
    expect(stats()).toMatchObject({ desiredSkin: "QASkinC", desiredTitle: "QATitleB", inFlight: 1 });
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS); });
    expect(stats()).toMatchObject({ writeCount: 2, maxInFlight: 1, desiredSkin: "QASkinC", desiredTitle: "QATitleB", serverVersion: 2 });
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS); });
    expect(stats()).toMatchObject({ writeCount: 2, inFlight: 0, maxInFlight: 1, serverVersion: 3, serverSkin: "QASkinC", serverTitle: "QATitleB" });
  });
  it("shows the configured local transport latency instead of a stale hardcoded note", () => {
    expect(renderer.root.findByProps({ testID: "ui-qa-latency-note" }).props.children.join("")).toContain(String(QA_WRITE_DELAY_MS));
  });
  it("isolates background accessibility while a picker is open and restores it after dismissal", () => {
    press("ui-qa-open-weapon");
    const background = renderer.root.findByProps({ testID: "ui-qa-screen" });
    expect(background.props.accessibilityElementsHidden).toBe(true);
    expect(background.props["aria-hidden"]).toBe(true);
    const route = renderer.root.findByProps({ testID: "ui-qa-route" });
    expect(route.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(background.props.importantForAccessibility).toBe("no-hide-descendants");
    act(() => renderer.root.findByType(ProfilePickerModal).props.handleDismissPicker());
    const restored = renderer.root.findByProps({ testID: "ui-qa-screen" });
    expect(restored.props.accessibilityElementsHidden).toBe(false);
    expect(restored.props.importantForAccessibility).toBe("auto");
  });
  it("fails exactly the next write and rolls back only that field while retaining a later title choice", async () => {
    press("ui-qa-fail-next"); expect(stats().failNext).toBe(true);
    press("ui-qa-open-weapon"); choose("QASkinB"); await act(flush);
    press("ui-qa-open-title"); choose("QATitleB");
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS); });
    expect(stats()).toMatchObject({ desiredSkin: "QASkinA", desiredTitle: "QATitleB", writeCount: 2, serverVersion: 1 });
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS); });
    expect(stats()).toMatchObject({ inFlight: 0, serverSkin: "QASkinA", serverTitle: "QATitleB", serverVersion: 2, failNext: false });
    expect(renderer.root.findByProps({ testID: "ui-qa-error" }).props.children).toContain("not confirmed");
  });
  it("renders all four actual expression cells and opens the actual picker through their callbacks", () => {
    const section = renderer.root.findByType(ProfileExpressionSection);
    const cells = section.findAllByType(TouchableOpacity); expect(cells).toHaveLength(4);
    cells.forEach((cell, slotIndex) => {
      act(() => cell.props.onPress());
      expect(renderer.root.findByType(ProfilePickerModal).props.pickerState).toMatchObject({ type: "expression", expression: { slotIndex } });
      act(() => renderer.root.findByType(ProfilePickerModal).props.handleDismissPicker());
    });
    const previews = renderer.root.findByProps({ testID: "ui-qa-glass-previews" });
    expect(previews.props.pointerEvents).toBe("none"); expect(previews.props.accessibilityElementsHidden).toBe(true);
    expect(previews.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(previews.findAllByType("SkinShowcaseCard" as React.ElementType)).toHaveLength(3);
  });
  it("reset cancels a pending local write, removes old callbacks and creates a clean server", async () => {
    press("ui-qa-open-weapon"); choose("QASkinB"); await act(flush);
    const retained = renderer.root.findByType(ProfilePickerModal).props.handleEquipIdentity;
    press("ui-qa-reset"); await act(flush);
    expect(stats()).toMatchObject({ writeCount: 0, inFlight: 0, serverVersion: 1, desiredSkin: "QASkinA", desiredTitle: "QATitleA" });
    await act(async () => { await retained("player-title", "qa-title-b"); await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS * 3); });
    expect(stats()).toMatchObject({ writeCount: 0, serverVersion: 1 });
    expect(jest.getTimerCount()).toBe(0);
  });
  it("keeps the DEV transport usable through StrictMode's cleanup/setup replay", async () => {
    await act(async () => { renderer.unmount(); await flush(); });
    await act(async () => { renderer = TestRenderer.create(<React.StrictMode><LocalUiQaScreen /></React.StrictMode>); await flush(); });
    press("ui-qa-open-weapon"); choose("QASkinB"); await act(flush);
    expect(stats()).toMatchObject({ writeCount: 1, inFlight: 1 });
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS); });
    expect(stats()).toMatchObject({ serverSkin: "QASkinB", serverVersion: 2, inFlight: 0 });
  });
  it("equips actual spray/flex picker options and rejects retained UI controls after unmount", async () => {
    const firstCell = renderer.root.findByType(ProfileExpressionSection).findAllByType(TouchableOpacity)[0];
    act(() => firstCell.props.onPress()); chooseExpression("spray", "qa-spray-b"); await act(flush);
    const expressionProps = renderer.root.findByType(ProfilePickerModal).props;
    act(() => expressionProps.handleOpenExpressionPicker({ id: "qa-slot-2", name: "QASlot2", kind: "spray", slotIndex: 1 }, "flex"));
    chooseExpression("flex", "qa-flex-a");
    await act(async () => { await jest.advanceTimersByTimeAsync(QA_WRITE_DELAY_MS * 2); });
    const evidence = JSON.parse(renderer.root.findByProps({ testID: "ui-qa-transport-stats" }).props.children) as { desiredExpressionAssets: string[]; serverExpressionAssets: string[] };
    expect(evidence.desiredExpressionAssets.slice(0, 2)).toEqual(["qa-spray-b", "qa-flex-a"]);
    expect(evidence.serverExpressionAssets.slice(0, 2)).toEqual(["qa-spray-b", "qa-flex-a"]);
    const retainedControls = ["ui-qa-open-weapon", "ui-qa-open-title", "ui-qa-fail-next", "ui-qa-reset"].map((id) =>
      renderer.root.findByProps({ testID: id }).find((node) => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function").props.onPress as () => void);
    const retainedOpen = renderer.root.findByType(ProfilePickerModal).props.handleOpenExpressionPicker;
    const retainedDismiss = renderer.root.findByType(ProfilePickerModal).props.handleDismissPicker;
    await act(async () => { renderer.unmount(); await flush(); });
    const libraryCleanupTimers = jest.getTimerCount();
    expect(() => { retainedControls.forEach((callback) => callback()); retainedDismiss(); retainedOpen({ slotIndex: 0, kind: "flex" }); }).not.toThrow();
    // Native list/pressability can leave scheduled cleanup; stale QA callbacks add none.
    expect(jest.getTimerCount()).toBe(libraryCleanupTimers);
  });
});

describe("local simulated transport cleanup", () => {
  it("rejects pending and future work after disposal and never leaves timers running", async () => {
    jest.useFakeTimers();
    const transport = createUiQaTransport(); const owner = { ...QA_USER, generation: transport.runtime.getGeneration() };
    const write = transport.runtime.write(owner, createQaLoadout()); const result = expect(write).rejects.toThrow("disposed");
    transport.dispose(); await result;
    expect(transport.getSnapshot().inFlight).toBe(0); expect(jest.getTimerCount()).toBe(0);
    await expect(transport.runtime.read(owner)).rejects.toThrow("disposed");
    await expect(transport.runtime.write(owner, createQaLoadout())).rejects.toThrow("disposed");
    jest.useRealTimers();
  });
});

it("switches startup preview into recovery, checks a local update and retries without external actions", () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<LocalUiQaScreen startupPreview />); });
  expect(renderer.root.findAllByProps({ testID: "startup-recovery-panel" })).toHaveLength(0);
  act(() => renderer.update(<LocalUiQaScreen startupPreview recoveryPreview />));
  expect(renderer.root.findByProps({ testID: "startup-recovery-panel" })).toBeDefined();
  act(() => renderer.root.findByProps({ testID: "recovery-check-update-button" }).props.onPress());
  expect(renderer.root.findByProps({ testID: "recovery-update-status" }).props.children).toBe("VShop is already up to date.");
  act(() => renderer.root.findByProps({ testID: "startup-retry-button" }).props.onPress());
  expect(renderer.root.findAllByProps({ testID: "startup-recovery-panel" })).toHaveLength(0);
  expect(mockRiot).not.toHaveBeenCalled(); expect(mockUserRead).not.toHaveBeenCalled(); expect(mockCacheRead).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
