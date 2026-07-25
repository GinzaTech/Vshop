import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { DailyMatchSummary } from "~/types/match-ui";
import { formatMetric } from "~/utils/match-ui";

type DailyMatchSummaryCardProps = {
  summary: DailyMatchSummary;
};

const DIVIDER_COLOR = "#343A44";

function DailyMatchSummaryCardComponent({
  summary,
}: DailyMatchSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      {/* Date + count badge */}
      <Text style={styles.date} numberOfLines={1}>
        {summary.dateLabel}
      </Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{summary.matchCount}</Text>
      </View>
      {/* Inline metrics — compact */}
      <View style={styles.metrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>K/D</Text>
          <Text style={styles.metricValue}>{formatMetric(summary.averageKD, 2)}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ADR</Text>
          <Text style={styles.metricValue}>{formatMetric(summary.averageADR)}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>ACS</Text>
          <Text style={styles.metricValue}>{formatMetric(summary.averageACS)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIVIDER_COLOR,
    backgroundColor: "#20242C",
    marginBottom: 10,
    gap: 10,
  },
  date: {
    flexShrink: 1,
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "#252A31",
  },
  countText: {
    color: "#C7CCD4",
    fontSize: 11,
    fontWeight: "600",
  },
  metrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  metricLabel: {
    color: "#858B96",
    fontSize: 10,
    fontWeight: "600",
  },
  metricValue: {
    color: "#F5F7FA",
    fontSize: 13,
    fontWeight: "700",
  },
  sep: {
    width: 1,
    height: 16,
    backgroundColor: DIVIDER_COLOR,
  },
});

export const DailyMatchSummaryCard = React.memo(
  DailyMatchSummaryCardComponent
);
