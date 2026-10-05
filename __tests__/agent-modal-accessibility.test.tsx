import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AgentModal } from "~/components/GalleryAgent";

jest.mock("~/utils/valorant-assets", () => ({ getAgent: () => ({ agents: [] }) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => false }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key === "common.close" ? "Close" : key }) }));

it("exposes a visible close control and selected ability names while preserving callbacks", () => {
  const ability = { slot: "Ability1", displayName: "Test skill", description: "Description", displayIcon: "https://example.com/icon" } as Ability;
  const agent = { uuid: "qa-agent", displayName: "QA Agent", abilities: [ability] } as ValorantAgent;
  const onClose = jest.fn(); const onAbilityPress = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AgentModal agent={agent} selectedAbility={ability} onClose={onClose} onAbilityPress={onAbilityPress} sortAbilities={(items) => items ?? []} />); });
  const close = renderer.root.find((node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === "Close");
  act(() => close.props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  const choice = renderer.root.find((node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === "Test skill");
  expect(choice.props.accessibilityState).toEqual({ selected: true });
  act(() => choice.props.onPress());
  expect(onAbilityPress).toHaveBeenCalledWith(ability);
  act(() => renderer.unmount());
});
