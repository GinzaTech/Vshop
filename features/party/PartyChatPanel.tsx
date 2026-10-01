import React from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import AppRefreshControl from "~/components/ui/AppRefreshControl";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import type { PartyResponse } from "~/utils/valorant-api";
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
import {
  EMPTY_CHAT_MESSAGES,
  useChatStore,
  type ChatFriend,
  type ChatMessage,
} from "~/utils/chat-store";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

// getChatSenderName: lấy tên hiển thị của người gửi tin nhắn trong party chat
// senderId: ID người gửi, friends: danh sách bạn bè, currentUser: thông tin user hiện tại
// Trả về: tên người gửi dạng "name#tag" hoặc "name" hoặc "Party"
const getChatSenderName = (
  senderId: string,
  friends: Record<string, ChatFriend>,
  currentUser: { id: string; name: string; TagLine: string },
  fallbackLabels: { me: string; party: string },
) => {
  if (senderId === "me" || senderId === currentUser.id) {
    return currentUser.TagLine
      ? `${currentUser.name}#${currentUser.TagLine}`
      : currentUser.name || fallbackLabels.me;
  }

  const friend = friends[senderId];
  if (friend) {
    return friend.tagLine ? `${friend.gameName}#${friend.tagLine}` : friend.gameName;
  }

  return senderId.length > 12
    ? senderId.slice(0, 8)
    : senderId || fallbackLabels.party;
};

// sortChatMessagesByTime: sắp xếp mảng tin nhắn theo thời gian tăng dần
const sortChatMessagesByTime = (messages: readonly ChatMessage[]) =>
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

/**
 * PartyChatPanel – Bảng chat của party, gửi/nhận tin nhắn qua XMPP hoặc
 * Riot local chat API (fallback khi XMPP lỗi token). Tự tải party chat
 * khi mount; request trùng bị dedupe qua partyLoadRef (key = user:party:room).
 *
 * @param {Object} props - Props của component.
 * @param {string | null} [props.partyId] – ID party hiện tại (null khi idle).
 * @param {string | null} [props.roomName] – Tên room XMPP (MUCName từ party).
 * @param {string} props.accessToken – Access token Riot dùng cho XMPP.
 * @param {string} props.entitlementsToken – Entitlements token Riot.
 * @param {string} props.region – Region của user.
 * @param {Object} props.currentUser – Thông tin user hiện tại { id, name, TagLine }.
 * @param {Function} [props.onRefreshSession] – Callback lấy snapshot party
 *   mới nhất, dùng khi refresh thủ công (pull-to-refresh / nút refresh).
 * @returns {JSX.Element} Panel chat: FlatList tin nhắn + composer + nút refresh.
 */
