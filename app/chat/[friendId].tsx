// 📄 app/chat/[friendId].tsx — Màn hình chat với bạn bè (Riot Chat)
// Sử dụng giao thức XMPP qua chat-service để gửi/nhận tin nhắn realtime.
// Route động: /chat/:friendId

import React, { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  EMPTY_CHAT_MESSAGES,
  useChatStore,
  type ChatMessage,
} from "~/utils/chat-store";
import {
  initChatService,
  requestChatHistory,
  sendChatMessage,
} from "~/utils/chat-service";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS } from "~/constants/DesignSystem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserStore } from "~/hooks/useUserStore";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

/**
 * renderChatMessage — Render một bubble tin nhắn.
 *
 * @param {ListRenderItemInfo<ChatMessage>} params.item - Tin nhắn cần render.
 * @returns {JSX.Element} Bubble tin nhắn (gửi đi hoặc nhận được).
 *
 * - isSent = item.from === "me": Xác định hướng bubble.
 * - Bubble gửi: alignSelf flex-end, màu ACCENT.
 * - Bubble nhận: alignSelf flex-start, màu SURFACE_MUTED.
 */
function renderChatMessage({ item }: ListRenderItemInfo<ChatMessage>) {
  const isSent = item.from === "me";

  return (
    <View
      style={[
        styles.messageBubble,
        isSent ? styles.messageBubbleSent : styles.messageBubbleReceived,
      ]}
    >
      <Text style={[styles.messageText, isSent && styles.messageTextSent]}>
        {item.body}
      </Text>
    </View>
  );
}

/**
 * ChatScreen — Component chính cho màn hình chat.
 *
 * State:
 * - friendId (từ useLocalSearchParams): ID của bạn bè để chat.
 * - insets (từ useSafeAreaInsets): Safe area insets.
 * - user (từ useUserStore): Thông tin user (accessToken, entitlementsToken, ...).
 * - chatStatus (từ useChatStore): Trạng thái kết nối chat service.
 * - friend (từ useChatStore): Thông tin bạn bè (gameName, tagLine, jid).
 * - messages (từ useChatStore): Danh sách tin nhắn cho friendId này.
 * - text (state, string): Nội dung input text hiện tại.
 * - sending (state, boolean): Đang gửi tin nhắn?
 * - sendError (state, string | null): Lỗi gửi tin nhắn (nếu có).
 * - historyRequestRef (useRef): Key để tránh request history trùng lặp.
 * - messageListRef (useRef<FlatList>): Tham chiếu đến FlatList để scroll.
 *
 * useEffect #1: Khi chatStatus === "disconnected", khởi tạo chat service.
 * useEffect #2: Khi chatStatus === "authenticated", request lịch sử chat.
 *
 * handleSend: Gửi tin nhắn qua sendChatMessage, reset input.
 *
 * displayName: Tên hiển thị của friend (Riot ID hoặc "Loading...").
 *
 * @returns {JSX.Element} Màn hình chat.
 */
