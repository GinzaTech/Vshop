import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import UiQaRoute from "~/app/ui-qa";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";
import { captureRootBootstrapRoute } from "~/utils/root-bootstrap-route";

let mockDemo: string | string[] | undefined = "1";
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ demo: mockDemo }), Redirect: "Redirect", Stack: { Screen: () => null } }));
jest.mock("~/mocks/ui-qa", () => ({ __esModule: true, default: "LocalQaScreen" }));
jest.mock("expo/metro-config", () => ({ getDefaultConfig: () => ({ resolver: {} }) }));
describe("local UI QA production and route boundary", () => {
  const originalDev = __DEV__;
  afterEach(() => { devGlobal.__DEV__ = originalDev; mockDemo = "1"; });
  it.each(["1", ["1"]])("allows only explicit DEV demo=1 (%s) and participates in existing cold bootstrap", (demo) => {
    expect(isDevelopmentDemoRoute({ isDev: true, demo, pathname: "/ui-qa" })).toBe(true);
    expect(captureRootBootstrapRoute(null, { isDev: true, demo, pathname: "/ui-qa" })?.allowDemoRoute).toBe(true);
  });
  it.each([undefined, "true", "0", ["0", "1"]])("rejects QA flag %s and all release access", (demo) => {
    expect(isDevelopmentDemoRoute({ isDev: true, demo, pathname: "/ui-qa" })).toBe(false);
    expect(isDevelopmentDemoRoute({ isDev: false, demo: "1", pathname: "/ui-qa" })).toBe(false);
  });
  it.each([[true, "1", "LocalQaScreen"], [true, undefined, "Redirect"], [false, "1", "Redirect"]] as const)("route dev=%s flag=%s yields %s", (dev, demo, type) => {
    devGlobal.__DEV__ = dev; mockDemo = demo;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UiQaRoute />); });
    expect(renderer.toJSON()).toMatchObject({ type });
    if (type === "Redirect") expect(renderer.toJSON()).toMatchObject({ props: { href: "/" } });
    act(() => { renderer.unmount(); });
  });
  it("resolves QA to a fixture-free callable production stub", () => {
    const config = readFileSync(join(process.cwd(), "metro.config.js"), "utf8");
    expect(config).toContain('"~/mocks/ui-qa"'); expect(config).toContain('"ui-qa.production.js"');
    const stubPath = join(process.cwd(), "mocks/ui-qa.production.js");
    const stub = require(stubPath) as { default: () => null };
    expect(stub.default()).toBeNull();
    expect(readFileSync(stubPath, "utf8")).not.toMatch(/ui-qa-data|useProfile|SkinShowcase|require\(/);
    const route = readFileSync(join(process.cwd(), "app/ui-qa.tsx"), "utf8");
    expect(route).not.toMatch(/ui-qa-data|useUserStore|ProfilePickerModal/);
  });
  it("executes the Metro resolver's release alias while preserving the DEV fixture module", () => {
    type Context = { dev: boolean; resolveRequest: jest.Mock };
    const config = require("../metro.config") as { resolver: { resolveRequest: (context: Context, moduleName: string, platform: string) => unknown } };
    for (const dev of [true, false]) {
      const context: Context = { dev, resolveRequest: jest.fn() };
      config.resolver.resolveRequest(context, "~/mocks/ui-qa", "android");
      expect(context.resolveRequest).toHaveBeenCalledWith(context, dev ? "~/mocks/ui-qa" : join(process.cwd(), "mocks", "ui-qa.production.js"), "android");
    }
  });
});
