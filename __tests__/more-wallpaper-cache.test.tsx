import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { SharedValue } from "react-native-reanimated";
import { MoreGlassSceneRenderer } from "~/components/ui/more-glass/MoreGlassSceneRenderer";

const mockDecodeInputs: (number | string | null)[] = [];
const mockImages = new Map<number | string, object>();
const mockIdle = jest.fn((callback: () => void) => { callback(); return { cancel: jest.fn() }; });
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: (callback: () => void) => mockIdle(callback) }));
jest.mock("~/components/ui/more-glass/MoreGlassWallpaper", () => ({ MoreGlassWallpaper: "Wallpaper" }));
jest.mock("react-native-reanimated", () => ({ useDerivedValue: (callback: () => unknown) => ({ value: callback() }) }));
jest.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas", Fill: "Fill", Shader: "Shader", ImageShader: "ImageShader",
  rect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
  Skia: { RuntimeEffect: { Make: () => ({ effect: "static" }) } },
  useImage: (source: number | string | null) => {
    mockDecodeInputs.push(source);
    return source === null ? null : mockImages.get(source) ?? null;
  },
}));

const rects = Array.from({ length: 14 }, (_, index) => ({ x: 20, y: 20 + index * 100, width: 150, height: 80 }));
const scrollOffset = { value: 0 } as SharedValue<number>;
let renderer: TestRenderer.ReactTestRenderer | undefined;
function mount(source: number | string, enabled: boolean, onAvailabilityChange = jest.fn()) {
  act(() => { renderer = TestRenderer.create(<MoreGlassSceneRenderer key={`${typeof source}:${source}:${enabled}`}
    width={360} height={640} rects={rects} scrollOffset={scrollOffset} wallpaperSource={source}
    enabled={enabled} onAvailabilityChange={onAvailabilityChange} />); });
  return onAvailabilityChange;
}
function unmount() { act(() => renderer?.unmount()); renderer = undefined; }
function nodeType(node: TestRenderer.ReactTestInstance, name: string) {
  return typeof node.type === "string" && String(node.type) === name;
}
afterEach(() => { unmount(); mockDecodeInputs.splice(0); mockIdle.mockClear(); });

it("prepares the public wallpaper while inactive without rendering a Canvas or becoming GPU-ready", () => {
  mockImages.set(9101, { image: "preloaded" });
  const available = mount(9101, false);
  expect(mockDecodeInputs).toContain(9101);
  expect(renderer!.root.findAll(node => nodeType(node, "Canvas"))).toHaveLength(0);
  expect(available.mock.calls.every(([value]) => value === false)).toBe(true);
});

it("reuses a source-owned decoded image across eligibility remounts instead of decoding it again", () => {
  const image = { image: "retained" };
  mockImages.set(9102, image);
  mount(9102, true);
  expect(mockDecodeInputs).toContain(9102);
  unmount(); mockDecodeInputs.splice(0);
  mount(9102, false);
  expect(mockDecodeInputs.every(value => value === null)).toBe(true);
  expect(renderer!.root.findAll(node => nodeType(node, "Canvas"))).toHaveLength(0);
  unmount(); mockDecodeInputs.splice(0);
  mount(9102, true);
  expect(mockDecodeInputs.every(value => value === null)).toBe(true);
  const texture = renderer!.root.find(node => nodeType(node, "ImageShader"));
  expect(texture.props.image).toBe(image);
});

it("uses the existing compiled program immediately on a revisit without another idle wait", () => {
  mockImages.set(9103, { image: "program" });
  mount(9103, true);
  unmount(); mockIdle.mockClear();
  mount(9103, true);
  expect(mockIdle).not.toHaveBeenCalled();
  expect(renderer!.root.findAll(node => nodeType(node, "Canvas"))).toHaveLength(1);
});

it("qualifies the single cache entry by the exact source, including number versus string", () => {
  const numeric = { image: "numeric" }, uri = { image: "uri" };
  mockImages.set(9104, numeric); mockImages.set("9104", uri);
  mount(9104, true); unmount(); mockDecodeInputs.splice(0);
  mount("9104", true);
  expect(mockDecodeInputs).toContain("9104");
  expect(renderer!.root.find(node => nodeType(node, "ImageShader")).props.image).toBe(uri);
  unmount(); mockDecodeInputs.splice(0);
  mount(9104, true);
  expect(mockDecodeInputs).toContain(9104);
  expect(renderer!.root.find(node => nodeType(node, "ImageShader")).props.image).toBe(numeric);
});
