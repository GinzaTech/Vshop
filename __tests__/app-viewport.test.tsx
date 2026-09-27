import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Platform, StyleSheet, Text, type ScaledSize } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AppViewport, {
  WEB_PHONE_LANDSCAPE_MAX_HEIGHT,
  WEB_PHONE_LANDSCAPE_MAX_WIDTH,
  WEB_PHONE_MAX_WIDTH,
  getAppViewportDimensions,
  useAppWindowDimensions,
} from "~/components/ui/AppViewport";

let mockWindowDimensions: ScaledSize = {
  fontScale: 1,
  height: 900,
  scale: 1,
  width: 1440,
};

jest.mock(
  "react-native/Libraries/Utilities/useWindowDimensions",
  () => ({
    __esModule: true,
    default: () => mockWindowDimensions,
  }),
);

const dimensions = (width: number, height = 900): ScaledSize => ({
  fontScale: 1,
  height,
  scale: 1,
  width,
});

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

function findDimensionConsumers(rootDirectory: string): string[] {
  const absoluteRoot = path.join(projectRoot, rootDirectory);
  return fs
    .readdirSync(absoluteRoot, { recursive: true })
    .filter((entry) => typeof entry === "string" && /\.(ts|tsx)$/.test(entry))
    .map((entry) => path.join(rootDirectory, String(entry)).replaceAll("\\", "/"))
    .filter((relativePath) => read(relativePath).includes("useWindowDimensions"));
}

function DimensionsProbe() {
  const { height, width } = useAppWindowDimensions();
  return <Text testID="app-viewport-dimensions">{`${width}x${height}`}</Text>;
}

const mockDimensionProbeRender = jest.fn();
const MemoizedDimensionsProbe = React.memo(function MemoizedDimensionsProbe() {
  useAppWindowDimensions();
  mockDimensionProbeRender();
  return <Text>Memoized dimensions</Text>;
});

describe("AppViewport", () => {
  const initialPlatform = Platform.OS;

  beforeEach(() => {
    mockDimensionProbeRender.mockClear();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: initialPlatform,
    });
  });

  it.each([
    [320, 320],
    [375, 375],
    [430, 430],
    [1440, 430],
  ])("uses a %s px browser as a %s px app viewport", (browserWidth, expected) => {
    expect(getAppViewportDimensions(dimensions(browserWidth), "web").width)
      .toBe(expected);
  });

  it("preserves every native dimension", () => {
    const nativeDimensions = dimensions(1080, 2400);

    expect(getAppViewportDimensions(nativeDimensions, "android"))
      .toEqual(nativeDimensions);
  });

  it("uses a phone landscape frame for the combat session on desktop web", () => {
    expect(getAppViewportDimensions(dimensions(1440), "web", "landscape"))
      .toEqual({
        fontScale: 1,
        height: WEB_PHONE_LANDSCAPE_MAX_HEIGHT,
        scale: 1,
        width: WEB_PHONE_LANDSCAPE_MAX_WIDTH,
      });
  });

  it("does not mutate the window dimensions passed by React Native", () => {
    const desktopDimensions = dimensions(1440);

    getAppViewportDimensions(desktopDimensions, "web");

    expect(desktopDimensions.width).toBe(1440);
  });

  it("renders a 430 px centered frame for a desktop browser", () => {
    mockWindowDimensions = dimensions(1440);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <AppViewport>
          <Text>Phone content</Text>
        </AppViewport>,
      );
    });

    const frame = renderer.root.findByProps({ testID: "app-viewport-frame" });
    expect(StyleSheet.flatten(frame.props.style).width).toBe(WEB_PHONE_MAX_WIDTH);
    act(() => renderer.unmount());
  });

  it("uses the full browser width when it is narrower than a large phone", () => {
    mockWindowDimensions = dimensions(375, 812);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <AppViewport>
          <Text>Phone content</Text>
        </AppViewport>,
      );
    });

    const frame = renderer.root.findByProps({ testID: "app-viewport-frame" });
    expect(StyleSheet.flatten(frame.props.style).width).toBe(375);
    act(() => renderer.unmount());
  });

  it("provides the landscape dimensions to nested layout consumers", () => {
    mockWindowDimensions = dimensions(1440);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <AppViewport orientation="landscape">
          <DimensionsProbe />
        </AppViewport>,
      );
    });

    const frame = renderer.root.findByProps({ testID: "app-viewport-frame" });
    const frameStyle = StyleSheet.flatten(frame.props.style);
    expect({ height: frameStyle.height, width: frameStyle.width }).toEqual({
      height: WEB_PHONE_LANDSCAPE_MAX_HEIGHT,
      width: WEB_PHONE_LANDSCAPE_MAX_WIDTH,
    });
    expect(renderer.root.findByProps({ testID: "app-viewport-dimensions" }).props.children)
      .toBe(`${WEB_PHONE_LANDSCAPE_MAX_WIDTH}x${WEB_PHONE_LANDSCAPE_MAX_HEIGHT}`);
    act(() => renderer.unmount());
  });

  it("keeps the context value stable across unrelated root rerenders", () => {
    mockWindowDimensions = dimensions(1440);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <AppViewport>
          <MemoizedDimensionsProbe />
        </AppViewport>,
      );
    });
    act(() => {
      renderer.update(
        <AppViewport>
          <MemoizedDimensionsProbe />
        </AppViewport>,
      );
    });

    expect(mockDimensionProbeRender).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it("wraps the complete navigation and loading subtree at the root", () => {
    const rootLayout = read("app/_layout.tsx");

    expect(rootLayout).toMatch(/import AppViewport from ["']~\/components\/ui\/AppViewport["']/);
    expect(rootLayout).toMatch(/<AppViewport orientation=\{requiredScreenOrientation\}>[\s\S]*<ErrorBoundary>/);
    expect(rootLayout).toMatch(/<ErrorBoundary>[\s\S]*<PlausibleProvider>/);
    expect(rootLayout).toMatch(/<LoadingScreen[\s\S]*<\/AppViewport>/);
  });

  it("routes every app layout calculation through the app viewport hook", () => {
    const consumers = ["app", "components", "features"]
      .flatMap(findDimensionConsumers)
      .sort();

    expect(consumers).toEqual(["components/ui/AppViewport.tsx"]);
  });
});
