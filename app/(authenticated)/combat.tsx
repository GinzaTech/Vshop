import React, { useCallback } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { AgentGrid } from "~/components/GalleryAgent";
import useCombat from "~/components/Combat";
import GlassCard from "~/components/ui/GlassCard";
import InfoPill from "~/components/ui/InfoPill";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS } from "~/constants/DesignSystem";
import { getAssets } from "~/utils/valorant-assets";
import {
  formatSessionQueueLabel,
  getSessionPartyCapacity,
} from "~/utils/valorant-session";
import {
  disablePartyInviteCode,
  generatePartyInviteCode,
  joinPartyByCode,
} from "~/utils/valorant-api";
import {
  joinPartyXmppChat,
  sendPartyXmppMessage,
} from "~/utils/chat-service";
import { useChatStore, type ChatFriend, type ChatMessage } from "~/utils/chat-store";
import { useUserStore } from "~/hooks/useUserStore";

const ROLES = [
  {
    id: "Duelist",
    name: "Duelist",
    icon: require("../../assets/images/Duelist.png"),
  },
  {
    id: "Controller",
    name: "Controller",
    icon: require("../../assets/images/Controller.png"),
  },
  {
    id: "Initiator",
    name: "Initiator",
    icon: require("../../assets/images/Initiator.png"),
  },
  {
    id: "Sentinel",
    name: "Sentinel",
    icon: require("../../assets/images/Sentinel.png"),
  },
];

const COMBAT_PANELS = ["agents", "party-chat"] as const;

const getChatSenderName = (
  senderId: string,
  friends: Record<string, ChatFriend>,
  currentUser: { id: string; name: string; TagLine: string }
) => {
  if (senderId === "me" || senderId === currentUser.id) {
    return currentUser.TagLine
      ? `${currentUser.name}#${currentUser.TagLine}`
      : currentUser.name || "Me";
  }

  const friend = friends[senderId];
  if (friend) {
    return friend.tagLine ? `${friend.gameName}#${friend.tagLine}` : friend.gameName;
  }

  return senderId.length > 12 ? senderId.slice(0, 8) : senderId || "Party";
};

const sortChatMessagesByTime = (messages: ChatMessage[]) =>
  [...messages].sort((a, b) => a.timestamp - b.timestamp);

