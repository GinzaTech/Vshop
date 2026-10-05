import React from "react";
import { AppState, StyleSheet, TouchableOpacity, View, type AppStateStatus, type LayoutChangeEvent, type LayoutRectangle } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import GlassCard from "~/components/ui/GlassCard";
import { MoreGlassCard } from "~/components/ui/more-glass/MoreGlassCard";
import { MoreGlassGrid } from "~/components/ui/more-glass/MoreGlassGrid";
import { MoreGlassRenderer } from "~/components/ui/more-glass/MoreGlassRenderer";
import type { MoreGlassRendererProps } from "~/components/ui/more-glass/MoreGlassRenderer.types";
import { MORE_GLASS_CARD_COUNT, buildMoreGlassUniforms, updateMoreGlassRect, type MoreGlassRects } from "~/components/ui/more-glass/more-glass-model";

let mockFocused = true;
let mockPreferenceState = { reduceTransparency: false, reduceMotion: false };
const mockPreferences = jest.fn((_active: boolean) => mockPreferenceState);
const mockSharpUnmount = jest.fn();
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("~/components/ui/liquid-glass-native-policy", () => ({
  useNativeGlassPreferences: (active: boolean) => mockPreferences(active),
}));
jest.mock("~/components/ui/more-glass/MoreGlassRenderer", () => ({
  MoreGlassRenderer: (props: MoreGlassRendererProps) => {
    const ReactModule = require("react") as typeof React;
    return ReactModule.createElement("ControlledRenderer", props);
  },
}));

jest.mock("react-native-reanimated", () => {
  const Native = require("react-native") as typeof import("react-native");
  const entrance = { duration: () => entrance, reduceMotion: () => entrance };
  return { __esModule: true, default: { View: Native.View }, Easing: Native.Easing, FadeInDown: entrance, ReduceMotion: { System: "system" } };
});

const rectangle: LayoutRectangle = { x: 8, y: 12, width: 150, height: 112 };
const empty = (): MoreGlassRects => Object.freeze(Array.from({ length: MORE_GLASS_CARD_COUNT }, () => null));
const complete = (): MoreGlassRects => Array.from({ length: MORE_GLASS_CARD_COUNT }, (_, index) => ({
  x: index % 2 * 160, y: Math.floor(index / 2) * 122, width: 150, height: 112,
}));