export default function ChatScreen() {
  // Đọc friendId từ URL params
  const params = useLocalSearchParams<{ friendId: string | string[] }>();
  const friendId = Array.isArray(params.friendId)
    ? params.friendId[0]
    : params.friendId;
  const insets = useSafeAreaInsets();
  const user = useUserStore((state) => state.user);
  const chatStatus = useChatStore((state) => state.status);
  
  // Lấy thông tin bạn bè từ store
  const friend = useChatStore((state) =>
    friendId ? state.friends[friendId] : undefined
  );
  // Lấy tin nhắn của friend này
  const messages = useChatStore((state) =>
    friendId ? state.messages[friendId] || EMPTY_CHAT_MESSAGES : EMPTY_CHAT_MESSAGES
  );
  const [text, setText] = useState("");                     // Input text
  const [sending, setSending] = useState(false);             // Đang gửi
  const [sendError, setSendError] = useState<string | null>(null); // Lỗi gửi
  const historyRequestRef = React.useRef<string | null>(null);     // Chống request history trùng
  const messageListRef = React.useRef<FlatList>(null);             // Scroll ref

  // ── Effect 1: Kết nối chat service nếu đang disconnected ──
  React.useEffect(() => {
    if (
      !user.accessToken ||
      !user.entitlementsToken ||
      chatStatus !== "disconnected"
    ) {
      return;
    }

    const connectTimer = setTimeout(() => {
      void initChatService(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id
      );
    }, 0);

    return () => clearTimeout(connectTimer);
  }, [chatStatus, user.accessToken, user.entitlementsToken, user.region, user.id]);

  // ── Effect 2: Request lịch sử chat sau khi authenticated ──
  React.useEffect(() => {
    if (chatStatus !== "authenticated" || !friendId) {
      historyRequestRef.current = null;
      return;
    }

    const requestKey = `${friendId}:${friend?.jid || ""}`;
    if (historyRequestRef.current === requestKey) return;

    if (requestChatHistory(friend?.jid || friendId)) {
      historyRequestRef.current = requestKey;
    }
  }, [chatStatus, friend?.jid, friendId]);

  const refreshChat = React.useCallback(async () => {
    if (user.accessToken && user.entitlementsToken) {
      await initChatService(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id
      );
    }

    historyRequestRef.current = null;
    if (chatStatus === "authenticated" && friendId) {
      const requestKey = `${friendId}:${friend?.jid || ""}`;
      if (requestChatHistory(friend?.jid || friendId)) {
        historyRequestRef.current = requestKey;
      }
    }
  }, [chatStatus, friend?.jid, friendId, user]);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshChat);

  /**
   * handleSend — Xử lý gửi tin nhắn.
   * Trim text, kiểm tra hợp lệ, gọi sendChatMessage.
   */
  const handleSend = () => {
    const message = text.trim();
    if (!friendId || !message || sending) return;

    setSending(true);
    setSendError(null);
    try {
      sendChatMessage(friendId, message);
      setText(""); // Reset input sau khi gửi
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Could not send message"
      );
    } finally {
      setSending(false);
    }
  };

  // Tên hiển thị: "GameName#TagLine" hoặc "Loading..."
  const displayName = friend?.gameName && friend?.gameName !== "Unknown" 
    ? friend.tagLine
      ? `${friend.gameName}#${friend.tagLine}`
      : friend.gameName
    : "Loading Riot ID...";

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <View style={styles.headerIdentity}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          {/* Trạng thái kết nối */}
          <Text
            style={[
              styles.connectionStatus,
              chatStatus === "authenticated" && styles.connectionStatusReady,
              chatStatus === "error" && styles.connectionStatusError,
            ]}
          >
            {chatStatus === "authenticated"
              ? "Riot chat connected"
              : chatStatus === "error"
                ? "Reconnecting to Riot chat..."
                : "Connecting to Riot chat..."}
          </Text>
        </View>
      </View>

      {/* ── Danh sách tin nhắn ── */}
      <FlatList
        ref={messageListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderChatMessage}
        contentContainerStyle={styles.messageList}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        onContentSizeChange={() =>
          messageListRef.current?.scrollToEnd({ animated: messages.length > 1 })
        }
        inverted={false}
      />

      {/* ── Lỗi gửi tin nhắn ── */}
      {sendError ? (
        <Text style={styles.sendError}>{sendError}</Text>
      ) : null}

      {/* ── Input + Send button ── */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Send a message..."
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={chatStatus === "authenticated" && !sending}
        />
        <Pressable
          disabled={chatStatus !== "authenticated" || !text.trim() || sending}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            (chatStatus !== "authenticated" || !text.trim() || sending) &&
              styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Icon name="send" size={20} color={COLORS.PURE_WHITE} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
  },
  backButton: {
    marginRight: 16,
  },
  headerIdentity: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  connectionStatus: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    marginTop: 2,
  },
  connectionStatusReady: {
    color: COLORS.SUCCESS, // Xanh lá: đã kết nối
  },
  connectionStatusError: {
    color: COLORS.WARNING, // Cam: lỗi kết nối
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageBubbleReceived: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  messageBubbleSent: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.ACCENT,
  },
  messageText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
  },
  messageTextSent: {
    color: COLORS.PURE_WHITE,
  },
  sendError: {
    backgroundColor: COLORS.WARNING_SURFACE,
    color: COLORS.WARNING,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",      // Input + nút gửi nằm ngang
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.SURFACE_MUTED,
    color: COLORS.TEXT_PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4, // Làm mờ khi disabled
  },
  sendButtonPressed: {
    opacity: 0.78, // Hiệu ứng nhấn
  },
});
