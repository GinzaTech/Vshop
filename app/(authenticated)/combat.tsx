// ===== Import thư viện =====
import React, { useCallback } from "react";
import {
  ActivityIndicator,
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
import { CachedImage as Image } from "~/components/CachedImage";
import * as Clipboard from "expo-clipboard";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { MotiView } from "moti";

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
  watchOwnPartyPresence,
} from "~/utils/chat-service";
import {
  getChatHistory,
  getPartyChatInfo,
  sendPartyChatMessage as sendLocalPartyChatMessage,
  type LocalChatMessage,
} from "~/utils/riot-local-chat";
import { useChatStore, type ChatFriend, type ChatMessage } from "~/utils/chat-store";
import { useUserStore } from "~/hooks/useUserStore";

// ===== Hằng số =====
// ROLES: danh sách 4 vai trò Agent trong game, mỗi role có id, name và icon
const ROLES = [
  { id: "Duelist", name: "Duelist", icon: require("../../assets/images/Duelist.png") },
  { id: "Controller", name: "Controller", icon: require("../../assets/images/Controller.png") },
  { id: "Initiator", name: "Initiator", icon: require("../../assets/images/Initiator.png") },
  { id: "Sentinel", name: "Sentinel", icon: require("../../assets/images/Sentinel.png") },
];

// COMBAT_PANELS: danh sách các panel có thể chuyển đổi (agents, party-chat)
const COMBAT_PANELS = ["agents", "party-chat"] as const;

// getChatSenderName: lấy tên hiển thị của người gửi tin nhắn trong party chat
// senderId: ID người gửi, friends: danh sách bạn bè, currentUser: thông tin user hiện tại
// Trả về: tên người gửi dạng "name#tag" hoặc "name" hoặc "Party"
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

// sortChatMessagesByTime: sắp xếp mảng tin nhắn theo thời gian tăng dần
const sortChatMessagesByTime = (messages: ChatMessage[]) =>
  [...messages].sort((a, b) => a.timestamp - b.timestamp);

// LOCAL_PARTY_ROOM_PREFIX: tiền tố cho room chat local, phân biệt với XMPP chat
const LOCAL_PARTY_ROOM_PREFIX = "local:";

// PartyChatLoadOverride: kiểu cho các tham số ghi đè khi tải party chat
type PartyChatLoadOverride = {
  partyId?: string | null;
  roomName?: string | null;
  allowPresenceFallback?: boolean;
  tryDiscovery?: boolean;
};

// toLocalPartyRoom: chuyển conversation ID thành tên room local (thêm prefix "local:")
const toLocalPartyRoom = (cid: string) => `${LOCAL_PARTY_ROOM_PREFIX}${cid}`;

// fromLocalPartyRoom: lấy conversation ID từ tên room local (bỏ prefix "local:")
// Trả về null nếu không phải local room
const fromLocalPartyRoom = (room: string) =>
  room.startsWith(LOCAL_PARTY_ROOM_PREFIX)
    ? room.slice(LOCAL_PARTY_ROOM_PREFIX.length)
    : null;