describe("More measured refractive geometry", () => {
  it("registers a valid measured rectangle immutably instead of retaining empty layout", () => {
    const original = empty();
    const next = updateMoreGlassRect(original, 3, rectangle);
    expect(next).not.toBe(original);
    expect(original[3]).toBeNull();
    expect(next[3]).toEqual(rectangle);
    expect(next[3]).not.toBe(rectangle);
    expect(next).toHaveLength(10);
    expect(next[0]).toBe(original[0]);
  });

  it("reuses layout identity within half a dp and updates meaningful movement", () => {
    const original = updateMoreGlassRect(empty(), 3, rectangle);
    expect(updateMoreGlassRect(original, 3, { ...rectangle })).toBe(original);
    expect(updateMoreGlassRect(original, 3, { ...rectangle, x: 8.49, width: 150.49 })).toBe(original);
    const changed = updateMoreGlassRect(original, 3, { ...rectangle, x: 8.51 });
    expect(changed).not.toBe(original);
    expect(changed[3]?.x).toBe(8.51);
  });

  it.each([-1, 10, 0.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid slot %s without changing identity", (index) => {
    const original = empty();
    expect(updateMoreGlassRect(original, index, rectangle)).toBe(original);
  });

  it.each([
    { ...rectangle, width: 0 }, { ...rectangle, height: -1 },
    { ...rectangle, x: Number.NaN }, { ...rectangle, y: Number.POSITIVE_INFINITY },
    { ...rectangle, x: -1 }, { ...rectangle, y: -1 },
    { ...rectangle, width: Number.NaN }, { ...rectangle, height: Number.POSITIVE_INFINITY },
  ])("ignores invalid geometry %j", (layout) => {
    const original = empty();
    expect(updateMoreGlassRect(original, 0, layout)).toBe(original);
  });

  it("exports all ten registered bounds as finite shader uniforms", () => {
    const rectangles = complete();
    const uniforms = buildMoreGlassUniforms(320, 610, rectangles);
    expect(uniforms.ready).toBe(true);
    expect(uniforms.resolution).toEqual([320, 610]);
    expect(uniforms.cards).toEqual(rectangles.flatMap((rect) => [rect!.x, rect!.y, rect!.width, rect!.height]));
    expect(uniforms.cards).toHaveLength(40);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it.each([[0, 610], [320, 0], [-1, 610], [Number.NaN, 610], [320, Number.POSITIVE_INFINITY]])("keeps invalid %s×%s canvas dimensions out of the ready path", (width, height) => {
    const uniforms = buildMoreGlassUniforms(width, height, complete());
    expect(uniforms.ready).toBe(false);
    expect(uniforms.resolution.every(Number.isFinite)).toBe(true);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("does not mark an incomplete rectangle set ready", () => {
    expect(buildMoreGlassUniforms(320, 610, empty()).ready).toBe(false);
    expect(buildMoreGlassUniforms(320, 610, complete().slice(0, 9)).ready).toBe(false);
  });

  it("rejects sparse arrays whose ten-slot length hides missing measured rectangles", () => {
    const sparse = new Array<LayoutRectangle | null>(MORE_GLASS_CARD_COUNT);
    sparse[0] = { x: 0, y: 0, width: 150, height: 112 };
    const uniforms = buildMoreGlassUniforms(320, 610, sparse);
    expect(uniforms.ready).toBe(false);
    expect(uniforms.cards).toHaveLength(40);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("invalidates rectangles outside the resized canvas and pads the rejected uniform slot", () => {
    const uniforms = buildMoreGlassUniforms(300, 610, complete());
    expect(uniforms.ready).toBe(false);
    expect(uniforms.cards.slice(4, 8)).toEqual([0, 0, 0, 0]);
    expect(uniforms.cards).toHaveLength(40);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("sanitizes invalid directly supplied rectangles rather than sending NaN to the shader", () => {
    const rectangles = [...complete()];
    rectangles[2] = { ...rectangle, width: Number.NaN };
    const uniforms = buildMoreGlassUniforms(320, 610, rectangles);
    expect(uniforms.ready).toBe(false);
    expect(uniforms.cards).toHaveLength(40);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("uses a low white veil with finite lens controls instead of the rejected opaque frost", () => {
    const uniforms = buildMoreGlassUniforms(320, 610, complete());
    expect(uniforms.whiteVeil).toBeGreaterThanOrEqual(0);
    expect(uniforms.whiteVeil).toBeLessThanOrEqual(0.2);
    for (const control of [uniforms.refraction, uniforms.bevelWidth, uniforms.cornerRadius, uniforms.zoom]) {
      expect(Number.isFinite(control)).toBe(true);
      expect(control).toBeGreaterThan(0);
    }
    expect(uniforms.zoom).toBeGreaterThan(1);
    expect([...uniforms.baseColor, ...uniforms.silverColor].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
    expect(uniforms).not.toHaveProperty("time");
  });
});

it("replaces the old white GlassCard frost instead of layering it over a refractive tile", () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<MoreGlassCard index={0}><View testID="sharp-content" /></MoreGlassCard>); });
    expect(renderer.root.findAllByType(GlassCard).length).toBe(0);
    expect(renderer.root.findByProps({ testID: "sharp-content" })).toBeDefined();
  } finally { act(() => renderer?.unmount()); }
});

function layoutEvent(layout: LayoutRectangle): LayoutChangeEvent {
  return { nativeEvent: { layout } } as LayoutChangeEvent;
}

function SharpContent({ index }: { index: number }) {
  const [identity] = React.useState(() => ({ index }));
  React.useEffect(() => () => mockSharpUnmount(index), [index]);
  return React.createElement("SharpContent", { testID: `sharp-${index}`, identity });
}

function gridTree(enabled?: boolean) {
  return <MoreGlassGrid testID="measured-grid" enabled={enabled}>
    {({ onCardLayout }) => Array.from({ length: 10 }, (_, index) => (
      <TouchableOpacity key={index} testID={`measured-button-${index}`} accessibilityRole="button"
        onLayout={(event) => onCardLayout(index, event)}>
        <MoreGlassCard index={index} testID={`material-${index}`}><SharpContent index={index} /></MoreGlassCard>
      </TouchableOpacity>
    ))}
  </MoreGlassGrid>;
}

describe("More grid resource and owner lifecycle", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let subscription: jest.SpyInstance;
  let stateChange: (state: AppStateStatus) => void;
  let remove: jest.Mock;
  let stateDescriptor: PropertyDescriptor | undefined;
  const gpu = () => renderer.root.findAllByType(MoreGlassRenderer)[0];
  const enabled = () => gpu()?.props.enabled === true;
  const material = () => StyleSheet.flatten(renderer.root.findAllByType(View).find((node) => node.props.testID === "material-0")!.props.style);
  const ready = () => { act(() => { gpu().props.onAvailabilityChange(true); }); };
  function measure() {
    act(() => {
      renderer.root.findAllByType(View).find((node) => node.props.testID === "measured-grid")!.props.onLayout(layoutEvent({ x: 0, y: 0, width: 320, height: 610 }));
      complete().forEach((rect, index) => {
        renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === `measured-button-${index}`)!.props.onLayout(layoutEvent(rect!));
      });
    });
  }
  beforeEach(() => {
    mockFocused = true;
    mockPreferenceState = { reduceTransparency: false, reduceMotion: false };
    mockPreferences.mockClear(); mockSharpUnmount.mockClear();
    stateDescriptor = Object.getOwnPropertyDescriptor(AppState, "currentState");
    Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
    remove = jest.fn();
    subscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
      stateChange = callback;
      return { remove };
    });
    act(() => { renderer = TestRenderer.create(gridTree()); });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    subscription.mockRestore();
    if (stateDescriptor) Object.defineProperty(AppState, "currentState", stateDescriptor);
    else Reflect.deleteProperty(AppState, "currentState");
  });

  it("registers outer coordinates into one renderer while preserving sharp children above it", () => {
    measure();
    expect(renderer.root.findAllByType(MoreGlassRenderer)).toHaveLength(1);
    expect(gpu().props).toMatchObject({ width: 320, height: 610, enabled: true, rects: complete() });
    expect(renderer.root.findAllByType(MoreGlassCard)).toHaveLength(10);
    const identities = Array.from({ length: 10 }, (_, index) => renderer.root.findByProps({ testID: `sharp-${index}` }).props.identity);
    ready();
    expect(material().backgroundColor).toBe("transparent");
    for (const [index, identity] of identities.entries()) {
      expect(renderer.root.findByProps({ testID: `sharp-${index}` }).props.identity).toBe(identity);
    }
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("retires GPU readiness on blur and restores it only after the renderer reports availability", () => {
    measure(); ready();
    const identity = renderer.root.findByProps({ testID: "sharp-0" }).props.identity;
    mockFocused = false;
    act(() => { renderer.update(gridTree()); });
    expect(enabled()).toBe(false);
    expect(material().backgroundColor).not.toBe("transparent");
    mockFocused = true;
    act(() => { renderer.update(gridTree()); });
    expect(enabled()).toBe(true);
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    expect(material().backgroundColor).toBe("transparent");
    expect(renderer.root.findByProps({ testID: "sharp-0" }).props.identity).toBe(identity);
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("does not make cards transparent from availability before all ten bounds are committed", () => {
    ready();
    expect(enabled()).toBe(false);
    expect(material().backgroundColor).not.toBe("transparent");
    measure();
    expect(enabled()).toBe(true);
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    expect(material().backgroundColor).toBe("transparent");
  });

  it("ignores an older readiness callback after blur and a fresh focus generation", () => {
    measure(); ready();
    const obsolete = gpu().props.onAvailabilityChange;
    mockFocused = false;
    act(() => { renderer.update(gridTree()); obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    mockFocused = true;
    act(() => { renderer.update(gridTree()); });
    act(() => { obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    act(() => { obsolete(false); });
    expect(material().backgroundColor).toBe("transparent");
  });

  it("ignores callbacks owned by old geometry without retiring the current ready material", () => {
    measure(); ready();
    const obsolete = gpu().props.onAvailabilityChange;
    act(() => {
      renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === "measured-button-0")!.props.onLayout(
        layoutEvent({ x: 1, y: 0, width: 150, height: 112 }),
      );
    });
    expect(gpu().props.rects[0]).toEqual({ x: 1, y: 0, width: 150, height: 112 });
    act(() => { obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    act(() => { obsolete(false); });
    expect(material().backgroundColor).toBe("transparent");
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("uses fallback during an invalidating resize until all new bounds and availability are committed", () => {
    measure(); ready();
    const obsolete = gpu().props.onAvailabilityChange;
    const identity = renderer.root.findByProps({ testID: "sharp-0" }).props.identity;
    act(() => {
      renderer.root.findAllByType(View).find((node) => node.props.testID === "measured-grid")!.props.onLayout(
        layoutEvent({ x: 0, y: 0, width: 300, height: 610 }),
      );
    });
    expect(enabled()).toBe(false);
    act(() => { obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    act(() => {
      complete().forEach((rect, index) => {
        renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === `measured-button-${index}`)!.props.onLayout(
          layoutEvent({ ...rect!, x: index % 2 * 150, width: 140 }),
        );
      });
    });
    expect(enabled()).toBe(true);
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    expect(material().backgroundColor).toBe("transparent");
    expect(renderer.root.findByProps({ testID: "sharp-0" }).props.identity).toBe(identity);
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("disables GPU in background and respects an explicit disabled override", () => {
    measure(); ready();
    act(() => { stateChange("background"); });
    expect(enabled()).toBe(false);
    act(() => { stateChange("active"); });
    expect(enabled()).toBe(true);
    act(() => { renderer.update(gridTree(false)); });
    expect(enabled()).toBe(false);
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("keeps Reduce Transparency opaque and permits the static renderer under Reduce Motion", () => {
    measure();
    mockPreferenceState = { reduceTransparency: true, reduceMotion: false };
    act(() => { renderer.update(gridTree()); });
    expect(enabled()).toBe(false);
    expect(material().backgroundColor).not.toBe("transparent");
    const color = String(material().backgroundColor);
    expect(color === "white" || /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) || /rgba\([^)]*,\s*1\s*\)/.test(color)).toBe(true);
    mockPreferenceState = { reduceTransparency: false, reduceMotion: true };
    act(() => { renderer.update(gridTree()); });
    expect(enabled()).toBe(true);
    ready();
    expect(material().backgroundColor).toBe("transparent");
  });

  it("reverts to visible fallback on GPU failure without replacing owner state", () => {
    measure(); ready();
    const identity = renderer.root.findByProps({ testID: "sharp-0" }).props.identity;
    act(() => { gpu().props.onAvailabilityChange(false); });
    expect(material().backgroundColor).not.toBe("transparent");
    expect(renderer.root.findByProps({ testID: "sharp-0" }).props.identity).toBe(identity);
    expect(mockSharpUnmount).not.toHaveBeenCalled();
  });

  it("removes the foreground listener at unmount", () => {
    act(() => { renderer.unmount(); });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockSharpUnmount).toHaveBeenCalledTimes(10);
  });
});
