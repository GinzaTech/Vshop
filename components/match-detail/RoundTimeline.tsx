// ===== RoundTimeline.tsx =====
// Timeline các vòng của trận: mỗi vòng một ô bấm được, hiển thị đội thắng
// (màu), kết thúc vòng (icon), số kill/chết của người chơi đang chọn.
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  MATCH_COLORS,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { RoundDetail } from "~/types/match-ui";

/**
 * RoundTimelineProps – Props của RoundTimeline.
 *
 * @param rounds – Danh sách chi tiết từng vòng (kết quả, sự kiện, đội thắng).
 * @param selectedPlayerId – Người chơi đang chọn (tính kill/chết trên ô).
 * @param selectedRoundNumber – Vòng đang chọn (null nếu chưa chọn).
 * @param onSelectRound – Callback khi bấm một vòng.
 */
type RoundTimelineProps = {
  rounds: RoundDetail[];
  selectedPlayerId: string;
  selectedRoundNumber: number | null;
  onSelectRound: (roundNumber: number) => void;
};

// CELL_WIDTH: Chiều rộng cố định của một ô vòng (dùng tính scroll căn giữa)
const CELL_WIDTH = 48;

/**
 * outcomeIcon – Ánh xạ kết thúc vòng → tên icon MaterialCommunityIcons.
 * @param outcome – Loại kết thúc vòng (defuse/detonate/hết giờ/đầu hàng/kill).
 * @returns Tên icon tương ứng, mặc định "crosshairs-gps" (loại bỏ đội địch).
 */
const outcomeIcon = (outcome: RoundDetail["outcome"]) => {
  if (outcome === "spike_defused") return "shield-check-outline" as const;
  if (outcome === "spike_detonated") return "bomb" as const;
  if (outcome === "time_expired") return "timer-sand" as const;
  if (outcome === "surrender") return "flag-outline" as const;
  return "crosshairs-gps" as const;
};

/**
 * RoundTimeline – Dải timeline cuộn ngang các vòng (memo hoá).
 * Mỗi ô: thanh màu đội thắng + icon kết thúc + badge kill (số) hoặc icon
 * chết, số vòng bên dưới. Bấm ô sẽ chọn vòng và cuộn để căn giữa ô đó.
 * Thuần presentational, không side effect.
 *
 * @param rounds – Danh sách vòng (xem RoundTimelineProps).
 * @param selectedPlayerId – Người chơi đang chọn.
 * @param selectedRoundNumber – Vòng đang chọn.
 * @param onSelectRound – Callback chọn vòng.
 * @returns View section với tiêu đề, số vòng và ScrollView timeline
 *          (hoặc text "partial" khi không có dữ liệu).
 */
export const RoundTimeline = React.memo(function RoundTimeline({
  rounds,
  selectedPlayerId,
  selectedRoundNumber,
  onSelectRound,
}: RoundTimelineProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // scrollRef: điều khiển cuộn ngang để căn giữa ô vòng được chọn
  const scrollRef = React.useRef<ScrollView>(null);

  // selectRound: chọn vòng + cuộn ngang đưa ô về giữa màn hình
  const selectRound = (roundNumber: number, index: number) => {
    onSelectRound(roundNumber);
    scrollRef.current?.scrollTo({
      x: Math.max(0, index * CELL_WIDTH - width / 2 + CELL_WIDTH),
      animated: true,
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t("match_ui.round.timeline")}</Text>
        <Text style={styles.roundCount}>
          {t("match_ui.round.count", { count: rounds.length })}
        </Text>
      </View>
      {rounds.length === 0 ? (
        <Text style={styles.emptyText}>{t("match_ui.states.partial")}</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {rounds.map((round, index) => {
            const selected = selectedRoundNumber === round.roundNumber;
            const kills = round.events.filter(
              (event) =>
                event.type === "kill" && event.actorPlayerId === selectedPlayerId
            ).length;
            const died = round.events.some(
              (event) =>
                event.type === "kill" && event.targetPlayerId === selectedPlayerId
            );
            const teamColor =
              round.winningTeam === "A"
                ? MATCH_COLORS.teamA
                : MATCH_COLORS.teamB;

            return (
              <Pressable
                key={round.roundNumber}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${t("match_ui.round.label", { number: round.roundNumber })}, ${t("match_ui.round.winner")} ${round.winningTeam}`}
                onPress={() => selectRound(round.roundNumber, index)}
                style={({ pressed }) => [
                  styles.cell,
                  pressed && styles.cellPressed,
                ]}
              >
                <View
                  style={[
                    styles.roundBar,
                    { backgroundColor: teamColor },
                    selected && styles.roundBarSelected,
                  ]}
                >
                  <Icon
                    name={outcomeIcon(round.outcome)}
                    size={16}
                    color={MATCH_COLORS.textPrimary}
                  />
                  {kills > 0 ? (
                    <View style={styles.eventBadge}>
                      <Icon name="skull-outline" size={11} color={MATCH_COLORS.textPrimary} />
                      <Text style={styles.eventCount}>{kills}</Text>
                    </View>
                  ) : died ? (
                    <Icon name="skull" size={13} color={MATCH_COLORS.loss} />
                  ) : null}
                </View>
                <Text style={[styles.roundNumber, selected && styles.roundNumberSelected]}>
                  {round.roundNumber}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingVertical: MATCH_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: MATCH_SPACING.lg,
  },
  heading: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  roundCount: {
    color: MATCH_COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  content: {
    gap: MATCH_SPACING.xs,
    paddingHorizontal: MATCH_SPACING.lg,
    paddingTop: MATCH_SPACING.md,
  },
  cell: {
    width: CELL_WIDTH,
    minHeight: 86,
    alignItems: "center",
  },
  cellPressed: {
    opacity: 0.7,
  },
  roundBar: {
    width: 40,
    height: 58,
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: MATCH_SPACING.xs,
    borderRadius: MATCH_RADIUS.medium,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roundBarSelected: {
    borderColor: MATCH_COLORS.textPrimary,
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  eventCount: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 9,
    fontWeight: "800",
  },
  roundNumber: {
    marginTop: MATCH_SPACING.xs,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  roundNumberSelected: {
    color: MATCH_COLORS.textPrimary,
  },
  emptyText: {
    margin: MATCH_SPACING.lg,
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
  },
});
