import React from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";

import EmptyStateCard from "~/components/ui/EmptyStateCard";
import GlassCard from "~/components/ui/GlassCard";
import InfoPill from "~/components/ui/InfoPill";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";
import { useUserStore } from "~/hooks/useUserStore";
import { useCombatStore } from "~/hooks/useCombatStore";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import {
  disablePartyInviteCode,
  generatePartyInviteCode,
  joinPartyByCode,
} from "~/utils/valorant-api";
import {
  formatPartyAccessLabel,
  formatSessionQueueLabel,
  getSessionPartyCapacity,
} from "~/utils/valorant-session";

const formatNsToClock = (value?: number) => {
  if (!value || value <= 0) return "--:--";
  const totalSeconds = Math.ceil(value / 1_000_000_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function CombatSessionScreen() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const assets = getAssets();
  const agents = getAgent().agents;
  const { snapshot, loading, fetchSession } = useCombatStore();
  const [joinCode, setJoinCode] = React.useState("");
  const [partyCodeLoading, setPartyCodeLoading] = React.useState(false);

  const tierLookup = React.useMemo(() => {
    const map = new Map<number, any>();
    (assets.competitiveTiers || []).forEach((season: any) => {
      (season?.tiers || []).forEach((tier: any) => {
        const tierNumber = Number(tier?.tier);
        if (Number.isFinite(tierNumber) && tierNumber > 0 && !map.has(tierNumber)) {
          map.set(tierNumber, tier);
        }
      });
    });
    return map;
  }, [assets.competitiveTiers]);

  const loadSnapshot = React.useCallback(async () => {
    await fetchSession(user);
  }, [fetchSession, user]);

  useFocusEffect(
    React.useCallback(() => {
      void loadSnapshot();
    }, [loadSnapshot])
  );

  const handleGenerateCode = React.useCallback(async () => {
    if (!snapshot.partyId) {
      return;
    }

    setPartyCodeLoading(true);
    try {
      await generatePartyInviteCode(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        snapshot.partyId
      );
      await fetchSession(user);
    } catch (error) {
      console.warn("[combat_session] Failed to generate party code", error);
      Alert.alert("Party code", "Could not generate party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [fetchSession, snapshot.partyId, user]);

  const handleDisableCode = React.useCallback(async () => {
    if (!snapshot.partyId) {
      return;
    }

    setPartyCodeLoading(true);
    try {
      await disablePartyInviteCode(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        snapshot.partyId
      );
      await fetchSession(user);
    } catch (error) {
      console.warn("[combat_session] Failed to disable party code", error);
      Alert.alert("Party code", "Could not disable party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [fetchSession, snapshot.partyId, user]);

  const handleJoinByCode = React.useCallback(async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) {
      return;
    }

    setPartyCodeLoading(true);
    try {
      const joined = await joinPartyByCode(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        trimmedCode
      );

      if (!joined) {
        Alert.alert("Party code", "Invalid or expired party invite code.");
        return;
      }

      setJoinCode("");
      await fetchSession(user);
    } catch (error) {
      console.warn("[combat_session] Failed to join party by code", error);
      Alert.alert("Party code", "Could not join party with this code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [fetchSession, joinCode, user]);

  const handleCopyCode = React.useCallback(async () => {
    const code = snapshot.party?.InviteCode;
    if (!code) {
      return;
    }

    await Clipboard.setStringAsync(code);
  }, [snapshot.party?.InviteCode]);

  const activeMapId = snapshot.pregameMatch?.MapID || snapshot.currentGameMatch?.MapID;
  const mapInfo = assets.maps?.find((map: any) => map.mapUrl === activeMapId);
  const heroImage = mapInfo?.splash || mapInfo?.listViewIcon;
  const rawQueueLabel =
    snapshot.pregameMatch?.QueueID ||
    snapshot.currentGameMatch?.MatchmakingData?.QueueID ||
    snapshot.pregameMatch?.Mode ||
    snapshot.currentGameMatch?.ModeID;
  const queueLabel = formatSessionQueueLabel(rawQueueLabel, t);
  const partySize = snapshot.party?.Members?.length || 0;
  const partyCapacity = getSessionPartyCapacity({
    queueId: rawQueueLabel,
    customMode: snapshot.party?.CustomGameData?.Settings?.Mode,
    customPartySize: snapshot.party?.CustomGameData?.MaxPartySize,
  });
  const partyAccessLabel = formatPartyAccessLabel(snapshot.party?.Accessibility, t);
  const timerLabel =
    snapshot.state === "pregame"
      ? formatNsToClock(
          snapshot.pregameMatch?.PhaseTimeRemainingNS ||
            snapshot.pregameMatch?.StepTimeRemainingNS
        )
      : null;

  const allyRoster = React.useMemo(() => {
    if (snapshot.state === "pregame") {
      return (snapshot.pregameMatch?.AllyTeam?.Players || []).map((player: any) => ({
        subject: player.Subject,
        teamId: "Blue",
        agentId: player.CharacterID,
        tier: player.CompetitiveTier,
        ready: player.CharacterSelectionState === "locked",
      }));
    }

    if (snapshot.state === "live") {
      const myPlayer = snapshot.currentGameMatch?.Players?.find(
        (player) => player.Subject === user.id
      );
      const myTeamId = myPlayer?.TeamID;

      return (snapshot.currentGameMatch?.Players || [])
        .filter((player) => !myTeamId || player.TeamID === myTeamId)
        .map((player) => ({
          subject: player.Subject,
          teamId: player.TeamID,
          agentId: player.CharacterID,
          tier: player.SeasonalBadgeInfo?.Rank,
          ready: true,
        }));
    }

    return [];
  }, [snapshot, user.id]);

  const enemyRoster = React.useMemo(() => {
    if (snapshot.state === "live") {
      const myPlayer = snapshot.currentGameMatch?.Players?.find(
        (player) => player.Subject === user.id
      );
      const myTeamId = myPlayer?.TeamID;

      if (!myTeamId) return [];

      return (snapshot.currentGameMatch?.Players || [])
        .filter((player) => player.TeamID !== myTeamId && player.TeamID !== "")
        .map((player) => ({
          subject: player.Subject,
          teamId: player.TeamID,
          agentId: player.CharacterID,
          tier: player.SeasonalBadgeInfo?.Rank,
          ready: true,
        }));
    }

    return [];
  }, [snapshot, user.id]);

  const renderPlayerRow = (player: {
    subject: string;
    agentId?: string;
    tier?: number;
    ready?: boolean;
  }) => {
    const subjectLower = player.subject.toLowerCase();
    const agent = agents.find((item) => item.uuid === player.agentId);
    const tierInfo = (player.tier !== undefined && player.tier !== null) ? tierLookup.get(player.tier) : null;

    // Use name from store if available, or fallback to Agent Name, then generic Player fallback
    const resolvedName = snapshot.namesBySubject[subjectLower];
    const displayName =
      resolvedName ||
      agent?.displayName ||
      `${t("combat_session_page.player_fallback")} ${player.subject.slice(0, 6)}`;

    return (
      <View key={player.subject} style={styles.playerRow}>
        <View style={styles.playerLeft}>
          <View style={styles.playerAvatar}>
            {agent?.displayIcon ? (
              <Image
                source={{ uri: agent.displayIcon }}
                style={styles.playerAvatarImage}
                contentFit="contain"
              />
            ) : (
              <Icon name="account-outline" size={20} color={COLORS.TEXT_SECONDARY} />
            )}
          </View>
          <View style={styles.playerBody}>
            <Text style={styles.playerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.playerMeta} numberOfLines={1}>
              {agent?.displayName || t("combat_session_page.agent_unselected")}
            </Text>
          </View>
        </View>

        <View style={styles.playerRight}>
          {tierInfo?.smallIcon || tierInfo?.largeIcon ? (
            <Image
              source={{ uri: tierInfo.smallIcon || tierInfo.largeIcon }}
              style={styles.rankIcon}
              contentFit="contain"
            />
          ) : null}
          {snapshot.state === "pregame" ? (
            <View
              style={[
                styles.readyDot,
                player.ready ? styles.readyDotOn : styles.readyDotOff,
              ]}
            />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadSnapshot} />
      }
    >
      <View style={styles.heroCard}>
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={styles.heroImage}
            contentFit="cover"
          />
        ) : null}
        <View style={styles.heroScrim} />
        <View style={styles.heroBody}>
          <Text style={styles.eyebrow}>
            {snapshot.state === "pregame"
              ? t("combat_session_page.pregame_title")
              : snapshot.state === "live"
                ? t("combat_session_page.live_title")
                : t("combat_session_page.idle_title")}
          </Text>
          <Text style={styles.heroTitle}>
            {mapInfo?.displayName || t("combat_session_page.no_match_title")}
          </Text>
          <Text style={styles.heroSubtitle} numberOfLines={1}>
            {queueLabel}
          </Text>
        </View>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Party invite code</Text>
          {snapshot.partyId ? (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.inlineAction}
              disabled={partyCodeLoading}
              onPress={handleGenerateCode}
            >
              <Text style={styles.inlineActionText}>
                {snapshot.party?.InviteCode ? "Refresh" : "Generate"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {snapshot.partyId ? (
          <View style={styles.inviteCodeRow}>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText} numberOfLines={1}>
                {snapshot.party?.InviteCode || "No active code"}
              </Text>
            </View>
            {snapshot.party?.InviteCode ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.iconAction}
                  onPress={handleCopyCode}
                >
                  <Icon name="content-copy" size={18} color={COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.iconAction}
                  disabled={partyCodeLoading}
                  onPress={handleDisableCode}
                >
                  <Icon name="link-off" size={18} color={COLORS.WARNING} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.joinCodeRow}>
          <TextInput
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Enter invite code"
            placeholderTextColor={COLORS.TEXT_SECONDARY}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.joinCodeInput}
            returnKeyType="join"
            onSubmitEditing={handleJoinByCode}
          />
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.joinCodeButton,
              !joinCode.trim() || partyCodeLoading
                ? styles.joinCodeButtonDisabled
                : null,
            ]}
            disabled={!joinCode.trim() || partyCodeLoading}
            onPress={handleJoinByCode}
          >
            <Text style={styles.joinCodeButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {snapshot.state === "idle" ? (
        <EmptyStateCard
          title={t("combat_session_page.empty_title")}
          subtitle={t("combat_session_page.empty_subtitle")}
          icon={<Icon name="sword-cross" size={30} color={COLORS.TEXT_PRIMARY} />}
          style={styles.emptyCard}
        />
      ) : (
        <>
          <View style={styles.metricRow}>
            <InfoPill style={styles.metricPill}>
              <Icon name="map-outline" size={16} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.metricText}>
                {mapInfo?.displayName || t("combat_session_page.no_map")}
              </Text>
            </InfoPill>
            <InfoPill style={styles.metricPill}>
              <Icon name="account-group-outline" size={16} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.metricText}>
                {partySize}/{partyCapacity}
              </Text>
            </InfoPill>
            {timerLabel ? (
              <InfoPill style={styles.metricPill}>
                <Icon name="timer-outline" size={16} color={COLORS.TEXT_PRIMARY} />
                <Text style={styles.metricText}>{timerLabel}</Text>
              </InfoPill>
            ) : null}
          </View>

          <GlassCard style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("combat_session_page.session_state")}</Text>
              <Text style={styles.infoValue}>
                {snapshot.state === "pregame"
                  ? t("combat_session_page.session_pregame")
                  : t("combat_session_page.session_live")}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("combat_session_page.party_access")}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {partyAccessLabel}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t("combat_session_page.party_queue")}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {queueLabel}
              </Text>
            </View>
          </GlassCard>



          {enemyRoster.length > 0 ? (
            <GlassCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("combat_session_page.enemy_team")}
                </Text>
              </View>
              {enemyRoster.map(renderPlayerRow)}
            </GlassCard>
          ) : null}

          {snapshot.party?.Members?.length ? (
            <GlassCard style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t("combat_session_page.party_members")}
              </Text>
              {snapshot.party.Members.map((member) => {
                const alliedContext = allyRoster.find(
                  (p: { subject: string; agentId?: string }) => p.subject === member.Subject
                );
                return renderPlayerRow({
                  subject: member.Subject,
                  tier: member.CompetitiveTier,
                  ready: member.IsReady,
                  agentId: alliedContext?.agentId,
                });
              })}
            </GlassCard>
          ) : null}
        </>
      )}
    </ScrollView>
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
  heroCard: {
    position: "relative",
    minHeight: 196,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...GLOBAL_STYLES.shadow,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(23, 26, 31, 0.28)",
  },
  heroBody: {
    padding: 20,
    justifyContent: "flex-end",
    minHeight: 196,
  },
  eyebrow: {
    color: "rgba(252, 253, 255, 0.82)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    marginTop: 8,
    color: COLORS.PURE_WHITE,
    fontSize: 30,
    fontWeight: "800",
  },
  heroSubtitle: {
    marginTop: 6,
    color: "rgba(252, 253, 255, 0.86)",
    fontSize: 14,
  },
  emptyCard: {
    marginTop: 18,
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricPill: {
    flex: 1,
    minHeight: 48,
  },
  metricText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    marginTop: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
  },
  infoLabel: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  infoValue: {
    maxWidth: "54%",
    textAlign: "right",
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  collapseIcon: {
    marginTop: 2,
  },
  inlineAction: {
    minHeight: 36,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  inlineActionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  inviteCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  inviteCodeBox: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  inviteCodeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  joinCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  joinCodeInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 12,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    fontSize: 13,
    fontWeight: "700",
  },
  joinCodeButton: {
    minHeight: 44,
    minWidth: 78,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT,
  },
  joinCodeButtonDisabled: {
    opacity: 0.45,
  },
  joinCodeButtonText: {
    color: COLORS.PURE_WHITE,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyInlineText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    minWidth: 0,
  },
  playerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  playerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playerAvatarImage: {
    width: 30,
    height: 30,
  },
  playerBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  playerName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  playerMeta: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    flexShrink: 1,
  },
  playerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    marginLeft: 8,
  },
  rankIcon: {
    width: 24,
    height: 24,
  },
  readyDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  readyDotOn: {
    backgroundColor: COLORS.SUCCESS,
  },
  readyDotOff: {
    backgroundColor: COLORS.WARNING,
  },
});
