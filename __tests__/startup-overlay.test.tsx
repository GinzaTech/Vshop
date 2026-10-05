import React from "react";
import { Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import StartupOverlay from "~/components/ui/StartupOverlay";

let mockReduced = false;
const mockCompletions: ((finished: boolean) => void)[] = [];
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduced }));
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  return { __esModule: true, default: { View: require("react-native").View },
    cancelAnimation: jest.fn(), ReduceMotion: { System: "system" },
    Easing: { out: () => undefined, inOut: () => undefined, cubic: () => undefined, bezier: () => undefined },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number, _config: object, completion: (finished: boolean) => void) => { mockCompletions.push(completion); return value; },
  };
});
beforeEach(() => { mockReduced = false; mockCompletions.splice(0); });

it("releases touch and focus immediately, rejects an old exit after retry, and hides only the completed current exit", () => {
  const onHidden = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
  const render = (active: boolean) => <StartupOverlay active={active} onHidden={onHidden}><Text>Icon</Text></StartupOverlay>;
  act(() => { renderer = TestRenderer.create(render(true)); });
  act(() => renderer.update(render(false)));
  expect(renderer.root.findByProps({ testID: "startup-overlay" }).props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true });
  const old = mockCompletions.at(-1)!;
  act(() => renderer.update(render(true)));
  act(() => old(true));
  expect(onHidden).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ testID: "startup-overlay" }).props.pointerEvents).toBe("auto");
  act(() => renderer.update(render(false)));
  act(() => mockCompletions.at(-1)!(true));
  expect(onHidden).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType(View)).toHaveLength(0);
  act(() => renderer.unmount());
});

it("settles with Reduce Motion without starting a timed exit", () => {
  mockReduced = true;
  const onHidden = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<StartupOverlay active onHidden={onHidden}><Text>Icon</Text></StartupOverlay>); });
  act(() => renderer.update(<StartupOverlay active={false} onHidden={onHidden}><Text>Icon</Text></StartupOverlay>));
  expect(onHidden).toHaveBeenCalledTimes(1);
  expect(mockCompletions).toHaveLength(0);
  act(() => renderer.unmount());
});

it("settles when Reduce Motion changes during exit and ignores the retired completion", () => {
  const onHidden = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
  const render = (active: boolean) => <StartupOverlay active={active} onHidden={onHidden}><Text>Icon</Text></StartupOverlay>;
  act(() => { renderer = TestRenderer.create(render(true)); });
  act(() => renderer.update(render(false)));
  const retained = mockCompletions.at(-1)!;
  mockReduced = true;
  act(() => renderer.update(render(false)));
  expect(onHidden).toHaveBeenCalledTimes(1);
  expect(renderer.root.findAllByType(View)).toHaveLength(0);
  act(() => retained(true));
  expect(onHidden).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
});

it("ignores a retained exit completion after unmount", () => {
  const onHidden = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<StartupOverlay active onHidden={onHidden} />); });
  act(() => renderer.update(<StartupOverlay active={false} onHidden={onHidden} />));
  const retained = mockCompletions.at(-1)!;
  act(() => renderer.unmount());
  act(() => retained(true));
  expect(onHidden).not.toHaveBeenCalled();
});
