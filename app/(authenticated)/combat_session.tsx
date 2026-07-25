import React from "react";
import {
  Alert, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import * as Clipboard from "expo-clipboard";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import { MotiView } from "moti";

import EmptyStateCard from "~/components/ui/EmptyStateCard";
import GlassCard from "~/components/ui/GlassCard";
import InfoPill from "~/components/ui/InfoPill";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";
import { useUserStore } from "~/hooks/useUserStore";
import { useCombatStore } from "~/hooks/useCombatStore";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import { disablePartyInviteCode, generatePartyInviteCode, joinPartyByCode } from "~/utils/valorant-api";
import { formatPartyAccessLabel, formatSessionQueueLabel, getSessionPartyCapacity } from "~/utils/valorant-session";

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
  const snapshot = useCombatStore((state) => state.snapshot);
  const loading = useCombatStore((state) => state.loading);
  const fetchSession = useCombatStore((state) => state.fetchSession);
  const [joinCode, setJoinCode] = React.useState("");
  const [partyCodeLoading, setPartyCodeLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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
  }, [fetchSession, user.accessToken, user.entitlementsToken, user.region, user.id]);

  useFocusEffect(
    React.useCallback(() => { void loadSnapshot(); }, [loadSnapshot])
  );

  // Auto-refresh real-time khi đang live
  React.useEffect(() => {
    if (snapshot.state !== "live") return;
    const interval = setInterval(() => { void loadSnapshot(); }, 10_000);
    return () => clearInterval(interval);
  }, [snapshot.state, loadSnapshot]);

  const handleGenerateCode = React.useCallback(async () => {
    if (!snapshot.partyId) return;
    setPartyCodeLoading(true);
    try {
      await generatePartyInviteCode(user.accessToken, user.entitlementsToken, user.region, snapshot.partyId);
      await fetchSession(user);
    } catch (error) {
      if (__DEV__) console.warn("[combat_session] Failed to generate party code", error);
      Alert.alert("Party code", "Could not generate party invite code.");
    } finally { setPartyCodeLoading(false); }
  }, [fetchSession, snapshot.partyId, user.accessToken, user.entitlementsToken, user.region, user.id]);

  const handleDisableCode = React.useCallback(async () => {
    if (!snapshot.partyId) return;
    setPartyCodeLoading(true);
    try {
      await disablePartyInviteCode(user.accessToken, user.entitlementsToken, user.region, snapshot.partyId);
      await fetchSession(user);
    } catch (error) {
      if (__DEV__) console.warn("[combat_session] Failed to disable party code", error);
      Alert.alert("Party code", "Could not disable party invite code.");
    } finally { setPartyCodeLoading(false); }
  }, [fetchSession, snapshot.partyId, user.accessToken, user.entitlementsToken, user.region, user.id]);

  const handleJoinByCode = React.useCallback(async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) return;
    setPartyCodeLoading(true);
    try {
      const joined = await joinPartyByCode(user.accessToken, user.entitlementsToken, user.region, trimmedCode);
      if (!joined) { Alert.alert("Party code", "Invalid or expired party invite code."); return; }
      setJoinCode("");
      await fetchSession(user);
    } catch (error) {
      if (__DEV__) console.warn("[combat_session] Failed to join party by code", error);
      Alert.alert("Party code", "Could not join party with this code.");
    } finally { setPartyCodeLoading(false); }
  }, [fetchSession, joinCode, user.accessToken, user.entitlementsToken, user.region, user.id]);

  const handleCopyCode = React.useCallback(async () => {
    const code = snapshot.party?.InviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [snapshot.party?.InviteCode]);

  const matchData = snapshot.currentGameMatch;
  const pregameData = snapshot.pregameMatch;
  const activeMapId = matchData?.MapID || pregameData?.MapID;
  const mapInfo = assets.maps?.find((map: any) => map.mapUrl === activeMapId);
  const heroImage = mapInfo?.splash || mapInfo?.listViewIcon;
  const rawQueueLabel = matchData?.ModeID || pregameData?.QueueID || pregameData?.Mode;
  const queueLabel = formatSessionQueueLabel(rawQueueLabel, t);
  const partySize = snapshot.party?.Members?.length || 0;
  const partyCapacity = getSessionPartyCapacity({
    queueId: rawQueueLabel,
    customMode: snapshot.party?.CustomGameData?.Settings?.Mode,
    customPartySize: snapshot.party?.CustomGameData?.MaxPartySize,
  });
  const partyAccessLabel = formatPartyAccessLabel(snapshot.party?.Accessibility, t);
  const timerLabel = snapshot.state === "pregame"
    ? formatNsToClock(pregameData?.PhaseTimeRemainingNS || pregameData?.StepTimeRemainingNS)
    : null;

  const renderPlayerRow = (player: {
    subject: string; agentId?: string; tier?: number; ready?: boolean;
    level?: number; wins?: number; leaderboardRank?: number; titleId?: string;
    hideLevel?: boolean; isCoach?: boolean;
  }) => {
    const subjectLower = player.subject.toLowerCase();
    const agent = agents.find((item) => item.uuid === player.agentId);
    const tierInfo = (player.tier !== undefined && player.tier !== null) ? tierLookup.get(player.tier) : null;
    const resolvedName = snapshot.namesBySubject[subjectLower];
    const displayName = resolvedName || agent?.displayName || `${t("combat_session_page.player_fallback")} ${player.subject.slice(0, 6)}`;
    const titleAsset = player.titleId ? assets.titles?.find((tt: any) => tt.uuid === player.titleId) : null;
    const titleText = titleAsset?.titleText || titleAsset?.displayName;

    return (
      <View key={player.subject} style={styles.playerRow}>
        <View style={styles.playerAvatar}>
          {agent?.displayIcon ? (
            <Image cacheId={`agent:${agent.uuid}:display-icon`} source={{ uri: agent.displayIcon }}
              style={styles.playerAvatarImage} contentFit="contain" cachePolicy="memory-disk" priority="low" recyclingKey={agent.displayIcon} />
          ) : (
            <Icon name="account-outline" size={20} color={COLORS.TEXT_SECONDARY} />
          )}
        </View>
        <View style={styles.playerBody}>
          <View style={styles.playerNameRow}>
            <Text style={styles.playerName} numberOfLines={1}>{displayName}</Text>
            {player.isCoach ? (
              <View style={styles.coachBadge}><Text style={styles.coachText}>COACH</Text></View>
            ) : null}
          </View>
          <Text style={styles.playerMeta} numberOfLines={1}>
            {agent?.displayName || t("combat_session_page.agent_unselected")}
            {titleText ? ` • ${titleText}` : ""}
          </Text>
          {(player.level !== undefined && !player.hideLevel) || player.wins !== undefined ? (
            <View style={styles.playerStatsRow}>
              {player.level !== undefined && !player.hideLevel ? (
                <View style={styles.playerStat}>
                  <Icon name="star-circle-outline" size={11} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.playerStatText}>{player.level}</Text>
                </View>
              ) : null}
              {player.wins !== undefined ? (
                <View style={styles.playerStat}>
                  <Icon name="trophy-outline" size={11} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.playerStatText}>{player.wins}W</Text>
                </View>
              ) : null}
              {player.leaderboardRank ? (
                <View style={styles.playerStat}>
                  <Icon name="crown-outline" size={11} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.playerStatText}>#{player.leaderboardRank}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.playerRight}>
          {tierInfo?.smallIcon || tierInfo?.largeIcon ? (
            <Image cacheId={player.tier !== undefined && player.tier !== null ? `rank:${player.tier}:icon` : undefined}
              source={{ uri: tierInfo.smallIcon || tierInfo.largeIcon }} style={styles.rankIcon}
              contentFit="contain" cachePolicy="memory-disk" priority="low" recyclingKey={tierInfo.smallIcon || tierInfo.largeIcon} />
          ) : null}
          {snapshot.state === "pregame" ? (
            <View style={[styles.readyDot, player.ready ? styles.readyDotOn : styles.readyDotOff]} />
          ) : null}
        </View>
      </View>
    );
  };

  // LIVE: tách 2 team từ currentGameMatch.Players
  const livePlayers = matchData?.Players || [];
  const myPlayer = livePlayers.find((p) => p.Subject === user.id);
  const myTeamId = myPlayer?.TeamID;
  const blueTeam = livePlayers.filter((p) => p.TeamID === "Blue" || (myTeamId && p.TeamID === myTeamId));
  const redTeam = livePlayers.filter((p) => p.TeamID === "Red" || (myTeamId && p.TeamID !== myTeamId && p.TeamID !== "Blue"));

  const renderTeamColumn = (teamPlayers: typeof livePlayers, teamLabel: string, teamColor: string) => (
    <View style={styles.teamColumn}>
      <View style={[styles.teamHeader, { borderColor: teamColor }]}>
        <View style={[styles.teamDot, { backgroundColor: teamColor }]} />
        <Text style={styles.teamHeaderText}>{teamLabel}</Text>
        <Text style={styles.teamCount}>{teamPlayers.length}</Text>
      </View>
      <ScrollView style={styles.teamScroll} contentContainerStyle={styles.teamScrollContent} showsVerticalScrollIndicator={false}>
        {teamPlayers.length === 0 ? (
          <Text style={styles.teamEmpty}>—</Text>
        ) : (
          teamPlayers.map((p) => renderPlayerRow({
            subject: p.Subject,
            agentId: p.CharacterID,
            tier: p.SeasonalBadgeInfo?.Rank,
            level: p.PlayerIdentity?.AccountLevel,
            wins: p.SeasonalBadgeInfo?.NumberOfWins,
            leaderboardRank: p.SeasonalBadgeInfo?.LeaderboardRank,
            titleId: p.PlayerIdentity?.PlayerTitleID,
            hideLevel: p.PlayerIdentity?.HideAccountLevel,
            isCoach: p.IsCoach,
          }))
        )}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSnapshot} />}
    >
      {/* Hero */}
      <View style={styles.heroCard}>
        {heroImage ? (
          <Image cacheId={`map:${mapInfo?.uuid || activeMapId}:hero`} source={{ uri: heroImage }}
            style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" priority="high" recyclingKey={heroImage} />
        ) : null}
        <View style={styles.heroScrim} />
        <View style={styles.heroBody}>
          <Text style={styles.eyebrow}>
            {snapshot.state === "pregame" ? t("combat_session_page.pregame_title")
              : snapshot.state === "live" ? t("combat_session_page.live_title")
                : t("combat_session_page.idle_title")}
          </Text>
          <Text style={styles.heroTitle}>{mapInfo?.displayName || t("combat_session_page.no_match_title")}</Text>
          <Text style={styles.heroSubtitle} numberOfLines={1}>{queueLabel}</Text>
        </View>
      </View>

      {/* Match metrics */}
      {!matchData && !pregameData ? null : (
        <View style={styles.metricRow}>
          <InfoPill style={styles.metricPill}>
            <Icon name="map-outline" size={14} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.metricText} numberOfLines={1}>{mapInfo?.displayName || t("combat_session_page.no_map")}</Text>
          </InfoPill>
          <InfoPill style={styles.metricPillCompact}>
            <Icon name="account-group-outline" size={14} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.metricText}>{partySize}/{partyCapacity}</Text>
          </InfoPill>
          {timerLabel ? (
            <InfoPill style={styles.metricPill}>
              <Icon name="timer-outline" size={14} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.metricText}>{timerLabel}</Text>
            </InfoPill>
          ) : null}
          {matchData?.IsReconnectable ? (
            <InfoPill style={styles.metricPill}>
              <Icon name="refresh" size={14} color={COLORS.SUCCESS} />
              <Text style={styles.metricText}>Reconnect</Text>
            </InfoPill>
          ) : null}
        </View>
      )}

      {/* Party code card */}
      <GlassCard style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Party invite code</Text>
          {snapshot.partyId ? (
            <TouchableOpacity activeOpacity={0.75} style={styles.inlineAction} disabled={partyCodeLoading} onPress={handleGenerateCode}>
              <Text style={styles.inlineActionText}>{snapshot.party?.InviteCode ? "Refresh" : "Generate"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {snapshot.partyId ? (
          <View style={styles.inviteCodeRow}>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText} numberOfLines={1}>{snapshot.party?.InviteCode || "No active code"}</Text>
            </View>
            {snapshot.party?.InviteCode ? (
              <>
                <View style={styles.copyButtonWrap}>
                  <TouchableOpacity activeOpacity={0.75} style={styles.iconAction} onPress={handleCopyCode}>
                    <Icon name="content-copy" size={18} color={COLORS.TEXT_PRIMARY} />
                  </TouchableOpacity>
                  {copied ? (
                    <MotiView
                      from={{ opacity: 0, scale: 0.8, translateY: 10 }}
                      animate={{ opacity: 1, scale: 1, translateY: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", damping: 15 }}
                      style={styles.copiedBadge}
                    >
                      <Icon name="check-circle-outline" size={14} color={COLORS.SUCCESS} />
                      <Text style={styles.copiedText}>Copied!</Text>
                    </MotiView>
                  ) : null}
                </View>
                <TouchableOpacity activeOpacity={0.75} style={styles.iconAction} disabled={partyCodeLoading} onPress={handleDisableCode}>
                  <Icon name="link-off" size={18} color={COLORS.WARNING} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}
        <View style={styles.joinCodeRow}>
          <TextInput value={joinCode} onChangeText={setJoinCode} placeholder="Enter invite code"
            placeholderTextColor={COLORS.TEXT_SECONDARY} autoCapitalize="characters" autoCorrect={false}
            style={styles.joinCodeInput} returnKeyType="join" onSubmitEditing={handleJoinByCode} />
          <TouchableOpacity activeOpacity={0.75}
            style={[styles.joinCodeButton, (!joinCode.trim() || partyCodeLoading) ? styles.joinCodeButtonDisabled : null]}
            disabled={!joinCode.trim() || partyCodeLoading} onPress={handleJoinByCode}>
            <Text style={styles.joinCodeButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {/* Session info */}
      <GlassCard style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("combat_session_page.session_state")}</Text>
          <Text style={styles.infoValue}>{snapshot.state === "pregame" ? t("combat_session_page.session_pregame") : t("combat_session_page.session_live")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("combat_session_page.party_access")}</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{partyAccessLabel}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t("combat_session_page.party_queue")}</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{queueLabel}</Text>
        </View>
        {matchData?.ProvisioningFlow ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{matchData.ProvisioningFlow}</Text>
          </View>
        ) : null}
      </GlassCard>

      {/* LIVE: Full match board — 2 teams side by side */}
      {snapshot.state === "live" && matchData ? (
        <View style={styles.matchBoard}>
          {renderTeamColumn(blueTeam, "BLUE / ATTACKERS", COLORS.VALORANT_RED || "#ff4655")}
          <View style={styles.boardDivider} />
          {renderTeamColumn(redTeam, "RED / DEFENDERS", "#30a46c")}
        </View>
      ) : null}

      {/* PREGAME: Ally roster */}
      {snapshot.state === "pregame" ? (
        <>
          {/* Pregame enemy team */}
          {(pregameData?.EnemyTeam?.Players || []).length > 0 ? (
            <GlassCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t("combat_session_page.enemy_team")}</Text>
              </View>
              {(pregameData?.EnemyTeam?.Players || []).map((player: any) => renderPlayerRow({
                subject: player.Subject,
                agentId: player.CharacterID,
                tier: player.CompetitiveTier,
                ready: player.CharacterSelectionState === "locked",
              }))}
            </GlassCard>
          ) : null}

          {/* Party members */}
          {snapshot.party?.Members?.length ? (
            <GlassCard style={styles.card}>
              <Text style={styles.sectionTitle}>{t("combat_session_page.party_members")}</Text>
              {snapshot.party.Members.map((member) => {
                const alliedContext = (pregameData?.AllyTeam?.Players || []).find((p: any) => p.Subject === member.Subject);
                return renderPlayerRow({
                  subject: member.Subject,
                  tier: member.CompetitiveTier,
                  ready: member.IsReady,
                  agentId: alliedContext?.CharacterID,
                });
              })}
            </GlassCard>
          ) : null}
        </>
      ) : null}

      {/* Idle empty state */}
      {snapshot.state === "idle" ? (
        <EmptyStateCard title={t("combat_session_page.empty_title")} subtitle={t("combat_session_page.empty_subtitle")}
          icon={<Icon name="sword-cross" size={30} color={COLORS.TEXT_PRIMARY} />} style={styles.emptyCard} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: { position: "relative", minHeight: 160, borderRadius: 24, overflow: "hidden", backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER, ...GLOBAL_STYLES.shadow },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(23, 26, 31, 0.35)" },
  heroBody: { padding: 16, justifyContent: "flex-end", minHeight: 160 },
  eyebrow: { color: "rgba(252, 253, 255, 0.82)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { marginTop: 6, color: COLORS.PURE_WHITE, fontSize: 26, fontWeight: "800" },
  heroSubtitle: { marginTop: 4, color: "rgba(252, 253, 255, 0.86)", fontSize: 13 },
  emptyCard: { marginTop: 18 },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  metricPill: { minHeight: 42, paddingHorizontal: 12 },
  metricPillCompact: { minHeight: 42, paddingHorizontal: 10 },
  metricText: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: "700" },
  card: { marginTop: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 7 },
  infoLabel: { flex: 1, color: COLORS.TEXT_SECONDARY, fontSize: 13 },
  infoValue: { maxWidth: "54%", textAlign: "right", color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 },
  sectionTitle: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: "700" },
  inlineAction: { minHeight: 34, borderRadius: RADIUS.chip, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  inlineActionText: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: "700" },
  inviteCodeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  inviteCodeBox: { flex: 1, minHeight: 40, borderRadius: RADIUS.chip, paddingHorizontal: 12, justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  inviteCodeText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
  iconAction: { width: 40, height: 40, borderRadius: RADIUS.chip, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  copyButtonWrap: { position: "relative", justifyContent: "center" },
  copiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(48, 164, 108, 0.15)", position: "absolute", top: -22, right: 0, zIndex: 10 },
  copiedText: { color: COLORS.SUCCESS, fontSize: 11, fontWeight: "700" },
  joinCodeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  joinCodeInput: { flex: 1, minHeight: 42, borderRadius: RADIUS.chip, paddingHorizontal: 12, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 13, fontWeight: "700" },
  joinCodeButton: { minHeight: 42, minWidth: 72, borderRadius: RADIUS.chip, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ACCENT },
  joinCodeButtonDisabled: { opacity: 0.45 },
  joinCodeButtonText: { color: COLORS.PURE_WHITE, fontSize: 13, fontWeight: "800" },

  // ===== LIVE Match Board =====
  matchBoard: { flexDirection: "row", marginTop: 14, minHeight: 340, maxHeight: 480 },
  boardDivider: { width: 1, backgroundColor: COLORS.BORDER, marginHorizontal: 6 },
  teamColumn: { flex: 1, borderRadius: 16, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER, overflow: "hidden" },
  teamHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2 },
  teamDot: { width: 8, height: 8, borderRadius: 999 },
  teamHeaderText: { flex: 1, color: COLORS.TEXT_PRIMARY, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  teamCount: { color: COLORS.TEXT_SECONDARY, fontSize: 13, fontWeight: "700" },
  teamScroll: { flex: 1 },
  teamScrollContent: { padding: 8 },
  teamEmpty: { textAlign: "center", color: COLORS.TEXT_SECONDARY, fontSize: 24, padding: 20 },

  // ===== Player Row (rich) =====
  playerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 6, minWidth: 0 },
  playerAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.SURFACE_MUTED, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  playerAvatarImage: { width: 32, height: 32 },
  playerBody: { flex: 1, minWidth: 0 },
  playerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  playerName: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  coachBadge: { backgroundColor: COLORS.WARNING, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  coachText: { color: "#000", fontSize: 8, fontWeight: "900" },
  playerMeta: { marginTop: 2, color: COLORS.TEXT_SECONDARY, fontSize: 11, flexShrink: 1 },
  playerStatsRow: { flexDirection: "row", gap: 10, marginTop: 3 },
  playerStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  playerStatText: { color: COLORS.TEXT_SECONDARY, fontSize: 10, fontWeight: "600" },
  playerRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 4 },
  rankIcon: { width: 22, height: 22 },
  readyDot: { width: 9, height: 9, borderRadius: 999 },
  readyDotOn: { backgroundColor: COLORS.SUCCESS },
  readyDotOff: { backgroundColor: COLORS.WARNING },
});
