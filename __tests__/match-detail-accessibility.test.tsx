import React from "react";
import { Image } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { EconomyChart } from "~/components/match-detail/EconomyChart";
import { RoundDetailPanel } from "~/components/match-detail/PerformanceStats";
import { RoundTimeline } from "~/components/match-detail/RoundTimeline";
import {
  MatchDetailTabs,
  type MatchDetailTab,
} from "~/components/match-detail/MatchDetailTabs";
import { ScoreboardTable } from "~/components/match-detail/ScoreboardTable";
import { StickyShareBar } from "~/components/match-detail/StickyShareBar";
import type {
  EconomyPoint,
  RoundDetail,
  RoundOutcome,
  ScoreboardPlayer,
} from "~/types/match-ui";

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "match_ui.round.label") return `Round ${options?.number}`;
      if (key === "match_ui.round.count") return `${options?.count} rounds`;

      return (
        {
          "match_ui.actions.share": "Share",
          "match_ui.actions.share_match": "Share match",
          "match_ui.economy.difference": "Economy difference",
          "match_ui.economy.loadout": "Loadout difference",
          "match_ui.economy.spent": "Credits spent",
          "match_ui.economy.tap_hint": "Tap a marker",
          "match_ui.economy.title": "Economy",
          "match_ui.economy.total": "Total economy",
          "match_ui.round.winner": "Winner",
          "match_ui.scoreboard.assists": "A",
          "match_ui.scoreboard.deaths": "D",
          "match_ui.scoreboard.kills": "K",
          "match_ui.scoreboard.player": "Player",
          "match_ui.scoreboard.rank": "Rank",
          "match_ui.scoreboard.sort_ascending": "Ascending",
          "match_ui.scoreboard.sort_by": "Sort by",
          "match_ui.scoreboard.sort_descending": "Descending",
          "match_ui.scoreboard.team_a_stats": "Team A statistics",
          "match_ui.scoreboard.team_b_stats": "Team B statistics",
          "match_ui.states.partial": "Partial data",
          "match_ui.tabs.performance": "Performance",
          "match_ui.tabs.scoreboard": "Scoreboard",
          "match_ui.teams.team_a": "Team A",
          "match_ui.teams.team_b": "Team B",
        } as Record<string, string>
      )[key] ?? key;
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("~/components/ui/GpuLineChartCanvas", () => ({
  GpuLineChartCanvas: "GpuLineChartCanvas",
}));

jest.mock("~/components/matches/MatchImage", () => ({
  MatchImage: "MatchImage",
}));

