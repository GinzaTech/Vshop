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
import { useTranslation } from "react-i18next";

import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HERO_HEIGHT = 300;
const SHEET_OVERLAP = 32;

const AGENT_ICON_OFFSETS: Record<string, { x: number; y: number }> = {
  "41fb69c1-4189-7b37-f117-bcaf1e96f1bf": { x: 0.17, y: -0.07 },
  "5f8d3a7f-467b-97f3-062c-13acf203c006": { x: 1.22, y: -2.29 },
  "9f0d8ba9-4140-b941-57d3-a7ad57c6b417": { x: 0.27, y: -1.37 },
  "22697a3d-45bf-8dd7-4fec-84a9e28c69d7": { x: 1.58, y: -0.06 },
  "1dbf2edd-4729-0984-3115-daa5eed44993": { x: 0.65, y: -0.19 },
  "117ed9e3-49f3-6512-3ccf-0cada7e3823b": { x: 0.7, y: -1.38 },
  "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235": { x: 0.1, y: -1.36 },
  "dade69b4-4f5a-8528-247b-219e5a1facd6": { x: -0.46, y: -1.58 },
  "e370fa57-4757-3604-3648-499e1f642d3f": { x: 1.14, y: -0.25 },
  "95b78ed7-4637-86d9-7e41-71ba8c293152": { x: 0.66, y: -1.56 },
  "0e38b510-41a8-5780-5e8f-568b2a4f2d6c": { x: 1.18, y: -1.05 },
  "add6443a-41bd-e414-f6ad-e58d267f4e95": { x: 2.79, y: 0.51 },
  "601dbbe7-43ce-be57-2a40-4abd24953621": { x: 0.64, y: -3.02 },
  "1e58de9c-4950-5125-93e9-a0aee9f98746": { x: 1.83, y: -1.68 },
  "7c8a4701-4de6-9355-b254-e09bc2a34b72": { x: 0.1, y: -0.34 },
  "bb2a4828-46eb-8cd1-e765-15848195d751": { x: 1.27, y: 1.28 },
  "8e253930-4c05-31dd-1b6c-968525494517": { x: 1.37, y: -2.41 },
  "eb93336a-449b-9c1b-0a54-a891f7921d69": { x: 1.36, y: -0.72 },
  "f94c3b30-42be-e959-889c-5aa313dba261": { x: 1, y: -2.08 },
  "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc": { x: 0.62, y: -1.94 },
  "569fdd95-4d10-43ab-ca70-79becc718b46": { x: 2.7, y: 0.32 },
  "6f2a04ca-43e0-be17-7f36-b3908627744d": { x: 2.92, y: 0.47 },
  "320b2a48-4d9b-a075-30f1-1f93a9b638fa": { x: 1.87, y: -2.2 },
  "b444168c-4e35-8076-db47-ef9bf368f384": { x: 0.5, y: -1.7 },
  "92eeef5d-43b5-1d4a-8d03-b3927a09034b": { x: 0.61, y: -0.95 },
  "707eab51-4836-f488-046a-cda6bf494859": { x: -0.96, y: -0.16 },
  "efba5359-4016-a1e5-7626-b1ae76895940": { x: 1.29, y: -1.33 },
  "df1cb487-4902-002e-5c17-d28e83e78588": { x: -0.19, y: -1.55 },
  "7f94d92c-4234-0a36-9646-3a87eb8b5c89": { x: 2.49, y: -0.48 },
};

