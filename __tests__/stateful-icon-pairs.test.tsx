import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { EconomyChart } from "~/components/match-detail/EconomyChart";
import { ScoreboardTable } from "~/components/match-detail/ScoreboardTable";
import { MatchImage } from "~/components/matches/MatchImage";
import {
  MatchListSkeleton,
  MatchStatePanel,
} from "~/components/matches/MatchStates";
import type { EconomyPoint, ScoreboardPlayer } from "~/types/match-ui";

// Task 5A intentionally covers Match-owned pairs only. Wishlist and item-upgrade
// state-pair coverage belongs to the coordinator's Task 5B commerce slice.

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/GpuLineChartCanvas", () => ({
  GpuLineChartCanvas: "GpuLineChartCanvas",
}));
jest.mock("~/hooks/useMotionPreference", () => ({
  useMotionPreference: () => true,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.number === undefined ? key : `${key}:${options.number}`,
  }),
}));
jest.mock("~/utils/match-ui", () => ({
  formatMetric: (value: number | undefined) => String(value ?? "--"),
  formatPercent: (value: number | undefined) => `${value ?? "--"}%`,
  formatSigned: (value: number | undefined) => String(value ?? "--"),
}));

const economyPoints: EconomyPoint[] = [
  {
    roundNumber: 1,
    teamAEconomy: 4_000,
    teamBEconomy: 3_000,
    teamASpent: 2_000,
    teamBSpent: 1_500,
    difference: 1_000,
    winningTeam: "A",
    outcome: "elimination",
  },
];

const scoreboardPlayers: ScoreboardPlayer[] = [
  {
    playerId: "player-a",
    playerName: "Alpha",
    team: "A",
    agent: { name: "Jett" },
    acs: 300,
    kills: 20,
    deaths: 10,
    assists: 5,
    plusMinus: 10,
    kd: 2,
    adr: 180,
  },
];

describe("stateful Match icon pairs", () => {
  it("keeps one economy icon mounted from collapsed to expanded", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<EconomyChart points={economyPoints} />);
    });

    const trigger = renderer.root.findByProps({
      testID: "match-detail-economy-menu",
    });
    const collapsedIcon = trigger.findByType(MockAppIcon);
    expect(collapsedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronDown",
    });

    act(() => trigger.props.onPress());

    const expandedIcon = renderer.root
      .findByProps({ testID: "match-detail-economy-menu" })
      .findByType(MockAppIcon);
    expect(expandedIcon).toBe(collapsedIcon);
    expect(expandedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronUp",
    });

    act(() => renderer.unmount());
  });

  it("keeps one scoreboard icon mounted from descending to ascending", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScoreboardTable
          players={scoreboardPlayers}
          onSelectPlayer={jest.fn()}
        />,
      );
    });

    const sortControl = () =>
      renderer.root.findByProps({ testID: "match-detail-sort-acs" });

    act(() => sortControl().props.onPress());
    const descendingIcon = sortControl().findByType(MockAppIcon);
    expect(descendingIcon.props).toMatchObject({
      decorative: true,
      name: "sortDescending",
    });

    act(() => sortControl().props.onPress());
    const ascendingIcon = sortControl().findByType(MockAppIcon);
    expect(ascendingIcon).toBe(descendingIcon);
    expect(ascendingIcon.props).toMatchObject({
      decorative: true,
      name: "sortAscending",
    });

    act(() => renderer.unmount());
  });

  it("keeps retry and loading as separate real Match states", () => {
    let stateRenderer!: TestRenderer.ReactTestRenderer;
    let loadingRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      stateRenderer = TestRenderer.create(
        <MatchStatePanel
          icon="history"
          title="No matches"
          body="Try refreshing"
          primaryLabel="Retry"
          onPrimaryPress={jest.fn()}
        />,
      );
      loadingRenderer = TestRenderer.create(<MatchListSkeleton />);
    });

    const retryButton = stateRenderer.root.find(
      (node) => node.props.accessibilityRole === "button",
    );
    expect(retryButton.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "retry",
    });
    expect(
      loadingRenderer.root.findAll(
        (node) =>
          node.type === View && node.props.accessibilityLabel === "Loading match",
      ),
    ).toHaveLength(4);

    act(() => {
      stateRenderer.unmount();
      loadingRenderer.unmount();
    });
  });

  it("renders 100 static MatchImage fallbacks without repeat work or icon churn", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "matches", "MatchImage.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/\b(?:setTimeout|setInterval|withRepeat)\b/);

    const renderRows = () => (
      <View>
        {Array.from({ length: 100 }, (_, index) => (
          <MatchImage key={index} style={{ height: 24, width: 24 }} />
        ))}
      </View>
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(renderRows());
    });

    const initialIcons = renderer.root.findAllByType(MockAppIcon);
    expect(initialIcons).toHaveLength(100);
    expect(initialIcons.every((icon) => icon.props.name === "emptyImage")).toBe(
      true,
    );

    act(() => renderer.update(renderRows()));

    const updatedIcons = renderer.root.findAllByType(MockAppIcon);
    expect(updatedIcons).toHaveLength(100);
    updatedIcons.forEach((icon, index) => {
      expect(icon).toBe(initialIcons[index]);
      expect(icon.props.name).toBe("emptyImage");
    });

    act(() => renderer.unmount());
  });
});
