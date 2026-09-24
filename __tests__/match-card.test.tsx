import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
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

const MATCH_COMPONENT_ROOTS = [
  "components/match-detail",
  "components/matches",
] as const;
const MATCH_IMAGE_VENDOR_ALIASES = [
  "account-outline",
  "hexagon-outline",
  "image-outline",
  "map-outline",
  "pistol",
  "shield-outline",
] as const;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

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

  it("keeps known vendor aliases out of every MatchImage caller prop", () => {
    const vendorAliasPattern = new RegExp(
      `\\bicon=["'](?:${MATCH_IMAGE_VENDOR_ALIASES.join("|")})["']`,
    );
    const violations = MATCH_COMPONENT_ROOTS.flatMap((root) =>
      listSourceFiles(root)
        .filter((filePath) => vendorAliasPattern.test(readFileSync(filePath, "utf8")))
        .map((filePath) => relative(process.cwd(), filePath).replaceAll("\\", "/")),
    );

    expect(violations).toEqual([]);
  });
});
