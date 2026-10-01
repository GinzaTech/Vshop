import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { LiquidNavigationShell, type LiquidNavigationShellProps } from "~/features/navigation/LiquidNavigationShell";
import PrimaryTabScene from "~/components/ui/PrimaryTabScene";
import { PRIMARY_ROUTE_ORDER, type PrimaryRouteName } from "~/features/navigation/navigation-model";
import { useLiquidLens } from "~/features/navigation/useLiquidLens";
import { NavigationSceneContext } from "~/features/navigation/NavigationSceneContext";
import type { SharedValue } from "react-native-reanimated";
import { BlurTargetView } from "expo-blur";
import { RefractionTarget } from "~/features/navigation/NativeRefraction";

type Value = number | number[];
type Animation = { target: Value; delay: number; duration: number; callback?: (finished: boolean) => void };
type Running = Animation & { shared: { value: Value }; from: Value; cancelled: boolean };
const mockRunning: Running[] = [];
const mockRnQueue: (() => void)[] = [];
let mockReduced = false;
let mockFocused = true;
const mockSettled = jest.fn();
const mockScreenUnmount = jest.fn();
let mockLens: ReturnType<typeof useLiquidLens>;

jest.mock("expo-router", () => ({ Tabs: () => null, useIsFocused: () => mockFocused }));
jest.mock("expo-router/react-navigation", () => ({
  Header: () => null, getHeaderTitle: (options: { title?: string }, name: string) => options.title ?? name,
  Screen: ({ children, route }: React.PropsWithChildren<{ route: { key: string } }>) => {
    const ReactModule = require("react") as typeof React;
    ReactModule.useEffect(() => () => mockScreenUnmount(route.key), [route.key]);
    return children;
  },
}));
jest.mock("expo-blur", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return { BlurView: "BlurView", BlurTargetView: ReactModule.forwardRef<View, React.ComponentProps<typeof View>>((props, ref) => ReactModule.createElement(Native.View, { ...props, ref })) };
});
jest.mock("~/features/navigation/FloatingTabBar", () => ({ FloatingTabBar: (props: { blurTarget?: React.RefObject<View | null>; refractionTargetTag?: number | null }) => {
  const ReactModule = require("react") as typeof React;
  return ReactModule.createElement("NavigationBar", { testID: "navigation-bar", pointerEvents: "auto", blurTarget: props.blurTarget, refractionTargetTag: props.refractionTargetTag });
} }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 360, height: 800 }) }));
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduced }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock("react-native-worklets", () => ({
  scheduleOnUI: (callback: () => void) => callback(),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => mockRnQueue.push(() => callback(...args)),
}));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return {
    __esModule: true, default: { View: Native.View },
    Easing: { cubic: () => 0, out: (value: unknown) => value, inOut: (value: unknown) => value, bezier: () => (value: number) => value },
    ReduceMotion: { System: "system" },
    useSharedValue: (initial: Value) => {
      const ref = ReactModule.useRef<{ value: Value } | null>(null);
      if (!ref.current) {
        let current = initial;
        const shared: { value: Value } = { get value(): Value { return current; }, set value(next: Value | Animation) {
          if (typeof next === "object" && !Array.isArray(next) && "target" in next) {
            mockRunning.push({ ...next, shared, from: current, cancelled: false });
          } else { current = next; }
        } };
        ref.current = shared;
      }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    cancelAnimation: (shared: { value: Value }) => mockRunning.filter((animation) => animation.shared === shared).forEach((animation) => { animation.cancelled = true; }),
    withTiming: (target: Value, config: { duration: number }, callback?: Animation["callback"]) => ({ target, duration: config.duration, delay: 0, callback }),
    withSpring: (target: Value, _config: object, callback?: Animation["callback"]) => ({ target, duration: 310, delay: 0, callback }),
    withDelay: (delay: number, animation: Animation) => ({ ...animation, delay }),
  };
});

function StatefulScreen({ name }: { name: PrimaryRouteName }) {
  const [scrollPosition, setScrollPosition] = React.useState(0);
  React.useEffect(() => () => mockSettled(name), [name]);
  return <ScrollView testID={`content-${name}`} contentOffset={{ x: 0, y: scrollPosition }} onScroll={(event) => setScrollPosition(event.nativeEvent.contentOffset.y)} />;
}

function LensProbe({ index = 2, slotWidth = 65.2 }: { index?: number; slotWidth?: number }) {
  const lens = useLiquidLens(index, slotWidth, 82.152, false, true);
  React.useLayoutEffect(() => { mockLens = lens; }, [lens]);
  return <View />;
}

