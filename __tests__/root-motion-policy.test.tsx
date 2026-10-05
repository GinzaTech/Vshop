import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { AccessibilityInfo } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { cancelAnimation, makeMutable, ReduceMotion, ReducedMotionConfig, withTiming } from "react-native-reanimated";
import { useMotionPreference } from "~/hooks/useMotionPreference";

// Keep Reanimated's installed public policy and animation implementation real;
// only the unavailable native worklet runtime uses its supported Jest mock.
jest.mock("react-native-worklets", () => jest.requireActual("react-native-worklets/lib/module/mock"));

function rootBridge() {
  const source = ts.createSourceFile("_layout.tsx", readFileSync(path.join(__dirname, "../app/_layout.tsx"), "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bridges: ts.JsxSelfClosingElement[] = [];
  const livePreferences: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "ReducedMotionConfig") bridges.push(node);
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "reduceMotionEnabled" &&
        node.initializer && ts.isCallExpression(node.initializer) &&
        node.initializer.expression.getText(source) === "useMotionPreference") livePreferences.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(bridges).toHaveLength(1);
  expect(livePreferences).toHaveLength(1);
  const bridge = bridges[0];
  const attribute = bridge.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === "mode");
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isJsxExpression(attribute.initializer) ||
      !attribute.initializer.expression || !ts.isConditionalExpression(attribute.initializer.expression)) {
    throw new Error("Root policy must select its mode from the live preference");
  }
  const expression = attribute.initializer.expression;
  expect(expression.condition.getText(source)).toBe("reduceMotionEnabled");
  const publicImport = source.statements.find((statement) => ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "react-native-reanimated");
  expect(publicImport?.getText(source)).toContain("ReducedMotionConfig");
  expect(publicImport?.getText(source)).toContain("ReduceMotion");
  return { bridge, source, expression };
}

function modeFor(enabled: boolean): ReduceMotion {
  const { source, expression } = rootBridge();
  const value = (enabled ? expression.whenTrue : expression.whenFalse).getText(source);
  if (value === "ReduceMotion.Always") return ReduceMotion.Always;
  if (value === "ReduceMotion.Never") return ReduceMotion.Never;
  if (value === "ReduceMotion.System") return ReduceMotion.System;
  throw new Error(`Unexpected root motion policy: ${value}`);
}

function RootPolicyProbe() {
  return <ReducedMotionConfig mode={modeFor(useMotionPreference())} />;
}

it("mounts one public policy outside the loading/error subtree with live Always/Never modes", () => {
  const { bridge, source } = rootBridge();
  const ancestors: string[] = [];
  let ancestor: ts.Node | undefined = bridge.parent;
  while (ancestor) {
    if (ts.isJsxElement(ancestor)) ancestors.push(ancestor.openingElement.tagName.getText(source));
    ancestor = ancestor.parent;
  }
  expect(ancestors).toContain("GestureHandlerRootView");
  expect(ancestors).not.toContain("ErrorBoundary");
  expect(modeFor(true)).toBe(ReduceMotion.Always);
  expect(modeFor(false)).toBe(ReduceMotion.Never);
});

it("changes actual System timing behavior on live OS toggles and restores policy/listeners on unmount", async () => {
  jest.useFakeTimers();
  let notify!: (enabled: boolean) => void;
  const remove = jest.fn();
  const query = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(
    ((_event: string, callback: (enabled: boolean) => void) => {
      notify = callback;
      return { remove };
    }) as unknown as typeof AccessibilityInfo.addEventListener,
  );
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const value = makeMutable(0);
  const completed = jest.fn();
  const start = () => {
    cancelAnimation(value);
    value.value = 0;
    completed.mockClear();
    value.value = withTiming(100, { duration: 100, reduceMotion: ReduceMotion.System }, completed);
  };
  try {
    await act(async () => { renderer = TestRenderer.create(<RootPolicyProbe />); });
    expect(subscribe).toHaveBeenCalledTimes(1);
    start();
    expect(value.value).toBe(100);
    expect(completed).toHaveBeenCalledWith(true);
    act(() => notify(false));
    start();
    expect(value.value).toBe(0);
    expect(completed).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(50));
    expect(value.value).toBeGreaterThan(0);
    expect(value.value).toBeLessThan(100);
    act(() => notify(true));
    start();
    expect(value.value).toBe(100);
    expect(completed).toHaveBeenCalledWith(true);
    act(() => renderer?.unmount());
    renderer = undefined;
    expect(remove).toHaveBeenCalledTimes(1);
    start(); // The installed public component restores the original policy.
    expect(value.value).toBe(0);
    expect(completed).not.toHaveBeenCalled();
  } finally {
    act(() => renderer?.unmount());
    cancelAnimation(value);
    jest.runOnlyPendingTimers();
    query.mockRestore();
    subscribe.mockRestore();
    jest.useRealTimers();
  }
});
