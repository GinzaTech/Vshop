import React from "react";
import { AppState, ScrollView, StyleSheet, TouchableOpacity, View, type AppStateStatus, type LayoutChangeEvent, type LayoutRectangle } from "react-native";
import Animated from "react-native-reanimated";
import TestRenderer, { act } from "react-test-renderer";
import { COLORS } from "~/constants/DesignSystem";
import { MoreGlassScene, type MoreGlassSceneApi } from "~/components/ui/more-glass/MoreGlassScene";
import { MoreGlassCard } from "~/components/ui/more-glass/MoreGlassCard";
import { MoreGlassSceneRenderer } from "~/components/ui/more-glass/MoreGlassSceneRenderer";
import type { MoreGlassSceneRendererProps } from "~/components/ui/more-glass/MoreGlassSceneRenderer.types";
import type { MoreGlassRects } from "~/components/ui/more-glass/more-glass-model";
import {
  MORE_GLASS_SCENE_CARD_COUNT,
  buildMoreGlassSceneUniforms,
  composeMoreGlassSceneRects,
  updateMoreGlassSceneRect,
} from "~/components/ui/more-glass/more-glass-scene-model";

type ScrollFrame = { contentOffset: { x: number; y: number } };
let mockFocused = true;
let mockPreferences = { reduceTransparency: false, reduceMotion: false };
const mockRendererRenders = jest.fn();
const mockOwnerUnmount = jest.fn();
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("~/components/ui/liquid-glass-native-policy", () => ({ useNativeGlassPreferences: () => mockPreferences }));
jest.mock("~/components/ui/more-glass/MoreGlassSceneRenderer", () => ({ MoreGlassSceneRenderer: (props: MoreGlassSceneRendererProps) => {
  const ReactModule = require("react") as typeof React;
  mockRendererRenders();
  return ReactModule.createElement("SceneRenderer", props);
} }));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return {
    __esModule: true, default: { View: Native.View, ScrollView: Native.ScrollView },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useAnimatedScrollHandler: (handler: ((event: ScrollFrame) => void) | { onScroll: (event: ScrollFrame) => void }) => {
      const latest = ReactModule.useRef(handler);
      latest.current = handler;
      return ReactModule.useCallback((event: { nativeEvent: ScrollFrame }) => {
        if (typeof latest.current === "function") latest.current(event.nativeEvent);
        else latest.current.onScroll(event.nativeEvent);
      }, []);
    },
  };
});

const empty = (): MoreGlassRects => Object.freeze(Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, () => null));
const localRects = (): MoreGlassRects => Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, (_, index) => index < 10
  ? { x: index % 2 * 160, y: Math.floor(index / 2) * 122, width: 150, height: 112 }
  : { x: 20, y: 900 + (index - 10) * 260, width: 310, height: 240 });

