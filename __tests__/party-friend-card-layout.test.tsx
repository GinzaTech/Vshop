import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PartyFriendRail from "~/features/party/PartyFriendRail";
import { partyStyles } from "~/features/party/party.styles";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (_key: string, value: { defaultValue: string }) => value.defaultValue }) }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));

it("gives complete online/busy status room on a slightly wider crisp friend card", () => {
  const actions = { onInvite: jest.fn(), onAllFriends: jest.fn() };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<PartyFriendRail
    friends={[{ id: "qa-friend", name: "QA Friend", presence: "available", activityLabel: "Trực tuyến", canInvite: false }]}
    connectionStatus="authenticated" disabled inviting={false} {...actions} />); });
  const card = StyleSheet.flatten(partyStyles.friendCard);
  expect(card.width).toBe(96);
  expect(card).toMatchObject({ elevation: 0, shadowOpacity: 0 });
  const label = renderer.root.findAllByType(Text).find((node) => node.props.children === "Trực tuyến")!;
  expect(label).toBeDefined(); expect(label.props.numberOfLines).toBe(2);
  expect(StyleSheet.flatten(label.props.style)).toMatchObject({ textAlign: "center", minHeight: 40 });
  const invite = renderer.root.findAll((node) => node.props.accessibilityRole === "button" && node.props.accessibilityHint === "Sends a party invitation")[0];
  expect(invite.props.disabled).toBe(true);
  expect(actions.onInvite).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(View).length).toBeGreaterThan(0);
  act(() => renderer.unmount());
});
