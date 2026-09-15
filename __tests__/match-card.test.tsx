import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { MatchCard } from "~/components/matches/MatchCard";
import { MATCH_COLORS } from "~/constants/MatchTheme";
import type { MatchHistoryItem, MatchResult } from "~/types/match-ui";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/constants/Motion", () => ({ MOTION_SPRING: { press: {}, settle: {} } }));
jest.mock("~/components/matches/MatchImage", () => ({ MatchImage: () => null }));
jest.mock("~/utils/match-ui", () => ({
  formatMatchRelativeTime: () => "now", formatMetric: String, formatOrdinal: String,
  formatPercent: String, humanizeMatchMode: String,
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (factory: () => object) => factory(),
  withSpring: (value: number) => value,
  ReduceMotion: { System: "system" },
}));

const makeMatch = (result: MatchResult): MatchHistoryItem => ({
  id: "match", result, mapName: "Ascent", mode: "competitive", startedAt: new Date().toISOString(),
  teamScore: 0, opponentScore: 0, agent: { id: "agent", name: "Agent" },
  placement: 1, kills: 1, deaths: 1, assists: 1, kd: 1, adr: 100, acs: 200,
});

describe("match result card", () => {
  it.each<MatchResult>(["win", "loss", "draw", "cancelled", "unknown"])("labels %s truthfully and opens its match", (result) => {
    let renderer!: TestRenderer.ReactTestRenderer;
    const open = jest.fn();
    act(() => { renderer = TestRenderer.create(<MatchCard match={makeMatch(result)} locale="en" onPress={open} />); });
    try {
      const label = `match_ui.result.${result}`;
      const button = renderer.root.findAll((node) => node.props.accessibilityRole === "button")[0];
      expect(button.props.accessibilityLabel).toContain(label);
      const text = renderer.root.findAll((node) => node.props.children === label)[0];
      expect(text).toBeDefined();
      if (result === "cancelled" || result === "unknown") {
        expect(StyleSheet.flatten(text!.props.style).color).toBe(MATCH_COLORS.textMuted);
      }
      act(() => button.props.onPress());
      expect(open).toHaveBeenCalledWith("match");
    } finally { act(() => renderer.unmount()); }
  });
});
