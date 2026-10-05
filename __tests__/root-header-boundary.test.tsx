import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "node:fs";
import ts from "typescript";

it("keeps custom header hooks in their own component when native-stack hides and shows the header", () => {
  const text = readFileSync("app/_layout.tsx", "utf8");
  const source = ts.createSourceFile("_layout.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "header") expression = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(expression).toBeDefined();
  const compiled = ts.transpile(`const render = ${expression!.getText(source)};`, { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 });
  function Header() { React.useState(0); return <React.Fragment />; }
  const renderHeader = new Function("React", "CustomHeader", `${compiled}; return render;`)(React, Header) as (props: object) => React.ReactNode;
  function NativeScene({ shown }: { shown: boolean }) {
    React.useState(0);
    return <>{shown ? renderHeader({ options: {}, navigation: { goBack: jest.fn() } }) : null}</>;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<NativeScene shown />); });
  act(() => renderer.update(<NativeScene shown={false} />));
  act(() => renderer.update(<NativeScene shown />));
  expect(renderer.root.findAllByType(Header)).toHaveLength(1);
  act(() => renderer.unmount());
});
