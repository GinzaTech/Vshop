// ===== PerformanceTab.tsx =====
// Tab "Performance" của màn chi tiết trận: dải agent 2 đội, tóm tắt hiệu suất
// người chơi đang chọn, timeline vòng, chi tiết vòng, chỉ số theo bên,
// bảng đối đầu và bảng vũ khí.
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

/**
 * PerformanceTabProps – Props của PerformanceTab.
 *
 * @param data – ViewModel chi tiết trận (rounds, playerRefs, playerPerformance).
 * @param selectedPlayerId – UUID người chơi đang được chọn để xem hiệu suất.
 * @param selectedRoundNumber – Số vòng đang chọn trên timeline (null nếu chưa).
 * @param onSelectPlayer – Callback khi chọn người chơi khác trong dải agent.
 * @param onSelectRound – Callback khi chọn một vòng trên timeline.
 */
type PerformanceTabProps = {
  data: MatchDetailViewModel;
  selectedPlayerId: string;
  selectedRoundNumber: number | null;
  onSelectPlayer: (playerId: string) => void;
  onSelectRound: (roundNumber: number) => void;
};

/**
 * PerformanceTab – Nội dung tab hiệu suất (memo hoá).
 * Nếu không có dữ liệu performance cho người chơi đang chọn, hiển thị trạng
 * thái "partial". Thuần presentational, không side effect.
 *
 * @param data – ViewModel trận (xem PerformanceTabProps).
 * @param selectedPlayerId – Người chơi đang chọn.
 * @param selectedRoundNumber – Vòng đang chọn.
 * @param onSelectPlayer – Callback chọn người chơi.
 * @param onSelectRound – Callback chọn vòng.
 * @returns View chứa chuỗi section hiệu suất hoặc trạng thái thiếu dữ liệu.
 */
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
