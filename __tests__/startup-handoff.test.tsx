import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useStartupHandoff } from "~/hooks/useStartupHandoff";

it("keeps startup blocked until the requested route commits and follows the newest destination", () => {
  let controls!: ReturnType<typeof useStartupHandoff>;
  function Probe({ pathname }: { pathname: string }) { controls = useStartupHandoff(pathname); return null; }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Probe pathname="/setup" />); });
  expect(controls.committed).toBe(false);
  act(() => controls.requestHandoff("/profile", "profile"));
  expect(controls.committed).toBe(false);
  act(() => controls.requestHandoff("/reauth", "reauth"));
  act(() => renderer.update(<Probe pathname="/profile" />));
  expect(controls.committed).toBe(false);
  act(() => renderer.update(<Probe pathname="/reauth" />));
  expect(controls.committed).toBe(true);
  expect(controls.destination?.metricRoute).toBe("reauth");
  act(() => renderer.unmount());
});