export default function MatchDetailsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const cachedDetails = useMatchStore((state) =>
    typeof id === "string" ? state.detailsById[id] : null
  );
  const fetchMatchDetails = useMatchStore((state) => state.fetchMatchDetails);

  const [details, setDetails] = React.useState<any>(cachedDetails ?? null);
  const [loading, setLoading] = React.useState(!cachedDetails);
  const assets = getAssets();
  const agents = getAgent().agents;
  const titleLookup = React.useMemo(() => {
    const map = new Map<string, string>();
    (assets.titles || []).forEach((item: any) => {
      map.set(item.uuid, item.titleText || item.displayName || "");
    });
    return map;
  }, [assets.titles]);

  React.useEffect(() => {
    const fetchDetails = async () => {
      if (!user.accessToken || !user.entitlementsToken || !user.region || !id) {
        setLoading(false);
        return;
      }

      if (cachedDetails) {
        setDetails(cachedDetails);
        setLoading(false);
        return;
      }

      try {
        const data = await fetchMatchDetails(user, id as string);
        setDetails(data);
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [cachedDetails, fetchMatchDetails, id, user]);

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
        <Text style={styles.errorText}>{t("match_details_page.error_loading")}</Text>
      </View>
    );
  }

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
    const agentIconUri = agent?.displayIcon || agent?.displayIconSmall;
    const agentOffset = AGENT_ICON_OFFSETS[player.characterId] ?? { x: 0, y: 0 };
    const rawTitle = typeof player.playerTitle === "string" ? player.playerTitle : "";
    const resolvedTitle = titleLookup.get(rawTitle);
    const safeMeta =
      resolvedTitle ||
      (rawTitle && !UUID_PATTERN.test(rawTitle) ? rawTitle : "") ||
      agent?.displayName ||
      t("match_details_page.player_fallback");

    return (
      <View key={player.subject} style={[styles.playerRow, isMe && styles.myRow]}>
        <View style={styles.playerLeft}>
          <View style={styles.agentIconShell}>
            <Image
              source={agentIconUri ? { uri: agentIconUri } : undefined}
              style={[
                styles.agentIcon,
                {
                  transform: [
                    { translateX: agentOffset.x },
                    { translateY: agentOffset.y },
                  ],
                },
              ]}
              contentFit="contain"
              contentPosition="center"
            />
          </View>
          <View>
            <Text style={[styles.playerName, isMe && styles.myPlayerName]}>
              {player.gameName}
            </Text>
            <Text style={styles.playerMeta}>
              {safeMeta}
            </Text>
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
            {team?.won
              ? t("history_page.result_victory")
              : t("history_page.result_defeat")}
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
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.body}>
          <View style={styles.bodyContent}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <TouchableOpacity
                style={styles.sheetBackButton}
                onPress={() => router.back()}
              >
                <Icon name="arrow-left" size={20} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>

              <View style={styles.mapHeaderBlock}>
                <Text style={styles.mapTitle}>
                  {mapInfo?.displayName || t("match_details_page.unknown_map")}
                </Text>
                <Text style={styles.mapSubtitle}>
                  {details.matchInfo?.queueID || t("match_details_page.standard")}
                </Text>
              </View>
            </View>

            <View style={styles.scoreboard}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>{t("match_details_page.blue_team")}</Text>
                <Text style={styles.scoreValue}>{blueTeam?.roundsWon ?? 0}</Text>
              </View>
              <Text style={styles.scoreDivider}>{t("match_details_page.vs")}</Text>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>{t("match_details_page.red_team")}</Text>
                <Text style={styles.scoreValue}>{redTeam?.roundsWon ?? 0}</Text>
              </View>
            </View>

            {renderTeamCard(
              t("match_details_page.blue_team_full"),
              blueTeam,
              bluePlayers,
              "#73c9d1"
            )}
            {renderTeamCard(
              t("match_details_page.red_team_full"),
              redTeam,
              redPlayers,
              "#ff8d7a"
            )}
          </View>
        </View>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: HERO_HEIGHT - SHEET_OVERLAP,
    paddingBottom: 40,
  },
  body: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: COLORS.BACKGROUND,
    minHeight: "100%",
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
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sheetBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
    ...GLOBAL_STYLES.shadow,
  },
  mapHeaderBlock: {
    flex: 1,
    alignItems: "flex-start",
  },
  mapTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  mapSubtitle: {
    marginTop: 4,
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
    marginVertical: 2,
  },
  playerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  agentIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(23,26,31,0.08)",
  },
  agentIcon: {
    width: 38,
    height: 38,
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