export function PartyChatPanel({
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
    party: PartyResponse | null;
  } | void>;  // Callback refresh session khi cần
}) {
  const { t } = useTranslation();
  // Lấy dữ liệu từ chat store
  const partyRoom = useChatStore((state) => state.partyChatRoom);      // Room chat đang hoạt động
  const chatStatus = useChatStore((state) => state.status);            // Trạng thái kết nối chat
  const presencePartyId = useChatStore((state) => state.currentPartyId); // Party ID từ presence XMPP
  const friends = useChatStore((state) => state.friends);              // Danh sách bạn bè
  const messages = useChatStore((state) =>                           // Tin nhắn trong party room hiện tại
    partyRoom ? state.partyMessages[partyRoom] || EMPTY_CHAT_MESSAGES : EMPTY_CHAT_MESSAGES
  );
  // State local
  const [chatInput, setChatInput] = React.useState("");              // Nội dung input chat
  const [loading, setLoading] = React.useState(false);               // Đang tải party chat
  const [sending, setSending] = React.useState(false);               // Đang gửi tin nhắn
  const [error, setError] = React.useState<string | null>(null);      // Lỗi chat
  const partyLoadRef = React.useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
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
    const loadKey = [
      currentUser.id,
      resolvedPartyId || "no-party",
      resolvedRoomName || "no-room",
      tryDiscovery ? "discover" : "default",
    ].join(":");

    if (partyLoadRef.current?.key === loadKey) {
      return partyLoadRef.current.promise;
    }

    let loadTask!: Promise<void>;
    loadTask = (async () => {

      if (!resolvedPartyId) {
        useChatStore.getState().setPartyChatRoom(null);
        if (!tryDiscovery) {
          setError(null);
          return;
        }

        setError(t("combat_page.chat.looking_presence"));
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
          setError(t("combat_page.chat.join_required"));
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

        // Riot can briefly return 404 for the MUC token after a party changed.
        // The local Riot Client chat endpoint, when configured, remains a valid
        // read/write fallback and avoids presenting a dead party chat panel.
        try {
          const localRoom = await loadLocalPartyChat();
          if (localRoom) {
            setError(null);
            return;
          }
        } catch (localError) {
          if (__DEV__) console.log("[combat] Local party chat fallback unavailable", localError);
        }

        if (isPartyTokenError) {
          useChatStore.getState().setPartyChatRoom(null);
        }
        // Presence is only a discovery fallback. When the current combat
        // snapshot already supplied a party ID, retrying a different presence
        // ID produces duplicate failing MUC requests and hides the true state.
        if (
          allowPresenceFallback &&
          !partyId &&
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
            ? t("combat_page.chat.temporarily_unavailable")
            : t("combat_page.chat.join_failed"),
        );
      } finally {
        setLoading(false);
      }
    })();

    partyLoadRef.current = { key: loadKey, promise: loadTask };
    try {
      await loadTask;
    } finally {
      if (partyLoadRef.current?.promise === loadTask) {
        partyLoadRef.current = null;
      }
    }
  }, [accessToken, currentUser.id, entitlementsToken, loadLocalPartyChat, partyId, presencePartyId, region, roomName, t]);

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
  const {
    refreshing: partyRefreshing,
    onRefresh: onRefreshPartyChat,
  } = useAsyncRefresh(refreshPartyChat);

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
        t("combat_page.chat.send_failed"),
      );
    } finally {
      setSending(false);
    }
  }, [chatInput, currentUser.id, partyRoom, t]);

  // Các biến trạng thái dẫn xuất cho UI
  const isLocalPartyRoom = Boolean(partyRoom && fromLocalPartyRoom(partyRoom)); // Có phải local room?
  const hasParty = Boolean(partyId || presencePartyId || isLocalPartyRoom);       // Có party không?
  const chatReady = Boolean(partyRoom) && (isLocalPartyRoom || chatStatus === "authenticated"); // Chat sẵn sàng?
  const canTypeMessage = chatReady && !sending && !loading;                      // Có thể gõ?
  const sendDisabled = !canTypeMessage || !chatInput.trim();                      // Disable nút send?
  const chatPlaceholder = canTypeMessage                                         // Placeholder input
    ? t("combat_page.chat.message_placeholder")
    : hasParty && (loading || chatStatus === "connecting")
      ? t("combat_page.chat.connecting")
      : t("combat_page.chat.join_first");

  return (
    // KeyboardAvoidingView: tránh bàn phím che mất chat (chỉ iOS)
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.partyChatPanel}
    >
      {/* Header panel: tiêu đề "Party chat" + nút refresh */}
      <View style={styles.partyChatHeader}>
        <View>
          <Text style={styles.partyChatEyebrow}>{t("combat_page.xmpp_chat")}</Text>
          <Text style={styles.partyChatTitle}>{t("combat_page.party_chat")}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("combat_page.chat.refresh")}
          accessibilityState={{
            busy: loading || partyRefreshing,
            disabled: loading || partyRefreshing,
          }}
          activeOpacity={0.75}
          disabled={loading || partyRefreshing}
          onPress={onRefreshPartyChat}
          style={styles.partyChatRefreshButton}
        >
          <AppIcon
            name={loading || partyRefreshing ? "loading" : "refresh"}
            size={18}
            color={COLORS.TEXT_PRIMARY}
            decorative
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
                {getChatSenderName(item.from, friends, currentUser, {
                  me: t("combat_page.me"),
                  party: t("combat_page.party"),
                })}
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
              {loading ? t("combat_page.chat.joining") : t("combat_page.chat.empty")}
            </Text>
          </View>
        }
        contentContainerStyle={styles.chatListContent}
        style={styles.chatList}
        refreshControl={
          <AppRefreshControl
            refreshing={partyRefreshing}
            onRefresh={onRefreshPartyChat}
          />
        }
        alwaysBounceVertical
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
          accessibilityLabel={t("combat_page.chat.message_placeholder")}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("combat_page.chat.send")}
          accessibilityState={{ disabled: sendDisabled, busy: sending }}
          activeOpacity={0.75}
          disabled={sendDisabled}
          onPress={handleSendChat}
          style={[styles.chatSendButton, sendDisabled ? styles.chatSendButtonDisabled : null]}
        >
          <AppIcon name="chatSend" size={17} color={COLORS.PURE_WHITE} decorative />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
