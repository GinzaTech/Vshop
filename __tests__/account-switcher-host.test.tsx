import React from "react";
import { View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { AccountSwitcherPopupHost } from "~/components/settings/AccountSwitcherPopupHost";
import type { AccountSwitcherPopup } from "~/components/settings/AccountSwitcherPopup";

let mockFocused = true;
const mockCommits: boolean[] = [];
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("~/components/settings/AccountSwitcherPopup", () => ({
  AccountSwitcherPopup: function MockPublicPopup(props: React.ComponentProps<typeof AccountSwitcherPopup>) {
    const ReactModule = require("react") as typeof React;
    ReactModule.useLayoutEffect(() => { mockCommits.push(props.visible); });
    return ReactModule.createElement(require("react-native").View, { visible: props.visible });
  },
}));

let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => { act(() => renderer?.unmount()); mockCommits.splice(0); mockFocused = true; });

it("masks an unfocused retained host before the popup commits and requests dismissal", () => {
  mockFocused = false;
  const onDismiss = jest.fn();
  act(() => { renderer = TestRenderer.create(<AccountSwitcherPopupHost visible accounts={[]}
    currentId="current" busyId={null} onDismiss={onDismiss} onSwitch={jest.fn()} onRemove={jest.fn()} />); });
  expect(mockCommits).toEqual([false]);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("masks the first blur commit without invoking account actions and stays retired on refocus", () => {
  const onSwitch = jest.fn(), onRemove = jest.fn();
  const props = { visible: true, accounts: [], currentId: "current", busyId: null,
    onDismiss: jest.fn(), onSwitch, onRemove };
  act(() => { renderer = TestRenderer.create(<AccountSwitcherPopupHost {...props} />); });
  expect(mockCommits).toEqual([true]);
  mockFocused = false;
  act(() => renderer.update(<AccountSwitcherPopupHost {...props} />));
  expect(mockCommits).toEqual([true, false]);
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  // The parent accepts dismissal and clears retained open state.
  act(() => renderer.update(<AccountSwitcherPopupHost {...props} visible={false} />));
  mockFocused = true;
  act(() => renderer.update(<AccountSwitcherPopupHost {...props} visible={false} />));
  expect(renderer.root.findByType(View).props.visible).toBe(false);
  expect(onSwitch).not.toHaveBeenCalled();
  expect(onRemove).not.toHaveBeenCalled();
});
