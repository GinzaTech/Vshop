import React from "react";
import { AccessibilityInfo, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { usePickerModalFocus } from "~/features/profile/usePickerModalFocus";

it("waits for presentation, focuses once, and ignores old onShow callbacks after close/reopen/unmount", () => {
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined);
  let controls!: ReturnType<typeof usePickerModalFocus>;
  const dismiss = jest.fn();
  function Probe({ visible }: { visible: boolean }) {
    controls = usePickerModalFocus(visible, dismiss);
    return <View ref={controls.closeButtonRef} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<Probe visible />); });
    expect(focus).not.toHaveBeenCalled();
    const firstShow = controls.handleNativeShow;
    act(() => { firstShow(); firstShow(); });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0][1]).toBe("focus");
    act(() => renderer.update(<Probe visible={false} />));
    act(() => firstShow());
    expect(focus).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<Probe visible />));
    act(() => firstShow());
    expect(focus).toHaveBeenCalledTimes(1);
    act(() => controls.handleNativeShow());
    expect(focus).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    act(() => controls.handleNativeShow());
    expect(focus).toHaveBeenCalledTimes(2);
  } finally {
    if (renderer) act(() => renderer.unmount());
    focus.mockRestore();
  }
});
