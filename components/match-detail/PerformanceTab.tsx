import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  OpponentBreakdownTable,
  RoundDetailPanel,
  SideStatsGrid,
  WeaponStatsTable,
} from "~/components/match-detail/PerformanceStats";
import { PlayerPerformanceSummary } from "~/components/match-detail/PlayerPerformanceSummary";
import { RoundTimeline } from "~/components/match-detail/RoundTimeline";
import { TeamAgentStrip } from "~/components/match-detail/TeamAgentStrip";
import { MATCH_COLORS, MATCH_SPACING } from "~/constants/MatchTheme";
import type { MatchDetailViewModel } from "~/types/match-ui";

type PerformanceTabProps = {
  data: MatchDetailViewModel;
  selectedPlayerId: string;
  selectedRoundNumber: number | null;
  onSelectPlayer: (playerId: string) => void;
  onSelectRound: (roundNumber: number) => void;
};

export const PerformanceTab = React.memo(function PerformanceTab({
  data,
  selectedPlayerId,
  selectedRoundNumber,
  onSelectPlayer,
  onSelectRound,
}: PerformanceTabProps) {
  const { t } = useTranslation();
  const performance = data.playerPerformance[selectedPlayerId];
  const selectedPlayer = data.playerRefs.find(
    (player) => player.playerId === selectedPlayerId
  );
  const selectedRound =
    data.rounds.find((round) => round.roundNumber === selectedRoundNumber) ?? null;

  return (
    <View style={styles.content}>
      <TeamAgentStrip
        players={data.playerRefs}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
      {performance ? (
        <>
          <PlayerPerformanceSummary summary={performance.summary} />
          <RoundTimeline
            rounds={data.rounds}
            selectedPlayerId={selectedPlayerId}
            selectedRoundNumber={selectedRoundNumber}
            onSelectRound={onSelectRound}
          />
          <RoundDetailPanel
            round={selectedRound}
            selectedPlayerTeam={selectedPlayer?.team ?? "A"}
            players={data.playerRefs}
          />
          <SideStatsGrid stats={performance.sideStats} />
          <OpponentBreakdownTable opponents={performance.opponents} />
          <WeaponStatsTable weapons={performance.weapons} />
        </>
      ) : (
        <View style={styles.partialState}>
          <Text style={styles.partialTitle}>{t("match_ui.states.partial")}</Text>
          <Text style={styles.partialBody}>{t("match_ui.states.partial_body")}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingBottom: MATCH_SPACING.xxl,
  },
  partialState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.xxl,
  },
  partialTitle: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  partialBody: {
    marginTop: MATCH_SPACING.sm,
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
});
