import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import GlassCard from "~/components/ui/GlassCard";
import LiquidGlassSurface, { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { COLORS, GLASS_MATERIAL } from "~/constants/DesignSystem";
import Svg, { LinearGradient, Stop } from "react-native-svg";
import EmptyStateCard from "~/components/ui/EmptyStateCard";

jest.mock("expo-blur", () => ({ BlurView: "BlurView" }));
jest.mock("~/constants/Motion", () => ({ MOTION_DURATION: { standard: 220 } }));
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const entrance = { duration: () => ({ reduceMotion: () => ({}) }) };
  return { __esModule: true, default: { View }, FadeInDown: entrance, ReduceMotion: { System: "system" } };
});

const renderers: TestRenderer.ReactTestRenderer[] = [];
function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer.root;
}
afterEach(() => { act(() => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

it("flat cards remove every shadow and optical rim while preserving content and press actions", () => {
  const onPress = jest.fn();
  const root = render(<GlassCard variant="flat" testID="flat-card"
    style={{ elevation: 8, shadowOpacity: 0.4, backgroundColor: COLORS.SURFACE_MUTED }}>
    <TouchableOpacity onPress={onPress}><Text>Content</Text></TouchableOpacity>
  </GlassCard>);
  const host = root.findAll((node) => typeof node.type === "string" && node.props.testID === "flat-card")[0];
  expect(StyleSheet.flatten(host.props.style)).toMatchObject({ elevation: 0, shadowOpacity: 0, shadowRadius: 0,
    boxShadow: "none", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1 });
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  act(() => root.findByType(TouchableOpacity).props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("uses DOM-compatible decorative SVG semantics on web without a boolean native accessible attribute", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  try {
    const root = render(<LiquidGlassDecoration />);
    const svg = root.findByType(Svg);
    expect(svg.props.accessible).toBeUndefined();
    expect(svg.props["aria-hidden"]).toBe(true);
  } finally {
    Object.defineProperty(Platform, "OS", descriptor);
  }
});

it.each([false, true])("GlassCard forwards View props and content geometry (animated=%s)", (animated) => {
  const onLayout = jest.fn();
  const root = render(<GlassCard animated={animated} testID="card" onLayout={onLayout}
    accessibilityLabel="Account" accessibilityState={{ busy: true }}
    style={{ width: 214, borderRadius: 12 }} contentStyle={{ padding: 0, flex: 1 }}><Text>Account</Text></GlassCard>);
  const card = root.findAll((node) => typeof node.type === "string" && node.props.testID === "card")[0];
  expect(card.props.onLayout).toBe(onLayout);
  expect(card.props.accessibilityState).toEqual({ busy: true });
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({ width: 214, borderRadius: 12, backgroundColor: GLASS_MATERIAL.surface });
  expect(root.findAllByType(View).some((node) => StyleSheet.flatten(node.props.style)?.padding === 0)).toBe(true);
  expect(root.findByType(LiquidGlassDecoration).props.radius).toBe(12);
});

it("optical decoration cannot intercept touch or become an accessibility node", () => {
  const onPress = jest.fn();
  const root = render(<LiquidGlassSurface><TouchableOpacity accessibilityRole="button" onPress={onPress}><Text>Open</Text></TouchableOpacity></LiquidGlassSurface>);
  const decoration = root.findByType(LiquidGlassDecoration);
  const layer = decoration.findAllByType(View)[0];
  expect(layer.props).toMatchObject({ pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
  act(() => root.findByType(TouchableOpacity).props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(root.findAll((node) => String(node.type) === "BlurView")).toHaveLength(0);
});

it("keeps white foreground on a dark backing and clears legacy white overrides", () => {
  const light = render(<GlassCard style={{ backgroundColor: COLORS.SURFACE }} contentStyle={{ backgroundColor: COLORS.SURFACE }}><Text>Light</Text></GlassCard>);
  expect(light.findByType(LiquidGlassDecoration).props.tone).toBe("light");
  const dark = render(<GlassCard testID="dark" style={{ backgroundColor: COLORS.ACCENT_DEEP }}><Text style={{ color: COLORS.PURE_WHITE }}>Dark</Text></GlassCard>);
  expect(dark.findByType(LiquidGlassDecoration).props.tone).toBe("dark");
  const backing = dark.findAll((node) => typeof node.type === "string" && node.props.testID === "dark")[0];
  expect(StyleSheet.flatten(backing.props.style).backgroundColor).toBe(COLORS.ACCENT_DEEP);
  expect(light.findAllByType(View).some((node) => StyleSheet.flatten(node.props.style)?.backgroundColor === GLASS_MATERIAL.clear)).toBe(true);
});

it.each(["regular", "dense"] as const)("keeps %s material and custom content/outer bounds separate", (density) => {
  const root = render(<LiquidGlassSurface density={density} testID="surface" radius={8}
    style={{ width: 160 }} contentStyle={{ padding: 10 }}><Text>Skin name</Text></LiquidGlassSurface>);
  const surface = root.findAll((node) => typeof node.type === "string" && node.props.testID === "surface")[0];
  expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ width: 160, borderRadius: 8,
    backgroundColor: density === "dense" ? GLASS_MATERIAL.denseSurface : GLASS_MATERIAL.surface });
  expect(root.findByType(LiquidGlassDecoration).props).toMatchObject({ density, radius: 8 });
});

it("uses isolated gradient IDs for adjacent cards without dimming artwork", () => {
  const root = render(<View><LiquidGlassSurface /><LiquidGlassSurface tone="dark" density="dense" /></View>);
  const gradients = root.findAllByType(LinearGradient);
  expect(new Set(gradients.map((gradient) => gradient.props.id)).size).toBe(4);
  root.findAllByType(Svg).forEach((svg) => expect(svg.props).toMatchObject({ width: "100%", height: "100%", preserveAspectRatio: "none", accessible: false }));
  expect(root.findAllByType(Stop).some((stop) => stop.props.stopColor === GLASS_MATERIAL.shade)).toBe(true);
});

it("serializes transparent glass gradient stops as transparent native colors", () => {
  const root = render(<LiquidGlassSurface><Text>Sharp content</Text></LiquidGlassSurface>);
  const gradients = root.findAllByType(LinearGradient);
  const extractGradient = jest.requireActual<{ default: (
    props: { id: string; children: React.ReactElement[] }, parent: null,
  ) => { gradient: number[] } }>("react-native-svg/lib/commonjs/lib/extract/extractGradient").default;
  for (const gradient of gradients) {
    const children = gradient.findAllByType(Stop).map((stop) => React.createElement(Stop, stop.props));
    const native = extractGradient({ id: gradient.props.id, children }, null);
    const alphas = native.gradient.filter((_, index) => index % 2 === 1).map((color) => (color >>> 24) / 255);
    expect(alphas).toContain(0);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.73);
  }
});

it("gives inline empty support cards glass without painting a whole empty screen", () => {
  const inline = render(<EmptyStateCard title="No skins" subtitle="Refresh to try again" icon={<Text>Icon</Text>} style={{ width: 200 }} />);
  expect(inline.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
  expect(inline.findAllByType(Text).map((text) => text.props.children)).toContain("Refresh to try again");
  const centered = render(<EmptyStateCard centered title="No skins" />);
  expect(centered.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
});
