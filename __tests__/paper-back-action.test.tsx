import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Appbar, Provider as PaperProvider } from "react-native-paper";
import AppIcon from "~/components/ui/AppIcon";
import { PaperBackIcon } from "~/components/ui/PaperIcon";

jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));

it("renders a back glyph without Paper's missing-font fallback and keeps the back action", () => {
  const back = jest.fn();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<PaperProvider><Appbar.Action accessibilityLabel="Back" isLeading icon={PaperBackIcon} onPress={back} /></PaperProvider>); });
    expect(renderer.root.findByType(AppIcon).props).toMatchObject({ name: "back", decorative: true });
    act(() => renderer.root.findByProps({ accessibilityLabel: "Back" }).props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("none of the required icon libraries");
  } finally {
    if (renderer) act(() => renderer.unmount());
    warn.mockRestore();
  }
});