const routes = [...PRIMARY_ROUTE_ORDER, "history"].map((name) => ({ name, key: `${name}-key` }));
function props(index: number, emit: jest.Mock, preloadedRouteKeys: string[] = []): LiquidNavigationShellProps {
  return {
    state: { index, routes, preloadedRouteKeys },
    navigation: { emit },
    descriptors: Object.fromEntries(routes.map((route) => [route.key, {
      route, navigation: {}, options: { headerShown: route.name === "history" },
      render: () => route.name === "history" ? <View testID="history-content" /> :
        <PrimaryTabScene routeName={route.name as PrimaryRouteName}><StatefulScreen name={route.name as PrimaryRouteName} /></PrimaryTabScene>,
    }])),
  } as unknown as LiquidNavigationShellProps;
}

const fade = () => mockRunning.filter((animation) => !animation.cancelled && Array.isArray(animation.target)).at(-1)!;
function sample(animation: Running, elapsed: number) {
  const mix = Math.max(0, Math.min(1, (elapsed - animation.delay) / animation.duration));
  const start = animation.from as number[];
  animation.shared.value = (animation.target as number[]).map((target, index) => start[index] * (1 - mix) + target * mix);
}

describe("retained liquid navigation scenes", () => {
  it("captures composed pages only, passes the committed native tag and disables on secondary/reduced routes", () => {
    const emit = jest.fn();
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit)} />); });
    const source = renderer.root.findByType(RefractionTarget);
    expect(source.findAllByProps({ testID: "navigation-bar" })).toHaveLength(0);
    expect(source.findAllByProps({ testID: "content-profile" }).length).toBeGreaterThan(0);
    expect(source.props.enabled).toBe(true);
    act(() => source.props.onTargetReady(17));
    expect(renderer.root.findByProps({ testID: "navigation-bar" }).props.refractionTargetTag).toBe(17);
    act(() => renderer.update(<LiquidNavigationShell {...props(5, emit)} />));
    expect(source.props.enabled).toBe(false);
    mockReduced = true;
    act(() => renderer.update(<LiquidNavigationShell {...props(2, emit)} />));
    expect(source.props.enabled).toBe(false);
  });
  let renderer: TestRenderer.ReactTestRenderer;
  afterEach(() => {
    act(() => renderer?.unmount());
    mockRunning.splice(0); mockRnQueue.splice(0); mockSettled.mockClear(); mockScreenUnmount.mockClear(); mockReduced = false; mockFocused = true;
  });

  it("starts at the deep link and keeps visited/preloaded state mounted during a delayed direct fade", () => {
    const emit = jest.fn();
    const preload = ["shop-key", "night_market-key"];
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit, preload)} />); });
    act(() => renderer.root.findByProps({ testID: "content-profile" }).props.onScroll({ nativeEvent: { contentOffset: { y: 240 } } }));
    expect(renderer.root.findAllByProps({ testID: "content-shop" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: "content-settings" })).toHaveLength(0);
    expect(mockRunning).toHaveLength(0);
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit, preload)} />));
    const animation = fade();
    expect(animation).toMatchObject({ delay: 210, duration: 130, from: [0, 0, 1, 0, 0], target: [0, 1, 0, 0, 0] });
    sample(animation, 209);
    expect(animation.shared.value).toEqual([0, 0, 1, 0, 0]);
    sample(animation, 275);
    expect(animation.shared.value).toEqual([0, 0.5, 0.5, 0, 0]);
    const oldHost = renderer.root.findByProps({ testID: "navigation-host-profile" });
    expect(oldHost.props.pointerEvents).toBe("none");
    expect(oldHost.props.importantForAccessibility).toBe("no-hide-descendants");
    const incoming = renderer.root.findByProps({ testID: "navigation-host-shop" });
    expect(incoming.props.pointerEvents).toBe("none");
    expect(incoming.props.accessibilityElementsHidden).toBe(true);
    expect(incoming.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(renderer.root.findByProps({ testID: "navigation-bar" }).props.pointerEvents).toBe("auto");
    expect(mockSettled).not.toHaveBeenCalled();
    act(() => renderer.update(<LiquidNavigationShell {...props(2, emit, preload)} />));
    expect(renderer.root.findByProps({ testID: "content-profile" }).props.contentOffset.y).toBe(240);
  });

  it("retargets partially visible weights and ignores completion already queued for an older route", () => {
    const emit = jest.fn();
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(0, emit)} />); });
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit)} />));
    const first = fade();
    sample(first, 275);
    first.callback?.(true); // UI completed; RN callback has not arrived yet.
    act(() => renderer.update(<LiquidNavigationShell {...props(4, emit)} />));
    const last = fade();
    expect(first.cancelled).toBe(true);
    expect(last.from).toEqual([0.5, 0.5, 0, 0, 0]);
    expect(last.target).toEqual([0, 0, 0, 0, 1]);
    act(() => mockRnQueue.splice(0).forEach((callback) => callback()));
    expect(emit.mock.calls.filter(([event]) => event.type === "transitionEnd")).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: "navigation-host-settings" }).props.pointerEvents).toBe("none");
    expect(renderer.root.findByProps({ testID: "navigation-host-settings" }).props.accessibilityElementsHidden).toBe(true);
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props.pointerEvents).toBe("none");
    expect(renderer.root.findByProps({ testID: "navigation-bar" }).props.pointerEvents).toBe("auto");
    last.callback?.(true);
    act(() => mockRnQueue.splice(0).forEach((callback) => callback()));
    expect(emit).toHaveBeenLastCalledWith({ type: "transitionEnd", target: "settings-key" });
    expect(renderer.root.findByProps({ testID: "navigation-host-settings" }).props.pointerEvents).toBe("auto");
    expect(renderer.root.findByProps({ testID: "navigation-host-settings" }).props.accessibilityElementsHidden).toBe(false);
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props.pointerEvents).toBe("none");
    expect(mockSettled).not.toHaveBeenCalled();
    expect(mockScreenUnmount).not.toHaveBeenCalled();
  });

  it("does not unlock a revisited route from an older completion for the same key", () => {
    const emit = jest.fn();
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit)} />); });
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit)} />));
    const obsolete = fade();
    obsolete.callback?.(true);
    act(() => renderer.update(<LiquidNavigationShell {...props(4, emit)} />));
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit)} />));
    const current = fade();
    act(() => mockRnQueue.splice(0).forEach((callback) => callback()));
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props.pointerEvents).toBe("none");
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props["aria-hidden"]).toBe(true);
    expect(emit.mock.calls.filter(([event]) => event.type === "transitionEnd")).toHaveLength(0);
    current.callback?.(true);
    act(() => mockRnQueue.splice(0).forEach((callback) => callback()));
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props.pointerEvents).toBe("auto");
    expect(renderer.root.findByProps({ testID: "navigation-host-settings" }).props.pointerEvents).toBe("none");
    expect(mockScreenUnmount).not.toHaveBeenCalled();
  });

  it("forwards the installed BottomTabView Screen/default Header contract", () => {
    const input = props(5, jest.fn());
    const descriptor = input.descriptors["history-key"];
    const headerLeft = jest.fn(() => null);
    const options = { headerShown: true, headerTransparent: true, headerStatusBarHeight: 24, title: "History", headerTintColor: "red", headerLeft };
    const configured = { ...input, descriptors: { ...input.descriptors, "history-key": { ...descriptor, options } } };
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...configured} />); });
    const screen = renderer.root.findByProps({ route: descriptor.route });
    expect(screen.props).toMatchObject({ focused: true, navigation: descriptor.navigation, headerShown: true, headerTransparent: true, headerStatusBarHeight: 24 });
    expect(screen.props.header.props).toMatchObject({ ...options, title: "History", layout: { width: 360, height: 800 } });
    expect(screen.props.header.props.headerLeft).toBe(headerLeft);
  });

  it("preserves a custom header returning null instead of creating a default header", () => {
    const input = props(5, jest.fn());
    const descriptor = input.descriptors["history-key"];
    const header = jest.fn(() => null);
    const options = { headerShown: true, header };
    const configured = { ...input, descriptors: { ...input.descriptors, "history-key": { ...descriptor, options } } };
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...configured} />); });
    expect(header).toHaveBeenCalledWith({ layout: { width: 360, height: 800 }, route: descriptor.route, navigation: descriptor.navigation, options });
    expect(renderer.root.findByProps({ route: descriptor.route }).props.header).toBeNull();
  });

  it("does not replay on resume/identical route and suppresses pending completion after unmount", () => {
    const emit = jest.fn();
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit)} />); });
    act(() => renderer.update(<LiquidNavigationShell {...props(2, emit)} />));
    expect(mockRunning).toHaveLength(0);
    act(() => renderer.update(<LiquidNavigationShell {...props(3, emit)} />));
    const animation = fade();
    animation.callback?.(true);
    act(() => renderer.unmount());
    mockRnQueue.splice(0).forEach((callback) => callback());
    expect(animation.cancelled).toBe(true);
    expect(emit.mock.calls.filter(([event]) => event.type === "transitionEnd")).toHaveLength(0);
  });

  it("uses a short Reduce Motion fade without stretch delay", () => {
    const emit = jest.fn(); mockReduced = true;
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(0, emit)} />); });
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit)} />));
    expect(fade()).toMatchObject({ delay: 0, duration: 90 });
  });

  it("keeps the unfocused outgoing scene visible only through the shared fade, with no touch or screen-reader access", () => {
    mockFocused = false;
    const weights = { value: [0, 0.5, 0.5, 0, 0] } as SharedValue<number[]>;
    act(() => { renderer = TestRenderer.create(
      <NavigationSceneContext.Provider value={{ weights }}>
        <PrimaryTabScene routeName="profile"><View /></PrimaryTabScene>
      </NavigationSceneContext.Provider>,
    ); });
    const scene = renderer.root.findByProps({ collapsable: false });
    expect(StyleSheet.flatten(scene.props.style).opacity).toBe(0.5);
    expect(scene.props.pointerEvents).toBe("none");
    expect(scene.props.accessibilityElementsHidden).toBe(true);
  });

  it("keeps primary state across secondary routing and returns without replaying the primary fade", () => {
    const emit = jest.fn();
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit)} />); });
    act(() => renderer.update(<LiquidNavigationShell {...props(5, emit)} />));
    expect(renderer.root.findByProps({ testID: "history-content" })).toBeDefined();
    expect(renderer.root.findByProps({ testID: "content-profile" })).toBeDefined();
    act(() => renderer.update(<LiquidNavigationShell {...props(2, emit)} />));
    expect(renderer.root.findAllByProps({ testID: "history-content" })).toHaveLength(0);
    expect(emit).toHaveBeenLastCalledWith({ type: "transitionEnd", target: "profile-key" });
  });

  it("keeps Night Market viewport full-height so content can scroll behind the glass", () => {
    act(() => { renderer = TestRenderer.create(<PrimaryTabScene routeName="night_market"><View /></PrimaryTabScene>); });
    const scene = renderer.root.findByProps({ collapsable: false });
    expect(StyleSheet.flatten(scene.props.style).paddingBottom).toBeUndefined();
  });

  it("retargets the physical lens position and does not replay a confirmed route", () => {
    act(() => { renderer = TestRenderer.create(<LensProbe />); });
    expect(mockRunning).toHaveLength(0);
    act(() => mockLens.move(1));
    const first = mockRunning.find((animation) => animation.shared === mockLens.x)!;
    mockLens.x.value = 55; // Device currently midway through its spring.
    act(() => mockLens.move(4));
    const last = mockRunning.filter((animation) => !animation.cancelled && animation.shared === mockLens.x).at(-1)!;
    expect(first.cancelled).toBe(true);
    expect(last.from).toBe(55);
    expect(last.target).toBeCloseTo(4.5 * 65.2 - 82.152 / 2);
    const count = mockRunning.length;
    act(() => renderer.update(<LensProbe index={4} />));
    expect(mockRunning).toHaveLength(count);
    act(() => renderer.update(<LensProbe index={4} slotWidth={80} />));
    expect(mockLens.x.value).toBeCloseTo(4.5 * 80 - 82.152 / 2);
    expect(last.cancelled).toBe(true);
  });

  it("does not revive lens animations through a retained press callback after unmount", () => {
    act(() => { renderer = TestRenderer.create(<LensProbe />); });
    const retainedMove = mockLens.move;
    act(() => renderer.unmount());
    act(() => retainedMove(4));
    expect(mockRunning).toHaveLength(0);
  });

  it("commits one page-only blur target before enabling the sibling bar, keeping target and Screens stable", () => {
    const emit = jest.fn();
    const nativeTarget = { nativeTarget: true };
    act(() => { renderer = TestRenderer.create(<LiquidNavigationShell {...props(2, emit)} />, { createNodeMock: () => nativeTarget }); });
    const target = renderer.root.findByType(BlurTargetView);
    const bar = () => renderer.root.findByProps({ testID: "navigation-bar" });
    expect(bar().props.blurTarget).toBeUndefined();
    expect(target.findAllByProps({ testID: "navigation-bar" })).toHaveLength(0);
    expect(target.findAllByProps({ testID: "navigation-host-profile" }).length).toBeGreaterThan(0);
    expect(target.props.accessibilityElementsHidden).not.toBe(true);
    expect(target.props.accessible).toBe(false);
    act(() => target.props.onLayout({ nativeEvent: { layout: { width: 360, height: 800 } } }));
    const ref = bar().props.blurTarget;
    expect(ref.current !== null).toBe(true);
    act(() => renderer.update(<LiquidNavigationShell {...props(1, emit)} />));
    expect(renderer.root.findByType(BlurTargetView) === target).toBe(true);
    expect(bar().props.blurTarget === ref).toBe(true);
    expect(renderer.root.findAllByType(BlurTargetView)).toHaveLength(1);
    expect(mockScreenUnmount).not.toHaveBeenCalled();
    expect(bar().props.pointerEvents).toBe("auto");
    expect(renderer.root.findByProps({ testID: "navigation-host-shop" }).props.pointerEvents).toBe("none");
    act(() => target.props.onLayout({ nativeEvent: { layout: { width: 0, height: 0 } } }));
    expect(bar().props.blurTarget).toBeUndefined();
  });
});