jest.mock("~/utils/match-ui", () => ({
  formatDuration: (value: number) => `${value}s`,
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
  {
    roundNumber: 2,
    teamAEconomy: 2_500,
    teamBEconomy: 5_000,
    teamASpent: 1_000,
    teamBSpent: 3_000,
    difference: -2_500,
    winningTeam: "B",
    outcome: "spike_detonated",
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
  {
    playerId: "player-c",
    playerName: "Charlie",
    team: "A",
    agent: { name: "Omen" },
    acs: 220,
    kills: 15,
    deaths: 12,
    assists: 6,
    plusMinus: 3,
    kd: 1.25,
    adr: 140,
  },
  {
    playerId: "player-partial",
    playerName: "Partial",
    team: "A",
    agent: { name: "Sova" },
    acs: 190,
    kills: 10,
    deaths: 11,
    assists: 7,
    plusMinus: -1,
    kd: 0.91,
    adr: undefined as unknown as number,
  },
  {
    playerId: "player-b",
    playerName: "Bravo",
    team: "B",
    agent: { name: "Sage" },
    acs: 200,
    kills: 12,
    deaths: 14,
    assists: 8,
    plusMinus: -2,
    kd: 0.86,
    adr: 130,
  },
];

const makeRound = (
  roundNumber: number,
  outcome: RoundOutcome,
  events: RoundDetail["events"] = [],
): RoundDetail => ({
  roundNumber,
  winningTeam: "A",
  sideForTeamA: "attack",
  outcome,
  durationSeconds: 90,
  teamAEconomy: 4_000,
  teamBEconomy: 3_000,
  events,
});

describe("Match Detail accessibility contracts", () => {
  it("exposes stable tablist, tab, and share selectors", () => {
    const onChange = jest.fn<void, [MatchDetailTab]>();
    const onShare = jest.fn();
    let tabsRenderer!: TestRenderer.ReactTestRenderer;
    let shareRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      tabsRenderer = TestRenderer.create(
        <MatchDetailTabs activeTab="scoreboard" onChange={onChange} />,
      );
      shareRenderer = TestRenderer.create(<StickyShareBar onShare={onShare} />);
    });

    const tabList = tabsRenderer.root.findByProps({ testID: "match-detail-tabs" });
    const scoreboardTab = tabsRenderer.root.findByProps({
      testID: "match-detail-tab-scoreboard",
    });
    const performanceTab = tabsRenderer.root.findByProps({
      testID: "match-detail-tab-performance",
    });
    const shareButton = shareRenderer.root.findByProps({
      testID: "match-detail-share-button",
    });

    expect(tabList.props.accessibilityRole).toBe("tablist");
    expect(scoreboardTab.props.accessibilityRole).toBe("tab");
    expect(scoreboardTab.props.accessibilityState).toEqual({ selected: true });
    expect(performanceTab.props.accessibilityState).toEqual({ selected: false });
    expect(shareButton.props.accessibilityRole).toBe("button");
    expect(shareButton.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "share",
    });

    act(() => performanceTab.props.onPress());
    act(() => shareButton.props.onPress());

    expect(onChange).toHaveBeenCalledWith("performance");
    expect(onShare).toHaveBeenCalledTimes(1);

    act(() => {
      tabsRenderer.unmount();
      shareRenderer.unmount();
    });
  });

  it("keeps the economy summary separate from selectable round markers", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<EconomyChart points={economyPoints} />);
    });

    const summary = renderer.root.findByProps({
      testID: "match-detail-economy-summary",
    });
    const chart = renderer.root.findByProps({
      testID: "match-detail-economy-chart",
    });
    const axisLabels = renderer.root.findByProps({
      testID: "match-detail-economy-axis-labels",
    });
    const visualRoundOne = renderer.root.findByProps({
      testID: "match-detail-economy-round-label-1",
    });
    const roundOne = () =>
      renderer.root.findByProps({ testID: "match-detail-economy-round-1" });
    const roundTwo = () =>
      renderer.root.findByProps({ testID: "match-detail-economy-round-2" });

    expect(summary.props.accessibilityRole).toBe("summary");
    expect(summary.props.accessibilityLabel).toContain("2 rounds");
    expect(summary.props.accessibilityLabel).toContain("Economy difference");
    expect(chart.props.accessible).toBe(false);
    expect(axisLabels.props.accessibilityElementsHidden).toBe(true);
    expect(axisLabels.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    expect(visualRoundOne.props.accessible).toBe(false);
    expect(visualRoundOne.props.accessibilityElementsHidden).toBe(true);
    expect(visualRoundOne.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    expect(roundOne().props.accessibilityRole).toBe("button");
    expect(roundOne().props.accessibilityState).toEqual({ selected: false });
    expect(roundTwo().props.accessibilityState).toEqual({ selected: false });

    act(() => roundOne().props.onPress());

    expect(roundOne().props.accessibilityState).toEqual({ selected: true });
    expect(roundTwo().props.accessibilityState).toEqual({ selected: false });

    act(() => renderer.unmount());
  });

  it("announces and identifies the active economy metric", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<EconomyChart points={economyPoints} />);
    });

    const trigger = () =>
      renderer.root.findByProps({ testID: "match-detail-economy-menu" });

    expect(trigger().props.accessibilityState).toEqual({ expanded: false });
    act(() => trigger().props.onPress());

    const difference = () =>
      renderer.root.findByProps({
        testID: "match-detail-economy-metric-difference",
      });
    const total = () =>
      renderer.root.findByProps({ testID: "match-detail-economy-metric-total" });

    expect(difference().props.accessibilityState).toEqual({ selected: true });
    expect(total().props.accessibilityState).toEqual({ selected: false });

    act(() => total().props.onPress());
    act(() => trigger().props.onPress());

    expect(difference().props.accessibilityState).toEqual({ selected: false });
    expect(total().props.accessibilityState).toEqual({ selected: true });
    expect(
      renderer.root.findByProps({ testID: "match-detail-economy-summary" })
        .props.accessibilityLabel,
    ).toContain("Total economy");

    act(() => renderer.unmount());
  });

  it("announces scoreboard sort direction through a stable control", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScoreboardTable players={scoreboardPlayers} onSelectPlayer={jest.fn()} />,
      );
    });

    const acsSort = () =>
      renderer.root.findByProps({ testID: "match-detail-sort-acs" });

    expect(acsSort().props.accessibilityRole).toBe("button");
    expect(acsSort().props.accessibilityState).toEqual({
      disabled: false,
      selected: false,
    });
    expect(acsSort().props.accessibilityValue).toBeUndefined();

    act(() => acsSort().props.onPress());
    expect(acsSort().props.accessibilityState.selected).toBe(true);
    expect(acsSort().props.accessibilityValue).toEqual({ text: "Descending" });

    act(() => acsSort().props.onPress());
    expect(acsSort().props.accessibilityValue).toEqual({ text: "Ascending" });

    act(() => acsSort().props.onPress());
    expect(acsSort().props.accessibilityState.selected).toBe(false);
    expect(acsSort().props.accessibilityValue).toBeUndefined();

    act(() => renderer.unmount());
  });

  it("keeps missing scoreboard values last in both sort directions", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScoreboardTable players={scoreboardPlayers} onSelectPlayer={jest.fn()} />,
      );
    });

    const adrSort = () =>
      renderer.root.findByProps({ testID: "match-detail-sort-adr" });
    const teamAOrder = () => [
      ...new Set(
        renderer.root
          .findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            ["Alpha, Jett", "Charlie, Omen", "Partial, Sova"].includes(
              node.props.accessibilityLabel,
            ),
          )
          .map((node) => node.props.accessibilityLabel as string),
      ),
    ];

    act(() => adrSort().props.onPress());
    expect(teamAOrder()).toEqual([
      "Alpha, Jett",
      "Charlie, Omen",
      "Partial, Sova",
    ]);

    act(() => adrSort().props.onPress());
    expect(teamAOrder()).toEqual([
      "Charlie, Omen",
      "Alpha, Jett",
      "Partial, Sova",
    ]);

    act(() => renderer.unmount());
  });

  it("preserves exact semantic tokens for every Valorant round outcome", () => {
    const outcomes: RoundOutcome[] = [
      "elimination",
      "spike_defused",
      "spike_detonated",
      "time_expired",
      "surrender",
      "unknown",
    ];
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <RoundTimeline
          rounds={outcomes.map((outcome, index) =>
            makeRound(index + 1, outcome),
          )}
          selectedPlayerId="player-a"
          selectedRoundNumber={null}
          onSelectRound={jest.fn()}
        />,
      );
    });

    expect(
      renderer.root.findAllByType(MockAppIcon).map((icon) => icon.props.name),
    ).toEqual([
      "roundElimination",
      "roundSpikeDefused",
      "roundSpikeDetonated",
      "roundTimeExpired",
      "roundSurrender",
      "unknown",
    ]);

    act(() => renderer.unmount());
  });

  it("keeps the spike asset and exact objective fallback tokens", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <RoundDetailPanel
          round={makeRound(1, "spike_defused", [
            { id: "plant", timestampSeconds: 10, type: "plant" },
            { id: "defuse", timestampSeconds: 20, type: "defuse" },
            { id: "ability", timestampSeconds: 30, type: "ability" },
          ])}
          selectedPlayerTeam="A"
          players={[]}
        />,
      );
    });

    expect(renderer.root.findByType(Image).props.accessibilityLabel).toBe(
      "match_ui.round.plant_spike",
    );
    expect(
      renderer.root.findAllByType(MockAppIcon).map((icon) => icon.props.name),
    ).toEqual(["roundSpikeDefused", "objectiveCrosshair"]);

    act(() => renderer.unmount());
  });
});
