import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useUserStore } from "~/hooks/useUserStore";
import { matchDetails } from "~/utils/valorant-api";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useUserStore((state) => state.user);

  const [details, setDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchDetails = async () => {
      if (!user.accessToken || !user.entitlementsToken || !user.region || !id) {
        setLoading(false);
        return;
      }

      try {
        const data = await matchDetails(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          id as string
        );
        setDetails(data);
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id, user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load match details.</Text>
      </View>
    );
  }

  const assets = getAssets();
  const agents = getAgent().agents;
  const mapInfo = assets.maps?.find(
    (item: any) => item.mapUrl === details.matchInfo?.mapId
  );
  const teams = details.teams || [];
  const blueTeam = teams.find((team: any) => team.teamId === "Blue");
  const redTeam = teams.find((team: any) => team.teamId === "Red");
  const players = details.players || [];
  const bluePlayers = players.filter((player: any) => player.teamId === "Blue");
  const redPlayers = players.filter((player: any) => player.teamId === "Red");

  const renderPlayerRow = (player: any) => {
    const agent = agents.find((item: any) => item.uuid === player.characterId);
    const isMe = player.subject === user.id;

    return (
      <View key={player.subject} style={[styles.playerRow, isMe && styles.myRow]}>
        <View style={styles.playerLeft}>
          <Image source={{ uri: agent?.displayIcon }} style={styles.agentIcon} />
          <View>
            <Text style={[styles.playerName, isMe && styles.myPlayerName]}>
              {player.gameName}
            </Text>
            <Text style={styles.playerMeta}>{player.playerTitle || "Player"}</Text>
          </View>
        </View>
        <View style={styles.playerRight}>
          <Text style={styles.kdaText}>
            {player.stats?.kills}/{player.stats?.deaths}/{player.stats?.assists}
          </Text>
          <Text style={styles.scoreText}>{player.stats?.score}</Text>
        </View>
      </View>
    );
  };

  const renderTeamCard = (title: string, team: any, rows: any[], tone: string) => (
    <GlassCard style={styles.teamCard}>
      <View style={styles.teamHeader}>
        <View>
          <Text style={styles.teamTitle}>{title}</Text>
          <Text style={styles.teamSubtitle}>
            {team?.won ? "Victory" : "Defeat"}
          </Text>
        </View>
        <View style={[styles.teamScorePill, { backgroundColor: tone }]}>
          <Text style={styles.teamScorePillText}>
            {team?.roundsWon ?? 0} / {team?.roundsPlayed ?? 0}
          </Text>
        </View>
      </View>
      {rows.map(renderPlayerRow)}
    </GlassCard>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Image
          source={{ uri: mapInfo?.splash }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        <View style={styles.heroOverlay} />
        <View style={styles.heroHeader}>
          <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleButton}>
            <Icon name="heart-outline" size={20} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.mapTitle}>{mapInfo?.displayName || "Unknown Map"}</Text>
        <Text style={styles.mapSubtitle}>
          {details.matchInfo?.queueID || "Standard"}
        </Text>

        <View style={styles.scoreboard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Blue</Text>
            <Text style={styles.scoreValue}>{blueTeam?.roundsWon ?? 0}</Text>
          </View>
          <Text style={styles.scoreDivider}>VS</Text>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Red</Text>
            <Text style={styles.scoreValue}>{redTeam?.roundsWon ?? 0}</Text>
          </View>
        </View>

        {renderTeamCard("Blue Team", blueTeam, bluePlayers, "#73c9d1")}
        {renderTeamCard("Red Team", redTeam, redPlayers, "#ff8d7a")}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  errorText: {
    color: COLORS.TEXT_SECONDARY,
  },
  hero: {
    height: 300,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  heroHeader: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: COLORS.BACKGROUND,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.BORDER,
    marginBottom: 18,
  },
  mapTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  mapSubtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
  scoreboard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
  },
  scoreLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  scoreValue: {
    marginTop: 6,
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  scoreDivider: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "700",
    paddingHorizontal: 12,
  },
  teamCard: {
    marginBottom: 16,
  },
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  teamSubtitle: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
  },
  teamScorePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
  },
  teamScorePillText: {
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  myRow: {
    backgroundColor: "rgba(255,255,255,0.32)",
    borderRadius: 18,
    paddingHorizontal: 10,
    marginVertical: 2,
  },
  playerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  agentIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.chip,
  },
  playerName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  myPlayerName: {
    color: COLORS.ACCENT,
  },
  playerMeta: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  playerRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  kdaText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  scoreText: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
});
