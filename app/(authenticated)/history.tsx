import React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

export default function MatchHistory() {
  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const { matches, loading, fetchMatches } = useMatchStore();
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (matches.length === 0) {
      fetchMatches(user);
    }
  }, [fetchMatches, matches.length, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches(user);
    setRefreshing(false);
  };

  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>Loading recent matches...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={matches}
      keyExtractor={(item) => item.MatchID}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.ACCENT}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Recent matches</Text>
          <Text style={styles.subtitle}>
            Review your last games, scorelines, and the agent you played.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Icon name="history" size={34} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            Pull to refresh once your match history is available.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (!item.stats) {
          return (
            <GlassCard style={styles.card}>
              <View style={styles.pendingRow}>
                <View style={styles.pendingIcon}>
                  <Text style={styles.pendingIconText}>?</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Processing match</Text>
                  <Text style={styles.cardMeta}>
                    {new Date(item.GameStartTime).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </GlassCard>
          );
        }

        const resultColor = item.stats.won ? COLORS.SUCCESS : COLORS.ACCENT;

        return (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push(`/match_details/${item.MatchID}`)}
          >
            <GlassCard style={styles.card}>
              <Image
                source={{ uri: item.stats.mapImage }}
                style={styles.mapImage}
                contentFit="cover"
              />
              <View style={styles.cardOverlay} />
              <View style={styles.cardContent}>
                <View style={styles.leftColumn}>
                  <Image
                    source={{ uri: item.stats.agentIcon }}
                    style={styles.agentIcon}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.stats.mapName}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {new Date(item.GameStartTime).toLocaleDateString()}
                    </Text>
                    <Text style={styles.cardMode}>{item.stats.gameMode}</Text>
                  </View>
                </View>

                <View style={styles.rightColumn}>
                  <View
                    style={[styles.resultPill, { backgroundColor: resultColor }]}
                  >
                    <Text style={styles.resultPillText}>
                      {item.stats.won ? "Victory" : "Defeat"}
                    </Text>
                  </View>
                  <Text style={styles.scoreText}>
                    {item.stats.roundsWon} - {item.stats.roundsLost}
                  </Text>
                  <Text style={styles.kdaText}>
                    {item.stats.kills}/{item.stats.deaths}/{item.stats.assists}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.TEXT_SECONDARY,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
  card: {
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  leftColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rightColumn: {
    alignItems: "flex-end",
  },
  agentIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.chip,
  },
  cardTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  cardMode: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    textTransform: "uppercase",
  },
  resultPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    marginBottom: 10,
  },
  resultPillText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
  scoreText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  kdaText: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pendingIcon: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  pendingIconText: {
    fontWeight: "700",
    fontSize: 18,
    color: COLORS.TEXT_SECONDARY,
  },
});