function PartyChatPanel({
  partyId,
  roomName,
  partyMemberCount,
  accessToken,
  entitlementsToken,
  region,
  currentUser,
}: {
  partyId?: string | null;
  roomName?: string | null;
  partyMemberCount: number;
  accessToken: string;
  entitlementsToken: string;
  region: string;
  currentUser: { id: string; name: string; TagLine: string };
}) {
  const { t } = useTranslation();
  const partyRoom = useChatStore((state) => state.partyChatRoom);
  const presencePartyId = useChatStore((state) => state.currentPartyId);
  const friends = useChatStore((state) => state.friends);
  const messages = useChatStore((state) =>
    partyRoom ? state.partyMessages[partyRoom] || [] : []
  );
  const [chatInput, setChatInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sortedMessages = React.useMemo(
    () => sortChatMessagesByTime(messages),
    [messages]
  );

  const loadPartyChat = React.useCallback(async () => {
    if (!partyId) {
      useChatStore.getState().setPartyChatRoom(null);
      setError(null);
      return;
    }
    if (partyMemberCount <= 1) {
      useChatStore.getState().setPartyChatRoom(null);
      setError(t("combat_page.party_chat_solo_unavailable"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinPartyXmppChat({
        accessToken,
        entitlementsToken,
        region,
        partyId,
        userId: currentUser.id,
        roomName,
      });
    } catch (chatError) {
      if (
        presencePartyId &&
        presencePartyId !== partyId &&
        chatError instanceof Error &&
        chatError.message.includes("party chat token")
      ) {
        try {
          await joinPartyXmppChat({
            accessToken,
            entitlementsToken,
            region,
            partyId: presencePartyId,
            userId: currentUser.id,
            roomName,
          });
          return;
        } catch (fallbackError) {
          console.log("[combat] Failed to join XMPP party chat with presence party", fallbackError);
        }
      }
      console.log("[combat] Failed to join XMPP party chat", chatError);
      setError(
        chatError instanceof Error ? chatError.message : "Could not join party chat.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentUser.id, entitlementsToken, partyId, partyMemberCount, presencePartyId, region, roomName, t]);

  React.useEffect(() => {
    void loadPartyChat();
  }, [loadPartyChat]);

  const handleSendChat = React.useCallback(async () => {
    const trimmedMessage = chatInput.trim();
    if (!partyRoom || !trimmedMessage) return;

    setSending(true);
    setError(null);
    try {
      sendPartyXmppMessage(trimmedMessage);
      setChatInput("");
    } catch (chatError) {
      console.warn("[combat] Failed to send XMPP party chat message", chatError);
      setError(
        chatError instanceof Error ? chatError.message : "Could not send party chat.",
      );
    } finally {
      setSending(false);
    }
  }, [chatInput, partyRoom]);

  const sendDisabled = !partyRoom || !chatInput.trim() || sending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.partyChatPanel}
    >
      <View style={styles.partyChatHeader}>
        <View>
          <Text style={styles.partyChatEyebrow}>XMPP chat</Text>
          <Text style={styles.partyChatTitle}>Party chat</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={loading}
          onPress={() => {
            void loadPartyChat();
          }}
          style={styles.partyChatRefreshButton}
        >
          <Icon
            name={loading ? "loading" : "refresh"}
            size={18}
            color={COLORS.TEXT_PRIMARY}
          />
        </TouchableOpacity>
      </View>

      {error ? (
        <Text style={styles.partyChatError} numberOfLines={3}>
          {error}
        </Text>
      ) : null}

      <FlatList
        data={sortedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.from === "me" || item.from === currentUser.id;
          return (
            <View
              style={[
                styles.chatBubble,
                mine ? styles.chatBubbleMine : styles.chatBubbleOther,
              ]}
            >
              <Text
                style={[styles.chatSender, mine ? styles.chatSenderMine : null]}
                numberOfLines={1}
              >
                {getChatSenderName(item.from, friends, currentUser)}
              </Text>
              <Text style={[styles.chatBody, mine ? styles.chatBodyMine : null]}>
                {item.body}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.chatEmptyState}>
            <Text style={styles.chatEmptyText}>
              {loading ? "Joining party chat..." : "No party messages yet."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.chatListContent}
        style={styles.chatList}
      />

      <View style={styles.chatInputRow}>
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Message party"
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          autoCorrect
          editable={Boolean(partyRoom) && !sending}
          returnKeyType="send"
          onSubmitEditing={handleSendChat}
          style={styles.chatInput}
        />
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={sendDisabled}
          onPress={handleSendChat}
          style={[styles.chatSendButton, sendDisabled ? styles.chatSendButtonDisabled : null]}
        >
          <Icon name="send" size={17} color={COLORS.PURE_WHITE} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function Combat() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const assets = getAssets();
  const { width } = useWindowDimensions();
  const [joinCode, setJoinCode] = React.useState("");
  const [activePanelIndex, setActivePanelIndex] = React.useState(0);
  const [partyCodeLoading, setPartyCodeLoading] = React.useState(false);
  const {
    filterByRole,
    handleAgentPress,
    handleAgentSelect,
    handleCancel,
    filteredAgents,
    selectedRole,
    selectedAgent,
    sessionSnapshot,
    sessionLoading,
    locking,
    currentPartyMember,
    togglePartyReadyState,
    loadSessionSnapshot,
  } = useCombat();

  useFocusEffect(
    useCallback(() => {
      void loadSessionSnapshot();
    }, [loadSessionSnapshot])
  );

  const activeMapId =
    sessionSnapshot.pregameMatch?.MapID || sessionSnapshot.currentGameMatch?.MapID;
  const mapInfo = assets.maps?.find((map: any) => map.mapUrl === activeMapId);
  const rawQueueLabel =
    sessionSnapshot.pregameMatch?.QueueID ||
    sessionSnapshot.currentGameMatch?.MatchmakingData?.QueueID ||
    sessionSnapshot.pregameMatch?.Mode ||
    sessionSnapshot.currentGameMatch?.ModeID;
  const queueLabel = formatSessionQueueLabel(
    rawQueueLabel,
    t,
    "combat_page.no_active_session"
  );
  const isIdleSession = sessionSnapshot.state === "idle";
  const sessionStateLabel =
    sessionSnapshot.state === "pregame"
      ? t("combat_page.session_pregame")
      : sessionSnapshot.state === "live"
        ? t("combat_page.session_live")
        : t("combat_page.session_idle");
  const mapDisplayName = mapInfo?.displayName || t("combat_page.no_map");
  const queueDisplayLabel = queueLabel;
  const partySize = sessionSnapshot.party?.Members?.length || 0;
  const partyCapacity = getSessionPartyCapacity({
    queueId: rawQueueLabel,
    customMode: sessionSnapshot.party?.CustomGameData?.Settings?.Mode,
    customPartySize: sessionSnapshot.party?.CustomGameData?.MaxPartySize,
  });
  const panelWidth = Math.max(width - 32, 280);

  const handlePanelScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActivePanelIndex(
        Math.round(event.nativeEvent.contentOffset.x / panelWidth),
      );
    },
    [panelWidth],
  );

  const handleLockPress = React.useCallback(async () => {
    if (!selectedAgent) {
      Alert.alert(
        t("combat_page.select_agent_title"),
        t("combat_page.select_agent_message")
      );
      return;
    }

    const locked = await handleAgentSelect();
    if (locked) {
      router.push("/combat_session" as never);
      return;
    }

    Alert.alert(t("combat_page.lock_failed_title"), t("combat_page.lock_failed_message"));
  }, [handleAgentSelect, router, selectedAgent, t]);

  const handleGenerateCode = React.useCallback(async () => {
    if (!sessionSnapshot.partyId) return;

    setPartyCodeLoading(true);
    try {
      await generatePartyInviteCode(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        sessionSnapshot.partyId
      );
      await loadSessionSnapshot();
    } catch (error) {
      console.warn("[combat] Failed to generate party code", error);
      Alert.alert("Party code", "Could not generate party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [loadSessionSnapshot, sessionSnapshot.partyId, user]);

  const handleDisableCode = React.useCallback(async () => {
    if (!sessionSnapshot.partyId) return;

    setPartyCodeLoading(true);
    try {
      await disablePartyInviteCode(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        sessionSnapshot.partyId
      );
      await loadSessionSnapshot();
    } catch (error) {
      console.warn("[combat] Failed to disable party code", error);
      Alert.alert("Party code", "Could not disable party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [loadSessionSnapshot, sessionSnapshot.partyId, user]);

  const handleJoinByCode = React.useCallback(async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) return;

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
      await loadSessionSnapshot();
    } catch (error) {
      console.warn("[combat] Failed to join party by code", error);
      Alert.alert("Party code", "Could not join party with this code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [joinCode, loadSessionSnapshot, user]);

  const handleCopyCode = React.useCallback(async () => {
    const code = sessionSnapshot.party?.InviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
  }, [sessionSnapshot.party?.InviteCode]);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Phiên đấu</Text>
          {!isIdleSession ? (
            <Text style={styles.screenSubtitle} numberOfLines={1}>
              {sessionStateLabel}
            </Text>
          ) : null}
        </View>

        <GlassCard
          style={styles.matchSummaryCard}
          contentStyle={styles.matchSummaryContent}
        >
          <View style={styles.matchSummaryMain}>
            <View style={styles.sessionHeaderCopy}>
              <Text style={styles.sessionEyebrow}>
                {isIdleSession ? "Combat" : sessionStateLabel}
              </Text>
              <Text style={styles.sessionTitle} numberOfLines={1}>
                {mapDisplayName}
              </Text>
              <Text style={styles.sessionSubtitle} numberOfLines={1}>
                {queueDisplayLabel}
              </Text>
            </View>

            <View style={styles.matchSummarySide}>
              {sessionSnapshot.partyId ? (
                <ValorantButton
                  title={
                    currentPartyMember?.IsReady
                      ? t("combat_page.actions.unready")
                      : t("combat_page.actions.ready")
                  }
                  variant="secondary"
                  onPress={() => {
                    void togglePartyReadyState();
                  }}
                  style={styles.inlineButton}
                />
              ) : null}
              {mapInfo?.listViewIcon ? (
                <Image
                  source={{ uri: mapInfo.listViewIcon }}
                  style={styles.sessionImage}
                  contentFit="cover"
                />
              ) : null}
            </View>
          </View>

          <View style={styles.metricRow}>
            <InfoPill style={styles.metricPill}>
              <Icon name="map-outline" size={14} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.metricText} numberOfLines={1}>
                {mapDisplayName}
              </Text>
            </InfoPill>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (sessionSnapshot.state !== "idle") {
                  router.push("/combat_session" as never);
                }
              }}
              style={styles.metricTouch}
            >
              <InfoPill style={styles.flex1}>
                <Icon name="account-group-outline" size={14} color={COLORS.TEXT_PRIMARY} />
                <Text style={styles.metricText}>
                  {partySize}/{partyCapacity}
                </Text>
              </InfoPill>
            </TouchableOpacity>
            <InfoPill style={styles.metricPill}>
              <Icon name="pulse" size={14} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.metricText} numberOfLines={1}>
                {sessionLoading ? t("combat_page.loading") : queueDisplayLabel}
              </Text>
            </InfoPill>
          </View>
        </GlassCard>

        <GlassCard
          style={styles.partyCodeCard}
          contentStyle={styles.partyCodeContent}
        >
          <View style={styles.partyCodeHeader}>
            <Text style={styles.partyCodeTitle}>Party code</Text>
            {sessionSnapshot.partyId ? (
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.partyCodeHeaderButton}
                disabled={partyCodeLoading}
                onPress={handleGenerateCode}
              >
                <Text style={styles.partyCodeHeaderButtonText}>
                  {sessionSnapshot.party?.InviteCode ? "Refresh" : "Generate"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.joinCodeRow}>
            <View style={styles.currentCodeRow}>
              <Text style={styles.currentCodeText} numberOfLines={1}>
                {sessionSnapshot.party?.InviteCode || "No active code"}
              </Text>
              {sessionSnapshot.party?.InviteCode ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.smallIconButton}
                    onPress={handleCopyCode}
                  >
                    <Icon name="content-copy" size={15} color={COLORS.TEXT_PRIMARY} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.smallIconButton}
                    disabled={partyCodeLoading}
                    onPress={handleDisableCode}
                  >
                    <Icon name="link-off" size={15} color={COLORS.WARNING} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Enter invite code"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="join"
              onSubmitEditing={handleJoinByCode}
              style={styles.joinCodeInput}
            />
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={!joinCode.trim() || partyCodeLoading}
              onPress={handleJoinByCode}
              style={[
                styles.joinCodeButton,
                !joinCode.trim() || partyCodeLoading
                  ? styles.joinCodeButtonDisabled
                  : null,
              ]}
            >
              <Text style={styles.joinCodeButtonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={styles.agentModule}>
          <View style={styles.panelLabelRow}>
            <Text
              style={[
                styles.panelLabel,
                activePanelIndex === 0 ? styles.panelLabelActive : null,
              ]}
            >
              Agents
            </Text>
            <Icon name="chevron-right" size={17} color={COLORS.TEXT_SECONDARY} />
            <Text
              style={[
                styles.panelLabel,
                activePanelIndex === 1 ? styles.panelLabelActive : null,
              ]}
            >
              Party chat
            </Text>
          </View>

          <FlatList
            data={COMBAT_PANELS}
            horizontal
            pagingEnabled
            bounces={false}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePanelScrollEnd}
            style={styles.panelPager}
            renderItem={({ item }) => (
              <View style={[styles.panelPage, { width: panelWidth }]}>
                {item === "agents" ? (
                  <>
                    <View style={styles.roleSelectorWrap}>
                      {ROLES.map((role) => (
                        <TouchableOpacity
                          key={role.id}
                          style={[
                            styles.roleBtn,
                            selectedRole === role.id && styles.roleBtnSelected,
                          ]}
                          onPress={() => filterByRole(role.id)}
                        >
                          <Image source={role.icon} style={styles.roleIcon} />
                          <Text
                            style={[
                              styles.roleLabel,
                              selectedRole === role.id && styles.roleLabelSelected,
                            ]}
                          >
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.gridWrap}>
                      <AgentGrid agents={filteredAgents} onAgentPress={handleAgentPress} />
                    </View>
                  </>
                ) : (
                  <PartyChatPanel
                    partyId={sessionSnapshot.partyId}
                    roomName={sessionSnapshot.party?.MUCName}
                    partyMemberCount={sessionSnapshot.party?.Members?.length || 0}
                    accessToken={user.accessToken}
                    entitlementsToken={user.entitlementsToken}
                    region={user.region}
                    currentUser={{
                      id: user.id,
                      name: user.name,
                      TagLine: user.TagLine,
                    }}
                  />
                )}
              </View>
            )}
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.buttonWrapper}>
            <ValorantButton
              title={t("combat_page.actions.cancel")}
              variant="secondary"
              onPress={() => {
                void handleCancel();
              }}
            />
          </View>
          <View style={styles.buttonWrapper}>
            <ValorantButton
              title={
                locking
                  ? t("combat_page.actions.locking")
                  : selectedAgent
                    ? `${t("combat_page.actions.lock")} ${selectedAgent.displayName}`
                    : t("combat_page.actions.lock")
              }
              onPress={() => {
                void handleLockPress();
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  screenHeader: {
    minHeight: 58,
    justifyContent: "center",
    marginBottom: 8,
  },
  screenTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "900",
  },
  screenSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  matchSummaryCard: {
    marginBottom: 10,
  },
  matchSummaryContent: {
    padding: 14,
  },
  matchSummaryMain: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  sessionEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sessionTitle: {
    marginTop: 5,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 23,
    fontWeight: "900",
  },
  sessionSubtitle: {
    marginTop: 3,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
  },
  matchSummarySide: {
    width: 118,
    gap: 8,
  },
  inlineButton: {
    minWidth: 0,
    width: "100%",
    minHeight: 38,
  },
  sessionImage: {
    width: "100%",
    height: 72,
    borderRadius: 16,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  metricPill: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 8,
  },
  metricTouch: {
    flex: 0.75,
  },
  metricText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "800",
  },
  partyCodeCard: {
    marginBottom: 10,
  },
  partyCodeContent: {
    padding: 12,
  },
  partyCodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  partyCodeTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
  partyCodeHeaderButton: {
    minHeight: 30,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  partyCodeHeaderButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "800",
  },
  currentCodeRow: {
    flex: 1,
    minWidth: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentCodeText: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    fontSize: 12,
    fontWeight: "800",
  },
  smallIconButton: {
    width: 34,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  joinCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  joinCodeInput: {
    flex: 0.95,
    minWidth: 96,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 10,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    fontSize: 12,
    fontWeight: "700",
  },
  joinCodeButton: {
    minHeight: 38,
    minWidth: 58,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT,
  },
  joinCodeButtonDisabled: {
    opacity: 0.45,
  },
  joinCodeButtonText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "800",
  },
  agentModule: {
    flex: 1,
    minHeight: 0,
    borderRadius: 24,
    padding: 10,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 12,
  },
  panelLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  panelLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "800",
  },
  panelLabelActive: {
    color: COLORS.TEXT_PRIMARY,
  },
  panelPager: {
    flex: 1,
  },
  panelPage: {
    flex: 1,
    paddingRight: 1,
  },
  gridWrap: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
  },
  buttonWrapper: {
    flex: 1,
  },
  roleSelectorWrap: {
    backgroundColor: "#000000",
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: 82,
    paddingVertical: 9,
    marginBottom: 10,
  },
  roleBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },
  roleBtnSelected: {
    borderBottomWidth: 2,
    borderBottomColor: "#ffffff",
  },
  roleIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  roleLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 4,
  },
  roleLabelSelected: {
    color: "#ffffff",
  },
  partyChatPanel: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    overflow: "hidden",
  },
  partyChatHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  partyChatEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  partyChatTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  partyChatRefreshButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  partyChatError: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
    color: COLORS.WARNING,
    backgroundColor: COLORS.SURFACE_MUTED,
    fontSize: 11,
    fontWeight: "700",
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    flexGrow: 1,
    gap: 8,
    padding: 12,
  },
  chatBubble: {
    maxWidth: "86%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  chatBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  chatSender: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
  },
  chatSenderMine: {
    color: "rgba(255,255,255,0.78)",
  },
  chatBody: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  chatBodyMine: {
    color: COLORS.PURE_WHITE,
  },
  chatEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  chatEmptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  chatInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    fontSize: 13,
    fontWeight: "700",
  },
  chatSendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT,
  },
  chatSendButtonDisabled: {
    opacity: 0.45,
  },
});
