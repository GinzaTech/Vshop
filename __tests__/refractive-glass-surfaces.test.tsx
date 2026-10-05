import React from "react";
import { AppState, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { RefractiveGlassCard, RefractiveGlassViewport, GlassClip } from "~/components/ui/refractive-glass";
import { MORE_GLASS_MATERIAL, COLORS } from "~/constants/DesignSystem";

let mockFocused = true, mockOpaque = false;
const mockMeasures = new Map<string, { pageX: number; pageY: number; width: number; height: number }>();
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("~/components/ui/liquid-glass-native-policy", () => ({ useNativeGlassPreferences: () => ({ reduceTransparency: mockOpaque }) }));
jest.mock("~/components/ui/more-glass/MoreGlassCard", () => ({ MoreGlassRim: "Rim" }));
jest.mock("~/components/ui/more-glass/MoreGlassWallpaper", () => ({ MORE_WHITE_WALLPAPER: 77 }));
jest.mock("~/components/ui/refractive-glass/renderer", () => ({ GlassRenderer: (props: { enabled: boolean; onAvailabilityChange: (ready: boolean) => void }) => {
  const R = require("react") as typeof React;
  R.useEffect(() => { props.onAvailabilityChange(props.enabled); return () => props.onAvailabilityChange(false); }, [props.enabled, props.onAvailabilityChange]);
  return R.createElement("Renderer", props);
} }));
jest.mock("react-native-worklets", () => ({ isUIRuntime: () => true, scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args) }));
jest.mock("react-native-reanimated", () => {
  const R = require("react") as typeof React, native = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: { View: native.View, ScrollView: native.ScrollView, createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (value: unknown) => R.useRef({ value }).current,
    useAnimatedRef: () => R.useMemo(() => {
      const ref = Object.assign((node?: { id: string } | null) => { if (node !== undefined) ref.current = node; return ref.current; }, { current: null as { id: string } | null });
      return ref;
    }, []),
    measure: (ref: { current: { id?: string; props?: { testID?: string } } | null }) => ref.current
      ? mockMeasures.get(ref.current.id ?? ref.current.props?.testID ?? "") ?? null : null,
    useScrollOffset: () => R.useRef({ value: 0 }).current,
    useDerivedValue: (factory: () => unknown) => { const latest = R.useRef(factory); latest.current = factory; return R.useMemo(() => ({ get value() { return latest.current(); } }), []); },
    useAnimatedStyle: (factory: () => object) => new Proxy({}, { get: (_target, key) => Reflect.get(factory(), key), ownKeys: () => Reflect.ownKeys(factory()),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    useAnimatedReaction: (prepare: () => unknown, react: (current: unknown, previous: unknown) => void) => {
      const previous = R.useRef<unknown>(null);
      R.useLayoutEffect(() => { const current = prepare(); const old = previous.current; previous.current = current; react(current, old); });
    },
  };
});

let renderer: TestRenderer.ReactTestRenderer;
const appStateDescriptor = Object.getOwnPropertyDescriptor(AppState, "currentState");
function tree({ open = true, show = true, enabled }: { open?: boolean; show?: boolean; enabled?: boolean } = {}) {
  return <RefractiveGlassViewport testID="root" enabled={enabled}><GlassClip materialOnly testID="clip" height={{ value: open ? 200 : 0 } as import("react-native-reanimated").SharedValue<number>}>
    {show ? <RefractiveGlassCard testID="card"><View testID="sharp-content" /></RefractiveGlassCard> : null}
  </GlassClip></RefractiveGlassViewport>;
}
function cardStyle() { return StyleSheet.flatten(renderer.root.findAllByType(View).find(node => node.props.testID === "card")!.props.style); }
function node(name: string) { return renderer.root.find(item => typeof item.type === "string" && String(item.type) === name); }
beforeEach(() => {
  mockFocused = true; mockOpaque = false;
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
  Object.defineProperty(globalThis, "_WORKLET", { configurable: true, value: true });
  mockMeasures.set("root", { pageX: 0, pageY: 0, width: 360, height: 640 });
  mockMeasures.set("clip", { pageX: 0, pageY: 20, width: 360, height: 200 });
  mockMeasures.set("card", { pageX: 20, pageY: 60, width: 110, height: 96 });
  act(() => { renderer = TestRenderer.create(tree(), { createNodeMock: element => ({ id: (element.props as { testID?: string }).testID }) }); });
  act(() => { renderer.root.findAllByType(View).find(item => item.props.testID === "root")!.props.onLayout({ nativeEvent: { layout: { width: 360, height: 640 } } }); });
});
afterEach(() => { act(() => renderer.unmount()); mockMeasures.clear(); Object.defineProperty(globalThis, "_WORKLET", { configurable: true, value: false });
  if (appStateDescriptor) Object.defineProperty(AppState, "currentState", appStateDescriptor);
});

it("uses one bounded renderer and measured More-standard material behind sharp mounted content", () => {
  expect(renderer.root.findAll(item => typeof item.type === "string" && String(item.type) === "Renderer")).toHaveLength(1);
  expect(node("Renderer").props).toMatchObject({ enabled: true, width: 360, height: 640, wallpaperSource: 77 });
  expect(cardStyle()).toMatchObject({ backgroundColor: "transparent", borderRadius: MORE_GLASS_MATERIAL.radius, elevation: 0, shadowOpacity: 0, boxShadow: "none" });
  expect(node("Renderer").props.projection.value.cardCount).toBe(1);
});
it("excludes closed materials while preserving native content and material-only layout", () => {
  const content = renderer.root.findAllByType(View).find(item => item.props.testID === "sharp-content");
  act(() => renderer.update(tree({ open: false })));
  expect(node("Renderer").props.projection.value.cardCount).toBe(0);
  expect(cardStyle().backgroundColor).toBe(MORE_GLASS_MATERIAL.tint);
  expect(renderer.root.findAllByType(View).find(item => item.props.testID === "sharp-content")).toBe(content);
  const clip = renderer.root.findAllByType(View).find(item => item.props.testID === "clip")!;
  expect(StyleSheet.flatten(clip.props.style).height).toBeUndefined();
});
it("respects Reduce Transparency and focus without remounting the card owners", () => {
  const content = renderer.root.findAllByType(View).find(item => item.props.testID === "sharp-content");
  mockOpaque = true; act(() => renderer.update(tree()));
  expect(node("Renderer").props.enabled).toBe(false);
  expect(cardStyle().backgroundColor).toBe(COLORS.SURFACE);
  mockOpaque = false; mockFocused = false; act(() => renderer.update(tree()));
  expect(node("Renderer").props.enabled).toBe(false);
  expect(renderer.root.findAllByType(View).find(item => item.props.testID === "sharp-content")).toBe(content);
});
it("cleans removed registrations and disables drawing after the last card leaves", () => {
  act(() => renderer.update(tree({ show: false })));
  expect(node("Renderer").props.enabled).toBe(false);
  expect(node("Renderer").props.projection.value.cardCount).toBe(0);
});
it("does not let an explicit enable override a blurred route", () => {
  mockFocused = false;
  act(() => renderer.update(tree({ enabled: true })));
  expect(node("Renderer").props.enabled).toBe(false);
});
it("applies the same reveal height to native clipping when materialOnly is omitted", () => {
  act(() => renderer.update(<RefractiveGlassViewport testID="root"><GlassClip testID="clip" height={{ value: 64 } as import("react-native-reanimated").SharedValue<number>}>
    <RefractiveGlassCard testID="card"><View /></RefractiveGlassCard>
  </GlassClip></RefractiveGlassViewport>));
  const clip = renderer.root.findAllByType(View).find(item => item.props.testID === "clip")!;
  expect(StyleSheet.flatten(clip.props.style)).toMatchObject({ height: 64, overflow: "hidden" });
});
