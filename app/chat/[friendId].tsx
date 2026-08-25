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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useUserStore } from "~/hooks/useUserStore";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

const COMPOSER_MIN_HEIGHT = 48;
const COMPOSER_MAX_HEIGHT = 120;

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
  const insets = useSafeAreaInsets();
  // Đọc friendId từ URL params
  const params = useLocalSearchParams<{ friendId: string | string[] }>();
  const friendId = Array.isArray(params.friendId)
    ? params.friendId[0]
    : params.friendId;
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
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN_HEIGHT);
  const [sending, setSending] = useState(false);             // Đang gửi
  const [sendError, setSendError] = useState<string | null>(null); // Lỗi gửi
  const historyRequestRef = React.useRef<string | null>(null);     // Chống request history trùng
  const messageListRef = React.useRef<FlatList<ChatMessage>>(null); // Scroll ref
  const previousMessageCountRef = React.useRef(messages.length);

  // ── Effect 1: Kết nối hoặc dựng lại chat service nếu socket đang lỗi ──
  React.useEffect(() => {
    if (
      !user.accessToken ||
      !user.entitlementsToken ||
      chatStatus !== "disconnected" &&
      chatStatus !== "error"
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

  React.useEffect(() => {
    if (messages.length === previousMessageCountRef.current) {
      return;
    }

    previousMessageCountRef.current = messages.length;
    const frame = requestAnimationFrame(() => {
      messageListRef.current?.scrollToEnd({ animated: messages.length > 1 });
    });

    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

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
      setInputHeight(COMPOSER_MIN_HEIGHT);
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

  const canSend = chatStatus === "authenticated" && Boolean(text.trim()) && !sending;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
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
        <View style={styles.messageRegion}>
          <FlatList
            ref={messageListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderChatMessage}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            ListEmptyComponent={
              <View style={styles.emptyState} accessibilityLiveRegion="polite">
                <Text style={styles.emptyStateTitle}>No messages yet</Text>
                <Text style={styles.emptyStateText}>Start a conversation with this friend.</Text>
              </View>
            }
            refreshControl={
              <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            alwaysBounceVertical
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            testID="chat-message-list"
          />
        </View>

      {/* ── Lỗi gửi tin nhắn ── */}
      {sendError ? (
        <Text style={styles.sendError}>{sendError}</Text>
      ) : null}

      {/* ── Input + Send button ── */}
        <View style={styles.inputContainer} testID="chat-composer">
        <TextInput
          style={[styles.input, { height: inputHeight }]}
          value={text}
          onChangeText={setText}
          onContentSizeChange={(event) => {
            const nextHeight = Math.max(
              COMPOSER_MIN_HEIGHT,
              Math.min(COMPOSER_MAX_HEIGHT, event.nativeEvent.contentSize.height),
            );
            setInputHeight((currentHeight) =>
              currentHeight === nextHeight ? currentHeight : nextHeight,
            );
          }}
          placeholder="Send a message..."
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          multiline
          scrollEnabled={inputHeight >= COMPOSER_MAX_HEIGHT}
          textAlignVertical={inputHeight > COMPOSER_MIN_HEIGHT ? "top" : "center"}
          editable={chatStatus === "authenticated" && !sending}
          accessibilityLabel="Message"
        />
        <Pressable
          disabled={!canSend}
          onPress={handleSend}
          android_ripple={{ color: COLORS.GLASS_WHITE_DIM }}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.sendButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{
            disabled: !canSend,
          }}
        >
          <View
            pointerEvents="none"
            style={styles.sendButtonSurface}
          >
            <Icon
              name="send"
              size={20}
              color={COLORS.PURE_WHITE}
            />
          </View>
        </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
  },
  backButton: {
    width: 44,
    height: 44,
    marginRight: 8,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  connectionStatus: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },
  connectionStatusReady: {
    color: COLORS.SUCCESS, // Xanh lá: đã kết nối
  },
  connectionStatusError: {
    color: COLORS.WARNING, // Cam: lỗi kết nối
  },
  messageRegion: {
    flex: 1,
    minHeight: 0,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyStateText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    marginBottom: 8,
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
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: COMPOSER_MAX_HEIGHT,
    backgroundColor: COLORS.SURFACE_MUTED,
    color: COLORS.TEXT_PRIMARY,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  sendButtonSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    backgroundColor: COLORS.PURE_BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonPressed: {
    opacity: 0.78, // Hiệu ứng nhấn
  },
});