describe("More white viewport scene geometry", () => {
  it("registers the four lower slots immutably in a separate fourteen-card registry", () => {
    expect(MORE_GLASS_SCENE_CARD_COUNT).toBe(14);
    const original = empty();
    const layout: LayoutRectangle = { x: 20, y: 1600, width: 310, height: 240 };
    const updated = updateMoreGlassSceneRect(original, 13, layout);
    expect(updated).not.toBe(original);
    expect(updated).toHaveLength(14);
    expect(original[13]).toBeNull();
    expect(updated[13]).toEqual(layout);
    expect(updated[13]).not.toBe(layout);
  });

  it("adds the shortcut grid offset once and leaves lower content coordinates unchanged", () => {
    const original = localRects();
    const composed = composeMoreGlassSceneRects(original, { x: 20, y: 120 });
    expect(composed[0]).toEqual({ x: 20, y: 120, width: 150, height: 112 });
    expect(composed[9]).toEqual({ x: 180, y: 608, width: 150, height: 112 });
    expect(composed[10]).toEqual(original[10]);
    expect(composed[13]).toEqual(original[13]);
    expect(original[0]).toEqual({ x: 0, y: 0, width: 150, height: 112 });
  });

  it("allows measured content below the viewport without allocating a content-height surface", () => {
    const contentRects = composeMoreGlassSceneRects(localRects(), { x: 20, y: 120 });
    const uniforms = buildMoreGlassSceneUniforms(360, 640, contentRects);
    expect(uniforms.ready).toBe(true);
    expect(uniforms.resolution).toEqual([360, 640]);
    expect(uniforms.cards).toHaveLength(56);
    expect(uniforms.cards.slice(40, 44)).toEqual([20, 900, 310, 240]);
    expect(uniforms.cards.slice(52, 56)).toEqual([20, 1680, 310, 240]);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("keeps unpositioned shortcuts unavailable until the grid offset is measured", () => {
    const composed = composeMoreGlassSceneRects(localRects(), null);
    expect(composed.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => null));
    expect(composed[10]).toEqual(localRects()[10]);
    expect(buildMoreGlassSceneUniforms(360, 640, composed).ready).toBe(false);
  });

  it("projects content Y by the current scroll offset without changing the registered rectangles", () => {
    const content = composeMoreGlassSceneRects(localRects(), { x: 20, y: 120 });
    const projected = buildMoreGlassSceneUniforms(360, 640, content, 500);
    expect(projected.ready).toBe(true);
    expect(projected.cards.slice(0, 4)).toEqual([20, -380, 150, 112]);
    expect(projected.cards.slice(40, 44)).toEqual([20, 400, 310, 240]);
    expect(content[0]?.y).toBe(120);
    expect(content[10]?.y).toBe(900);
  });

  it("preserves signed overscroll so glass bounds follow the native content position", () => {
    const content = composeMoreGlassSceneRects(localRects(), { x: 20, y: 120 });
    const uniforms = buildMoreGlassSceneUniforms(360, 640, content, -20);
    expect(uniforms.ready).toBe(true);
    expect(uniforms.cards.slice(0, 4)).toEqual([20, 140, 150, 112]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("keeps non-finite scroll %s out of shader uniforms", (scrollY) => {
    const uniforms = buildMoreGlassSceneUniforms(360, 640, localRects(), scrollY);
    expect(uniforms.ready).toBe(false);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });

  it("keeps identical and sub-half-dp layout events cached", () => {
    const original = localRects();
    expect(updateMoreGlassSceneRect(original, 13, { ...original[13]! })).toBe(original);
    expect(updateMoreGlassSceneRect(original, 13, { ...original[13]!, y: 1680.49 })).toBe(original);
    const updated = updateMoreGlassSceneRect(original, 13, { ...original[13]!, y: 1680.51 });
    expect(updated).not.toBe(original);
    expect(updated[13]?.y).toBe(1680.51);
  });

  it.each([-1, 14, 0.5, Number.NaN])("rejects invalid fourteen-slot index %s", (index) => {
    const original = empty();
    expect(updateMoreGlassSceneRect(original, index, { x: 0, y: 0, width: 150, height: 112 })).toBe(original);
  });

  it.each([
    { x: 0, y: 0, width: 0, height: 112 },
    { x: 0, y: 0, width: 150, height: -1 },
    { x: Number.NaN, y: 0, width: 150, height: 112 },
    { x: 0, y: Number.POSITIVE_INFINITY, width: 150, height: 112 },
  ])("rejects invalid content rectangle %j without replacing the registry", (layout) => {
    const original = empty();
    expect(updateMoreGlassSceneRect(original, 0, layout)).toBe(original);
  });

  it("rejects sparse and incomplete fourteen-card geometry", () => {
    const sparse = new Array<LayoutRectangle | null>(14);
    sparse[0] = { x: 20, y: 120, width: 150, height: 112 };
    expect(buildMoreGlassSceneUniforms(360, 640, sparse).ready).toBe(false);
    expect(buildMoreGlassSceneUniforms(360, 640, localRects().slice(0, 13)).ready).toBe(false);
  });

  it.each([[0, 640], [360, 0], [Number.NaN, 640], [360, Number.POSITIVE_INFINITY]])("keeps invalid viewport %s×%s out of shader-ready uniforms", (width, height) => {
    const uniforms = buildMoreGlassSceneUniforms(width, height, localRects());
    expect(uniforms.ready).toBe(false);
    expect(uniforms.resolution.every(Number.isFinite)).toBe(true);
    expect(uniforms.cards.every(Number.isFinite)).toBe(true);
  });
});

function event(layout: LayoutRectangle): LayoutChangeEvent {
  return { nativeEvent: { layout } } as LayoutChangeEvent;
}

function Owner({ index }: { index: number }) {
  const [identity] = React.useState(() => ({ index }));
  React.useEffect(() => () => mockOwnerUnmount(index), [index]);
  return React.createElement("SharpSceneContent", { testID: `scene-owner-${index}`, identity });
}

function sceneContent(api: MoreGlassSceneApi) {
  return <Animated.ScrollView testID="scene-scroll" onScroll={api.onScroll} style={{ backgroundColor: "transparent" }}>
      <View testID="shortcut-grid-offset" onLayout={api.onShortcutGridLayout}>
        {Array.from({ length: 10 }, (_, index) => <TouchableOpacity key={index} testID={`scene-shortcut-${index}`}
          accessibilityRole="button" onLayout={(layout) => api.onShortcutLayout(index, layout)}>
          <MoreGlassCard index={index} testID={`scene-material-${index}`}><Owner index={index} /></MoreGlassCard>
        </TouchableOpacity>)}
      </View>
      {Array.from({ length: 4 }, (_, offset) => <MoreGlassCard key={offset} index={offset + 10}
        testID={`scene-material-${offset + 10}`} onLayout={(layout) => api.onCardLayout(offset + 10, layout)}>
        <Owner index={offset + 10} />
      </MoreGlassCard>)}
    </Animated.ScrollView>;
}
function sceneTree(wallpaperSource = 73, enabled?: boolean) {
  return <MoreGlassScene testID="scene-root" wallpaperSource={wallpaperSource} enabled={enabled}>
    {sceneContent}
  </MoreGlassScene>;
}

describe("More white scene ownership and viewport rendering", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let stateChange: (state: AppStateStatus) => void;
  let remove: jest.Mock;
  let appStateSubscription: jest.SpyInstance;
  let descriptor: PropertyDescriptor | undefined;
  const gpu = () => renderer.root.findByType(MoreGlassSceneRenderer);
  const material = () => StyleSheet.flatten(renderer.root.findAllByType(View).find((node) => node.props.testID === "scene-material-0")!.props.style);
  const ready = () => { act(() => { gpu().props.onAvailabilityChange(true); }); };
  function measure() {
    act(() => {
      renderer.root.findAllByType(View).find((node) => node.props.testID === "scene-root")!.props.onLayout(
        event({ x: 0, y: 0, width: 360, height: 640 }),
      );
      renderer.root.findAllByType(View).find((node) => node.props.testID === "shortcut-grid-offset")!.props.onLayout(
        event({ x: 20, y: 120, width: 320, height: 600 }),
      );
      localRects().forEach((rect, index) => {
        const host = index < 10
          ? renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === `scene-shortcut-${index}`)!
          : renderer.root.findByType(ScrollView).findAllByType(MoreGlassCard).find((node) => node.props.index === index)!;
        host.props.onLayout(event(rect!));
      });
    });
  }
  beforeEach(() => {
    mockFocused = true;
    mockPreferences = { reduceTransparency: false, reduceMotion: false };
    mockRendererRenders.mockClear(); mockOwnerUnmount.mockClear();
    descriptor = Object.getOwnPropertyDescriptor(AppState, "currentState");
    Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
    remove = jest.fn();
    appStateSubscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      stateChange = listener;
      return { remove };
    });
    act(() => { renderer = TestRenderer.create(sceneTree()); });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    appStateSubscription.mockRestore();
    if (descriptor) Object.defineProperty(AppState, "currentState", descriptor);
    else Reflect.deleteProperty(AppState, "currentState");
  });

  it("keeps one renderer behind scroll content with the shared gray viewport base", () => {
    measure();
    expect(renderer.root.findAllByType(MoreGlassSceneRenderer)).toHaveLength(1);
    expect(renderer.root.findByType(ScrollView).findAllByType(MoreGlassSceneRenderer)).toHaveLength(0);
    expect(gpu().props).toMatchObject({ width: 360, height: 640, wallpaperSource: 73, enabled: true });
    expect(gpu().props.rects[0]).toEqual({ x: 20, y: 120, width: 150, height: 112 });
    expect(gpu().props.rects[13]).toEqual({ x: 20, y: 1680, width: 310, height: 240 });
    const viewport = renderer.root.findAllByType(View).find((node) => node.props.testID === "scene-root")!;
    expect(StyleSheet.flatten(viewport.props.style).backgroundColor).toBe(COLORS.BACKGROUND);
    expect(renderer.root.findAllByType(MoreGlassCard)).toHaveLength(14);
  });

  it("updates the shared scroll offset without React renders or changing content coordinates", () => {
    measure(); ready();
    const rects = gpu().props.rects;
    const offset = gpu().props.scrollOffset;
    const calls = mockRendererRenders.mock.calls.length;
    act(() => { renderer.root.findByType(ScrollView).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 500 } } }); });
    expect(offset.value).toBe(500);
    act(() => { renderer.root.findByType(ScrollView).props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: Number.NaN } } }); });
    expect(offset.value).toBe(500);
    expect(gpu().props.scrollOffset).toBe(offset);
    expect(gpu().props.rects).toBe(rects);
    expect(gpu().props.rects[10].y).toBe(900);
    expect(gpu().props.height).toBe(640);
    expect(mockRendererRenders).toHaveBeenCalledTimes(calls);
    expect(mockOwnerUnmount).not.toHaveBeenCalled();
  });

  it("keeps sharp content untouched through measurement, GPU readiness and focus-only updates", () => {
    const content = jest.fn(sceneContent);
    const tree = () => <MoreGlassScene testID="scene-root" wallpaperSource={73}>{content}</MoreGlassScene>;
    act(() => renderer.update(tree()));
    const identities = Array.from({ length: 14 }, (_, index) => renderer.root.findByProps({ testID: `scene-owner-${index}` }).props.identity);
    const calls = content.mock.calls.length;
    measure(); ready();
    mockFocused = false;
    act(() => renderer.update(tree()));
    mockFocused = true;
    act(() => renderer.update(tree()));
    act(() => stateChange("background"));
    act(() => stateChange("active"));
    expect(content).toHaveBeenCalledTimes(calls);
    identities.forEach((identity, index) => expect(renderer.root.findByProps({ testID: `scene-owner-${index}` }).props.identity).toBe(identity));
  });

  it("uses fresh labels and actions when the caller changes its content", () => {
    const first = jest.fn(), second = jest.fn();
    const content = (label: string, action: () => void) => function renderLiveSceneContent(_api: MoreGlassSceneApi) {
      return <TouchableOpacity testID="scene-live-action" accessibilityLabel={label} onPress={action} />;
    };
    act(() => renderer.update(<MoreGlassScene>{content("VI", first)}</MoreGlassScene>));
    act(() => renderer.root.findByProps({ testID: "scene-live-action" }).props.onPress());
    act(() => renderer.update(<MoreGlassScene>{content("EN", second)}</MoreGlassScene>));
    const action = renderer.root.findByProps({ testID: "scene-live-action" });
    expect(action.props.accessibilityLabel).toBe("EN");
    act(() => action.props.onPress());
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("retains all fourteen owners when switching focus, foreground and transparency eligibility", () => {
    measure(); ready();
    const identities = Array.from({ length: 14 }, (_, index) => renderer.root.findByProps({ testID: `scene-owner-${index}` }).props.identity);
    mockFocused = false;
    act(() => { renderer.update(sceneTree()); });
    expect(gpu().props.enabled).toBe(false);
    expect(material().backgroundColor).not.toBe("transparent");
    mockFocused = true;
    act(() => { renderer.update(sceneTree()); stateChange("background"); });
    expect(gpu().props.enabled).toBe(false);
    act(() => { stateChange("active"); });
    mockPreferences = { reduceTransparency: true, reduceMotion: false };
    act(() => { renderer.update(sceneTree()); });
    expect(gpu().props.enabled).toBe(false);
    expect(material().backgroundColor).toBe(COLORS.SURFACE);
    mockPreferences = { reduceTransparency: false, reduceMotion: true };
    act(() => { renderer.update(sceneTree()); });
    expect(gpu().props.enabled).toBe(true);
    ready();
    for (const [index, identity] of identities.entries()) {
      expect(renderer.root.findByProps({ testID: `scene-owner-${index}` }).props.identity).toBe(identity);
    }
    expect(mockOwnerUnmount).not.toHaveBeenCalled();
  });

  it("ignores old wallpaper availability after a new image owner is committed", () => {
    measure(); ready();
    const decodedImageOwner = gpu();
    const obsolete = gpu().props.onAvailabilityChange;
    act(() => { renderer.update(sceneTree(74)); });
    expect(gpu()).not.toBe(decodedImageOwner);
    expect(material().backgroundColor).not.toBe("transparent");
    act(() => { obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    act(() => { obsolete(false); });
    expect(material().backgroundColor).toBe("transparent");
    expect(mockOwnerUnmount).not.toHaveBeenCalled();
  });

  it("requires fresh geometry availability after the content grid moves", () => {
    measure(); ready();
    const obsolete = gpu().props.onAvailabilityChange;
    act(() => {
      renderer.root.findAllByType(View).find((node) => node.props.testID === "shortcut-grid-offset")!.props.onLayout(
        event({ x: 20, y: 140, width: 320, height: 600 }),
      );
    });
    expect(gpu().props.rects[0].y).toBe(140);
    act(() => { obsolete(true); });
    expect(material().backgroundColor).not.toBe("transparent");
    ready();
    expect(material().backgroundColor).toBe("transparent");
  });

  it("stops rendering under an explicit disabled override and cleans the foreground listener", () => {
    measure(); ready();
    act(() => { renderer.update(sceneTree(73, false)); });
    expect(gpu().props.enabled).toBe(false);
    expect(mockOwnerUnmount).not.toHaveBeenCalled();
    act(() => { renderer.unmount(); });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockOwnerUnmount).toHaveBeenCalledTimes(14);
  });
});