// toPartyChatMessage: chuyển LocalChatMessage (từ API local) thành ChatMessage (store)
// message: tin nhắn local gốc, currentUserId: ID user hiện tại
// Trả về ChatMessage hoặc null nếu không hợp lệ
const toPartyChatMessage = (
  message: LocalChatMessage,
  currentUserId: string,
): ChatMessage | null => {
  if (!message.body || !message.cid) return null;

  const senderId = message.puuid || message.pid || message.name || "party";
  const timestamp = message.time ? Date.parse(message.time) : Date.now();

  return {
    id: message.mid || message.id || `${message.cid}:${senderId}:${message.time || Date.now()}`,
    from: senderId === currentUserId ? "me" : senderId,
    to: message.cid,
    body: message.body,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
};

// Component PartyChatPanel: bảng chat cho party (nhóm)
// Cho phép gửi/nhận tin nhắn qua XMPP hoặc local chat
function PartyChatPanel({
  partyId,
  roomName,
  accessToken,
  entitlementsToken,
  region,
  currentUser,
  onRefreshSession,
}: {
  partyId?: string | null;       // ID của party hiện tại
  roomName?: string | null;      // Tên room XMPP
  accessToken: string;           // Token xác thực Riot
  entitlementsToken: string;     // Token entitlements
  region: string;                // Vùng (region) của user
  currentUser: { id: string; name: string; TagLine: string }; // Thông tin user hiện tại
  onRefreshSession?: () => Promise<{
    partyId: string | null;
    party: any | null;
  } | void>;  // Callback refresh session khi cần
}) {
  // Lấy dữ liệu từ chat store
  const partyRoom = useChatStore((state) => state.partyChatRoom);      // Room chat đang hoạt động
  const chatStatus = useChatStore((state) => state.status);            // Trạng thái kết nối chat
  const presencePartyId = useChatStore((state) => state.currentPartyId); // Party ID từ presence XMPP
  const friends = useChatStore((state) => state.friends);              // Danh sách bạn bè
  const messages = useChatStore((state) =>                           // Tin nhắn trong party room hiện tại
    partyRoom ? state.partyMessages[partyRoom] || [] : []
  );
  // State local
  const [chatInput, setChatInput] = React.useState("");              // Nội dung input chat
  const [loading, setLoading] = React.useState(false);               // Đang tải party chat
  const [sending, setSending] = React.useState(false);               // Đang gửi tin nhắn
  const [error, setError] = React.useState<string | null>(null);      // Lỗi chat
  // sortedMessages: tin nhắn đã được sắp xếp theo thời gian (memoized)
  const sortedMessages = React.useMemo(
    () => sortChatMessagesByTime(messages),
    [messages]
  );

  // loadLocalPartyChat: tải lịch sử chat local (Riot client chat)
  // Lấy conversation info, đọc lịch sử và thêm vào store
  // Trả về: tên room local hoặc null nếu không có
  const loadLocalPartyChat = React.useCallback(async () => {
    const conversation = await getPartyChatInfo();
    if (!conversation?.cid) {
      return null;
    }

    const room = toLocalPartyRoom(conversation.cid);
    const history = await getChatHistory(conversation.cid);
    useChatStore.getState().setPartyChatRoom(room);

    for (const message of history) {
      const chatMessage = toPartyChatMessage(message, currentUser.id);
      if (chatMessage) {
        useChatStore.getState().addPartyMessage(room, chatMessage);
      }
    }

    if (__DEV__) {
      console.log("[combat] Loaded local party chat", {
        cid: conversation.cid,
        historyCount: history.length,
      });
    }

    return room;
  }, [currentUser.id]);

  // loadPartyChat: tải party chat (ưu tiên XMPP, fallback local)
  // override: các tham số ghi đè (partyId, roomName, ...)
  // Xử lý nhiều trường hợp: không có partyId → tìm local hoặc watch presence
  // Có partyId → join XMPP chat, nếu lỗi token → fallback sang presence
  const loadPartyChat = React.useCallback(async (override?: PartyChatLoadOverride) => {
    const hasExplicitPartyId = Object.prototype.hasOwnProperty.call(
      override ?? {},
      "partyId",
    );
    const resolvedPartyId = hasExplicitPartyId
      ? override?.partyId || null
      : partyId || presencePartyId;
    const resolvedRoomName = override?.roomName ?? roomName;
    const allowPresenceFallback =
      override?.allowPresenceFallback ?? !hasExplicitPartyId;
    const tryDiscovery = override?.tryDiscovery ?? false;

    if (!resolvedPartyId) {
      useChatStore.getState().setPartyChatRoom(null);
      if (!tryDiscovery) {
        setError(null);
        return;
      }

      setError("Looking for Valorant party presence...");
      try {
        const localRoom = await loadLocalPartyChat();
        if (localRoom) {
          setError(null);
          return;
        }
      } catch (localError) {
        if (__DEV__) console.log("[combat] Failed to load local party chat", localError);
      }

      try {
        await watchOwnPartyPresence({
          accessToken,
          entitlementsToken,
          region,
          userId: currentUser.id,
        });
      } catch (presenceError) {
        if (__DEV__) console.log("[combat] Failed to watch XMPP party presence", presenceError);
        setError("Join or create a party to use party chat.");
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinPartyXmppChat({
        accessToken,
        entitlementsToken,
        region,
        partyId: resolvedPartyId,
        userId: currentUser.id,
        roomName: resolvedRoomName,
      });
    } catch (chatError) {
      const isPartyTokenError =
        chatError instanceof Error &&
        chatError.message.includes("party chat token");

      if (isPartyTokenError) {
        useChatStore.getState().setPartyChatRoom(null);
      }

      if (
        allowPresenceFallback &&
        presencePartyId &&
        presencePartyId !== resolvedPartyId &&
        isPartyTokenError
      ) {
        try {
          await joinPartyXmppChat({
            accessToken,
            entitlementsToken,
            region,
            partyId: presencePartyId,
            userId: currentUser.id,
            roomName: resolvedRoomName,
          });
          return;
        } catch (fallbackError) {
          useChatStore.getState().setCurrentPartyId(null);
          useChatStore.getState().setPartyChatRoom(null);
          if (__DEV__) console.log("[combat] Failed to join XMPP party chat with presence party", fallbackError);
        }
      }
      if (__DEV__) console.log("[combat] Failed to join XMPP party chat", chatError);
      setError(
        isPartyTokenError
          ? "Party chat room expired or unavailable. Refresh session or join/create a Valorant party."
          : chatError instanceof Error ? chatError.message : "Could not join party chat.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentUser.id, entitlementsToken, loadLocalPartyChat, partyId, presencePartyId, region, roomName]);

  // refreshPartyChat: làm mới kết nối party chat bằng cách gọi onRefreshSession
  // sau đó load lại party chat với thông tin mới
  const refreshPartyChat = React.useCallback(async () => {
    const nextSnapshot = await onRefreshSession?.();

    await loadPartyChat({
      partyId: nextSnapshot?.partyId ?? null,
      roomName: nextSnapshot?.party?.MUCName ?? null,
      allowPresenceFallback: Boolean(nextSnapshot?.partyId),
      tryDiscovery: true,
    });
  }, [loadPartyChat, onRefreshSession]);

  // useEffect: tự động tải party chat khi component mount (không tryDiscovery)
  React.useEffect(() => {
    void loadPartyChat({ tryDiscovery: false });
  }, [loadPartyChat]);

  // handleSendChat: gửi tin nhắn party chat
  // Nếu là local room → gửi qua Riot local chat API
  // Nếu là XMPP room → gửi qua XMPP
  const handleSendChat = React.useCallback(async () => {
    const trimmedMessage = chatInput.trim();
    if (!partyRoom || !trimmedMessage) return;

    setSending(true);
    setError(null);
    try {
      const localCid = fromLocalPartyRoom(partyRoom);
      if (localCid) {
        const nextMessages = await sendLocalPartyChatMessage(localCid, trimmedMessage);
        for (const message of nextMessages) {
          const chatMessage = toPartyChatMessage(message, currentUser.id);
          if (chatMessage) {
            useChatStore.getState().addPartyMessage(partyRoom, chatMessage);
          }
        }
        setChatInput("");
        return;
      }

      sendPartyXmppMessage(trimmedMessage);
      setChatInput("");
    } catch (chatError) {
      if (__DEV__) console.warn("[combat] Failed to send XMPP party chat message", chatError);
      setError(
        chatError instanceof Error ? chatError.message : "Could not send party chat.",
      );
    } finally {
      setSending(false);
    }
  }, [chatInput, currentUser.id, partyRoom]);

  // Các biến trạng thái dẫn xuất cho UI
  const isLocalPartyRoom = Boolean(partyRoom && fromLocalPartyRoom(partyRoom)); // Có phải local room?
  const hasParty = Boolean(partyId || presencePartyId || isLocalPartyRoom);       // Có party không?
  const chatReady = Boolean(partyRoom) && (isLocalPartyRoom || chatStatus === "authenticated"); // Chat sẵn sàng?
  const canTypeMessage = chatReady && !sending && !loading;                      // Có thể gõ?
  const sendDisabled = !canTypeMessage || !chatInput.trim();                      // Disable nút send?
  const chatPlaceholder = canTypeMessage                                         // Placeholder input
    ? "Message party"
    : hasParty && (loading || chatStatus === "connecting")
      ? "Connecting to party chat..."
      : "Join a party first";

  return (
    // KeyboardAvoidingView: tránh bàn phím che mất chat (chỉ iOS)
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.partyChatPanel}
    >
      {/* Header panel: tiêu đề "Party chat" + nút refresh */}
      <View style={styles.partyChatHeader}>
        <View>
          <Text style={styles.partyChatEyebrow}>XMPP chat</Text>
          <Text style={styles.partyChatTitle}>Party chat</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={loading}
          onPress={() => { void refreshPartyChat(); }}
          style={styles.partyChatRefreshButton}
        >
          <Icon
            name={loading ? "loading" : "refresh"}
            size={18}
            color={COLORS.TEXT_PRIMARY}
          />
        </TouchableOpacity>
      </View>

      {/* Hiển thị lỗi nếu có */}
      {error ? (
        <Text style={styles.partyChatError} numberOfLines={3}>{error}</Text>
      ) : null}

      {/* Danh sách tin nhắn: FlatList */}
      <FlatList
        data={sortedMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.from === "me" || item.from === currentUser.id;
          return (
            <View style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubbleOther]}>
              <Text style={[styles.chatSender, mine ? styles.chatSenderMine : null]} numberOfLines={1}>
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

      {/* Hàng input chat: TextInput + nút Send */}
      <View style={styles.chatInputRow}>
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder={chatPlaceholder}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          autoCorrect
          editable={canTypeMessage}
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

// Component Combat (mặc định export): trang chính cho combat
// Hiển thị thông tin session, party code, chọn agent, party chat
export default function Combat() {
  const { t } = useTranslation();                          // Hook dịch thuật
  const router = useRouter();                               // Router để điều hướng
  const user = useUserStore((state) => state.user);         // Thông tin user (từ store)
  const assets = getAssets();                                // Assets game (map, agent,...)
  const { width } = useWindowDimensions();                   // Kích thước màn hình

  // State quản lý
  const [joinCode, setJoinCode] = React.useState("");                          // Mã mời đang nhập
  const [activePanelIndex, setActivePanelIndex] = React.useState(0);           // Panel đang active (0: agents, 1: party-chat)
  const [partyCodeLoading, setPartyCodeLoading] = React.useState(false);        // Đang xử lý party code
  const [partyReadyLoading, setPartyReadyLoading] = React.useState(false);      // Đang xử lý ready state
  const [copied, setCopied] = React.useState(false);                            // Đã copy code (hiện badge)
  const partyReadyRequestRef = React.useRef(false);                             // Ref chống gửi request ready trùng lặp

  // Lấy các hàm và dữ liệu từ hook useCombat
  const {
    filterByRole,            // Lọc agent theo role
    handleAgentPress,        // Xử lý khi nhấn agent
    handleAgentSelect,       // Xử lý khi chọn agent (lock)
    handleCancel,            // Hủy chọn agent
    filteredAgents,          // Danh sách agent đã lọc
    selectedRole,            // Role đang được chọn
    selectedAgent,           // Agent đang được chọn
    sessionSnapshot,         // Snapshot session hiện tại (pregame/live/idle)
    sessionLoading,          // Đang tải session
    locking,                 // Đang lock agent
    currentPartyMember,      // Thông tin member hiện tại trong party
    togglePartyReadyState,   // Toggle ready state
    loadSessionSnapshot,     // Tải session snapshot
  } = useCombat();

  // useFocusEffect: tải lại session mỗi khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      void loadSessionSnapshot();
    }, [loadSessionSnapshot])
  );

  // === Các biến dẫn xuất từ sessionSnapshot ===
  const activeMapId =
    sessionSnapshot.pregameMatch?.MapID || sessionSnapshot.currentGameMatch?.MapID; // ID map đang chơi
  const mapInfo = assets.maps?.find((map: any) => map.mapUrl === activeMapId);       // Thông tin map
  const rawQueueLabel =
    sessionSnapshot.pregameMatch?.QueueID ||                                        // Queue ID từ pregame
    sessionSnapshot.currentGameMatch?.MatchmakingData?.QueueID ||                   // Queue ID từ game live
    sessionSnapshot.pregameMatch?.Mode ||                                          // Mode pregame
    sessionSnapshot.currentGameMatch?.ModeID;                                       // Mode ID game live
  const queueLabel = formatSessionQueueLabel(                                       // Nhãn queue đã format
    rawQueueLabel,
    t,
    "combat_page.no_active_session"
  );
  const isIdleSession = sessionSnapshot.state === "idle";                           // Có phải idle?
  const sessionStateLabel =
    sessionSnapshot.state === "pregame" ? t("combat_page.session_pregame") :       // Nhãn trạng thái session
      sessionSnapshot.state === "live" ? t("combat_page.session_live")
        : t("combat_page.session_idle");
  const mapDisplayName = mapInfo?.displayName || t("combat_page.no_map");           // Tên map hiển thị
  const queueDisplayLabel = queueLabel;                                              // Nhãn queue hiển thị
  const partySize = sessionSnapshot.party?.Members?.length || 0;                     // Số lượng thành viên party
  const shouldShowCombatSummary = !isIdleSession || Boolean(sessionSnapshot.partyId); // Hiển thị summary?
  const partyCapacity = getSessionPartyCapacity({                                    // Sức chứa party
    queueId: rawQueueLabel,
    customMode: sessionSnapshot.party?.CustomGameData?.Settings?.Mode,
    customPartySize: sessionSnapshot.party?.CustomGameData?.MaxPartySize,
  });
  const panelWidth = Math.max(width - 54, 280);  // Chiều rộng panel (dùng cho paging)

  // handlePanelScrollEnd: xác định panel nào đang được xem sau khi scroll ngang
  const handlePanelScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActivePanelIndex(
        Math.round(event.nativeEvent.contentOffset.x / panelWidth),
      );
    },
    [panelWidth],
  );

  // handleLockPress: xử lý khi nhấn nút Lock (chọn agent)
  // Nếu chưa chọn agent → alert, nếu lock thành công → chuyển sang combat_session
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

  // handleGenerateCode: tạo mã mời party mới
  const handleGenerateCode = React.useCallback(async () => {
    if (!sessionSnapshot.partyId) return;

    setPartyCodeLoading(true);
    try {
      await generatePartyInviteCode(
        user.accessToken, user.entitlementsToken, user.region, sessionSnapshot.partyId
      );
      await loadSessionSnapshot();
    } catch (error) {
      if (__DEV__) console.warn("[combat] Failed to generate party code", error);
      Alert.alert("Party code", "Could not generate party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [loadSessionSnapshot, sessionSnapshot.partyId, user.accessToken, user.entitlementsToken, user.region]);

  // handleDisableCode: vô hiệu hóa mã mời party hiện tại
  const handleDisableCode = React.useCallback(async () => {
    if (!sessionSnapshot.partyId) return;

    setPartyCodeLoading(true);
    try {
      await disablePartyInviteCode(
        user.accessToken, user.entitlementsToken, user.region, sessionSnapshot.partyId
      );
      await loadSessionSnapshot();
    } catch (error) {
      if (__DEV__) console.warn("[combat] Failed to disable party code", error);
      Alert.alert("Party code", "Could not disable party invite code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [loadSessionSnapshot, sessionSnapshot.partyId, user.accessToken, user.entitlementsToken, user.region]);

  // handleJoinByCode: tham gia party bằng mã mời
  const handleJoinByCode = React.useCallback(async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) return;

    setPartyCodeLoading(true);
    try {
      const joined = await joinPartyByCode(
        user.accessToken, user.entitlementsToken, user.region, trimmedCode
      );

      if (!joined) {
        Alert.alert("Party code", "Invalid or expired party invite code.");
        return;
      }

      setJoinCode("");
      await loadSessionSnapshot();
    } catch (error) {
      if (__DEV__) console.warn("[combat] Failed to join party by code", error);
      Alert.alert("Party code", "Could not join party with this code.");
    } finally {
      setPartyCodeLoading(false);
    }
  }, [joinCode, loadSessionSnapshot, user.accessToken, user.entitlementsToken, user.region]);

  // handleCopyCode: copy mã mời party vào clipboard
  const handleCopyCode = React.useCallback(async () => {
    const code = sessionSnapshot.party?.InviteCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [sessionSnapshot.party?.InviteCode]);

  // handleTogglePartyReady: toggle trạng thái ready của member trong party
  // partyReadyRequestRef ngăn gửi request khi đang có request trước đó
  const handleTogglePartyReady = React.useCallback(async () => {
    if (!sessionSnapshot.partyId || partyReadyRequestRef.current) return;

    partyReadyRequestRef.current = true;
    setPartyReadyLoading(true);
    try {
      const updatedParty = await togglePartyReadyState();
      if (!updatedParty) {
        Alert.alert("Party", "Could not update ready state.");
      }
    } finally {
      partyReadyRequestRef.current = false;
      setPartyReadyLoading(false);
    }
  }, [sessionSnapshot.partyId, togglePartyReadyState]);

  // handleOpenCombatSession: mở trang combat_session nếu session không idle
  const handleOpenCombatSession = React.useCallback(() => {
    if (sessionSnapshot.state !== "idle") {
      router.push("/combat_session" as never);
    }
  }, [router, sessionSnapshot.state]);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        {/* Card tóm tắt match: hiển thị map, queue, party size, nút ready */}
        {shouldShowCombatSummary ? (
          <TouchableOpacity
            activeOpacity={isIdleSession ? 1 : 0.82}
            disabled={isIdleSession}
            style={styles.matchSummaryCard}
            onPress={handleOpenCombatSession}
          >
            <GlassCard contentStyle={styles.matchSummaryContent}>
              <View style={styles.matchSummaryMain}>
                {/* Phần text bên trái: trạng thái session, tên map, queue */}
                <View style={styles.sessionHeaderCopy}>
                  <Text style={styles.sessionEyebrow}>
                    {isIdleSession ? "Combat" : sessionStateLabel}
                  </Text>
                  {!isIdleSession ? (
                    <>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{mapDisplayName}</Text>
                      <Text style={styles.sessionSubtitle} numberOfLines={1}>{queueDisplayLabel}</Text>
                    </>
                  ) : null}
                </View>
                {/* Phần bên phải: nút ready + ảnh map */}
                <View style={styles.matchSummarySide}>
                  {mapInfo?.listViewIcon ? (
                    <Image
                      cacheId={`map:${mapInfo.uuid || activeMapId}:list-view`}
                      source={{ uri: mapInfo.listViewIcon }}
                      style={styles.sessionImage} contentFit="cover"
                    />
                  ) : null}
                </View>
              </View>
              {/* Hàng metrics: map name, party size, queue */}
              <View style={styles.metricRow}>
                <InfoPill style={styles.metricPill}>
                  <Icon name="map-outline" size={14} color={COLORS.TEXT_PRIMARY} />
                  <Text style={styles.metricText} numberOfLines={1}>{mapDisplayName}</Text>
                </InfoPill>
                <InfoPill style={styles.metricPillCompact}>
                  <Icon name="account-group-outline" size={14} color={COLORS.TEXT_PRIMARY} />
                  <Text style={styles.metricText}>{partySize}/{partyCapacity}</Text>
                </InfoPill>
                {!isIdleSession ? (
                  <InfoPill style={styles.metricPill}>
                    <Icon name="pulse" size={14} color={COLORS.TEXT_PRIMARY} />
                    <Text style={styles.metricText} numberOfLines={1}>
                      {sessionLoading ? t("combat_page.loading") : queueDisplayLabel}
                    </Text>
                  </InfoPill>
                ) : null}
              </View>
            </GlassCard>
          </TouchableOpacity>
        ) : null}

        {/* Card Party code: tạo, copy, disable mã mời + join bằng mã */}
        <GlassCard style={styles.partyCodeCard} contentStyle={styles.partyCodeContent}>
          <View style={styles.partyCodeHeader}>
            <Text style={styles.partyCodeTitle}>Party code</Text>
            <View style={styles.partyCodeHeaderActions}>
              {/* Nút Ready/Unready */}
              {sessionSnapshot.partyId ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ busy: partyReadyLoading, disabled: partyReadyLoading }}
                  activeOpacity={0.75}
                  disabled={partyReadyLoading}
                  onPress={handleTogglePartyReady}
                  style={[
                    styles.partyReadyButton,
                    currentPartyMember?.IsReady ? styles.partyReadyButtonUnset : styles.partyReadyButtonSet,
                    partyReadyLoading && styles.partyReadyButtonDisabled,
                  ]}
                >
                  {partyReadyLoading ? (
                    <ActivityIndicator size="small" color={currentPartyMember?.IsReady ? COLORS.WARNING : COLORS.SUCCESS} />
                  ) : (
                    <Icon
                      name={currentPartyMember?.IsReady ? "close-circle-outline" : "check-circle-outline"}
                      size={15}
                      color={currentPartyMember?.IsReady ? COLORS.WARNING : COLORS.SUCCESS}
                    />
                  )}
                  <Text numberOfLines={1} style={[styles.partyReadyButtonText, { color: currentPartyMember?.IsReady ? COLORS.WARNING : COLORS.SUCCESS }]}>
                    {currentPartyMember?.IsReady ? t("combat_page.actions.unready") : t("combat_page.actions.ready")}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {/* Nút Generate/Refresh code */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.partyCodeHeaderButton, (!sessionSnapshot.partyId || partyCodeLoading) && styles.partyCodeHeaderButtonDisabled]}
                disabled={!sessionSnapshot.partyId || partyCodeLoading}
                onPress={handleGenerateCode}
              >
                <Text style={[styles.partyCodeHeaderButtonText, (!sessionSnapshot.partyId || partyCodeLoading) && styles.partyCodeHeaderButtonTextDisabled]}>
                  {sessionSnapshot.party?.InviteCode ? "Refresh" : "Generate"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hàng hiển thị mã hiện tại + input join code */}
          <View style={styles.joinCodeRow}>
            <View style={styles.currentCodeRow}>
              <Text style={styles.currentCodeText} numberOfLines={1}>
                {sessionSnapshot.party?.InviteCode || "No active code"}
              </Text>
              {sessionSnapshot.party?.InviteCode ? (
                <>
                  <View style={styles.copyButtonWrap}>
                    <TouchableOpacity activeOpacity={0.75} style={styles.smallIconButton} onPress={handleCopyCode}>
                      <Icon name="content-copy" size={15} color={COLORS.TEXT_PRIMARY} />
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
                  <TouchableOpacity activeOpacity={0.75} style={styles.smallIconButton} disabled={partyCodeLoading} onPress={handleDisableCode}>
                    <Icon name="link-off" size={15} color={COLORS.WARNING} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
            <TextInput
              value={joinCode} onChangeText={setJoinCode}
              placeholder="Enter invite code" placeholderTextColor={COLORS.TEXT_SECONDARY}
              autoCapitalize="characters" autoCorrect={false}
              returnKeyType="join" onSubmitEditing={handleJoinByCode}
              style={styles.joinCodeInput}
            />
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={!joinCode.trim() || partyCodeLoading}
              onPress={handleJoinByCode}
              style={[styles.joinCodeButton, (!joinCode.trim() || partyCodeLoading) ? styles.joinCodeButtonDisabled : null]}
            >
              <Text style={styles.joinCodeButtonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Module agent: chứa FlatList với 2 panel (agents / party-chat) */}
        <View style={styles.agentModule}>
          {/* Nhãn panel indicator */}
          <View style={styles.panelLabelRow}>
            <Text style={[styles.panelLabel, activePanelIndex === 0 ? styles.panelLabelActive : null]}>Agents</Text>
            <Icon name="chevron-right" size={17} color={COLORS.TEXT_SECONDARY} />
            <Text style={[styles.panelLabel, activePanelIndex === 1 ? styles.panelLabelActive : null]}>Party chat</Text>
          </View>

          {/* FlatList ngang với paging: chuyển giữa agents và party-chat */}
          <FlatList
            data={COMBAT_PANELS}
            horizontal pagingEnabled bounces={false}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePanelScrollEnd}
            style={styles.panelPager}
            renderItem={({ item }) => (
              <View style={[styles.panelPage, { width: panelWidth }]}>
                {item === "agents" ? (
                  <>
                    {/* Thanh chọn role */}
                    <View style={styles.roleSelectorWrap}>
                      {ROLES.map((role) => (
                        <TouchableOpacity
                          key={role.id}
                          style={[styles.roleBtn, selectedRole === role.id && styles.roleBtnSelected]}
                          onPress={() => filterByRole(role.id)}
                        >
                          <Image source={role.icon} style={styles.roleIcon} />
                        </TouchableOpacity>
                      ))}
                    </View>
                    {/* Lưới agent */}
                    <View style={styles.gridWrap}>
                      <AgentGrid agents={filteredAgents} onAgentPress={handleAgentPress} selectedAgentId={selectedAgent?.uuid} />
                    </View>
                  </>
                ) : (
                  <PartyChatPanel
                    partyId={sessionSnapshot.partyId}
                    roomName={sessionSnapshot.party?.MUCName}
                    accessToken={user.accessToken}
                    entitlementsToken={user.entitlementsToken}
                    region={user.region}
                    onRefreshSession={loadSessionSnapshot}
                    currentUser={{ id: user.id, name: user.name, TagLine: user.TagLine }}
                  />
                )}
              </View>
            )}
          />
        </View>

        {/* Footer: nút Cancel + Lock agent */}
        <View style={styles.footer}>
          <View style={styles.buttonWrapper}>
            <ValorantButton title={t("combat_page.actions.cancel")} variant="secondary" onPress={() => { void handleCancel(); }} />
          </View>
          <View style={styles.buttonWrapper}>
            <ValorantButton
              title={locking ? t("combat_page.actions.locking") : selectedAgent ? `${t("combat_page.actions.lock")} ${selectedAgent.displayName}` : t("combat_page.actions.lock")}
              onPress={() => { void handleLockPress(); }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ===== StyleSheet định nghĩa giao diện =====
const styles = StyleSheet.create({
  // Màn hình chính: nền tối, full màn hình
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  // Nội dung: padding ngang 16, trên 4, dưới 16, co giãn đầy
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, flex: 1 },
  flex1: { flex: 1 },
  // Card tóm tắt match
  matchSummaryCard: { marginBottom: 10 },
  matchSummaryContent: { padding: 14 },
  // Hàng chính của summary: text trái, ảnh/nút phải
  matchSummaryMain: { flexDirection: "row", alignItems: "stretch", justifyContent: "space-between", gap: 12 },
  // Phần text thông tin session
  sessionHeaderCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  // Eyebrow session: chữ nhỏ, màu phụ, in hoa
  sessionEyebrow: { color: COLORS.TEXT_SECONDARY, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  // Tiêu đề session: cỡ 23, đậm nhất
  sessionTitle: { marginTop: 5, color: COLORS.TEXT_PRIMARY, fontSize: 23, fontWeight: "900" },
  // Phụ đề session: cỡ 13, màu phụ
  sessionSubtitle: { marginTop: 3, color: COLORS.TEXT_SECONDARY, fontSize: 13, fontWeight: "700" },
  // Phần bên phải summary: width 118
  matchSummarySide: { width: 118, gap: 8 },
  // Nút inline (ready): full width, chiều cao tối thiểu 38
  inlineButton: { minWidth: 0, width: "100%", minHeight: 38 },
  // Ảnh map trong session: full width, cao 72, bo góc
  sessionImage: { width: "100%", height: 72, borderRadius: 16 },
  // Hàng metric: 3 pill ngang
  metricRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  metricPill: { flex: 1, minHeight: 36, paddingHorizontal: 8 },
  metricPillCompact: { flex: 0.75, minHeight: 36, paddingHorizontal: 8 },
  metricText: { color: COLORS.TEXT_PRIMARY, fontSize: 11, fontWeight: "800" },
  // Card party code
  partyCodeCard: { marginBottom: 10 },
  partyCodeContent: { padding: 12 },
  // Header của party code card: hàng ngang, wrap
  partyCodeHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  partyCodeTitle: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "800" },
  // Các nút action bên phải header
  partyCodeHeaderActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexShrink: 1, marginLeft: "auto", gap: 8 },
  // Nút ready/unready: width 118, bo góc 12
  partyReadyButton: { width: 118, minHeight: 30, borderRadius: 12, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1 },
  partyReadyButtonSet: { backgroundColor: "rgba(48, 164, 108, 0.12)", borderColor: COLORS.SUCCESS },
  partyReadyButtonUnset: { backgroundColor: "rgba(229, 72, 77, 0.10)", borderColor: COLORS.WARNING },
  partyReadyButtonDisabled: { opacity: 0.58 },
  partyReadyButtonText: { flexShrink: 1, fontSize: 11, fontWeight: "800" },
  // Nút generate/refresh code
  partyCodeHeaderButton: { minHeight: 30, borderRadius: 12, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  partyCodeHeaderButtonDisabled: { opacity: 0.48 },
  partyCodeHeaderButtonText: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: "800" },
  partyCodeHeaderButtonTextDisabled: { color: COLORS.TEXT_SECONDARY },
  // Hàng hiển thị code hiện tại
  currentCodeRow: { flex: 1, minWidth: 110, flexDirection: "row", alignItems: "center", gap: 6 },
  // Text box code hiện tại
  currentCodeText: { flex: 1, minHeight: 38, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 12, fontWeight: "800" },
  // Nút icon nhỏ (copy/disable)
  smallIconButton: { width: 34, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  // Wrapper quanh nút copy (định vị badge "Copied!")
  copyButtonWrap: { position: "relative", justifyContent: "center" },
  // Badge "Copied!" hiện sau khi copy thành công
  copiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(48, 164, 108, 0.15)", position: "absolute", top: -20, right: 0, zIndex: 10 },
  // Text trong badge "Copied!"
  copiedText: { color: COLORS.SUCCESS, fontSize: 11, fontWeight: "700" },
  // Hàng join code: input + nút Join
  joinCodeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  // Input join code
  joinCodeInput: { flex: 0.95, minWidth: 96, minHeight: 38, borderRadius: 12, paddingHorizontal: 10, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 12, fontWeight: "700" },
  // Nút Join
  joinCodeButton: { minHeight: 38, minWidth: 58, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ACCENT },
  joinCodeButtonDisabled: { opacity: 0.45 },
  joinCodeButtonText: { color: COLORS.PURE_WHITE, fontSize: 12, fontWeight: "800" },
  // Module chứa agent panel + party chat panel
  agentModule: { flex: 1, minHeight: 0, borderRadius: 24, padding: 10, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER, marginBottom: 12 },
  // Hàng nhãn panel (Agents > Party chat)
  panelLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  panelLabel: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: "800" },
  panelLabelActive: { color: COLORS.TEXT_PRIMARY },
  // FlatList ngang paging
  panelPager: { flex: 1 },
  panelPage: { flex: 1, paddingRight: 1 },
  // Wrap lưới agent
  gridWrap: { flex: 1, minHeight: 0 },
  // Footer: 2 nút Cancel + Lock
  footer: { flexDirection: "row", gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER, backgroundColor: COLORS.BACKGROUND },
  buttonWrapper: { flex: 1 },
  // Thanh chọn role: nền đen, bo góc 18
  roleSelectorWrap: { backgroundColor: "#000000", borderRadius: 18, flexDirection: "row", justifyContent: "space-around", minHeight: 82, paddingVertical: 9, marginBottom: 10 },
  roleBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 4 },
  roleBtnSelected: { borderBottomWidth: 2, borderBottomColor: "#ffffff" },
  roleIcon: { width: 42, height: 42, resizeMode: "contain" },
  // Panel party chat: bo góc, nền SURFACE, viền BORDER
  partyChatPanel: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE, overflow: "hidden" },
  // Header party chat: tối thiểu 58, hàng ngang, có borderBottom
  partyChatHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  partyChatEyebrow: { color: COLORS.TEXT_SECONDARY, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  partyChatTitle: { color: COLORS.TEXT_PRIMARY, fontSize: 16, fontWeight: "800", marginTop: 2 },
  // Nút refresh party chat
  partyChatRefreshButton: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER },
  // Text lỗi trong party chat
  partyChatError: { marginHorizontal: 12, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, overflow: "hidden", color: COLORS.WARNING, backgroundColor: COLORS.SURFACE_MUTED, fontSize: 11, fontWeight: "700" },
  // Danh sách chat: co giãn đầy
  chatList: { flex: 1 },
  chatListContent: { flexGrow: 1, gap: 8, padding: 12 },
  // Bubble tin nhắn: max 86% width, bo góc 14
  chatBubble: { maxWidth: "86%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.BORDER },
  // Bubble của mình: căn phải, nền ACCENT
  chatBubbleMine: { alignSelf: "flex-end", backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  // Bubble của người khác: căn trái, nền mờ
  chatBubbleOther: { alignSelf: "flex-start", backgroundColor: COLORS.SURFACE_MUTED },
  // Tên người gửi trong bubble
  chatSender: { color: COLORS.TEXT_SECONDARY, fontSize: 10, fontWeight: "800", marginBottom: 3 },
  chatSenderMine: { color: "rgba(255,255,255,0.78)" },
  // Nội dung tin nhắn
  chatBody: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  chatBodyMine: { color: COLORS.PURE_WHITE },
  // Empty state chat
  chatEmptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  chatEmptyText: { color: COLORS.TEXT_SECONDARY, fontSize: 13, fontWeight: "700", textAlign: "center" },
  // Hàng input: TextInput + nút Send
  chatInputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER },
  // TextInput chat
  chatInput: { flex: 1, minHeight: 42, borderRadius: 14, paddingHorizontal: 12, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER, fontSize: 13, fontWeight: "700" },
  // Nút Send
  chatSendButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ACCENT },
  chatSendButtonDisabled: { opacity: 0.45 },
});
