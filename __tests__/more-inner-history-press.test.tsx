import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, StyleSheet } from "react-native";
import { withSpring } from "react-native-reanimated";
import { MatchCard } from "~/components/matches/MatchCard";
import { MatchImage } from "~/components/matches/MatchImage";
import type { MatchHistoryItem } from "~/types/match-ui";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const copy = Object.create(null, Object.getOwnPropertyDescriptors(actual));
  Object.defineProperty(copy, "Pressable", { value: "MockPressable", configurable: true });
  return copy;
});

jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 360, height: 800 }) }));
jest.mock("~/components/matches/MatchImage", () => ({ MatchImage: () => null }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ skins: [], agents: [], maps: [], competitiveTiers: [] }), getAgent: () => ({ agents: [] }) }));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: { View: Native.View },
    Easing: { cubic: () => 0, out: (value: unknown) => value, inOut: (value: unknown) => value, bezier: () => (value: number) => value },
    ReduceMotion: { System: "system" }, useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current, withSpring: jest.fn((value: number) => value) };
});

it("history press keeps agent media and card geometry sharp while the real match action remains exact", () => {
  const match: MatchHistoryItem = { id: "fixture-match", startedAt: "2026-10-04T00:00:00Z", result: "win", teamScore: 13,
    opponentScore: 9, mode: "competitive", mapName: "Actual map", agent: { id: "fixture-agent", name: "Agent", iconUrl: "https://example.com/agent.png" },
    placement: 1, kills: 20, deaths: 10, assists: 3, kd: 2, adr: 140, acs: 220 };
  const onPress = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<MatchCard match={match} locale="en" onPress={onPress} />); });
    const image = renderer.root.findAllByType(MatchImage)[0];
    const touch = renderer.root.findByType(Pressable);
    const style = StyleSheet.flatten(typeof touch.props.style === "function" ? touch.props.style({ pressed: false }) : touch.props.style);
    jest.mocked(withSpring).mockClear();
    act(() => touch.props.onPressIn({}));
    expect(jest.mocked(withSpring)).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(MatchImage)[0]).toBe(image);
    expect(style.opacity ?? 1).toBe(1);
    expect(style.transform).toBeUndefined();
    act(() => { touch.props.onPressOut({}); touch.props.onPress({}); });
    expect(onPress).toHaveBeenCalledWith(match.id);
    expect(touch.props.accessibilityRole).toBe("button");
  } finally { act(() => renderer?.unmount()); }
});
