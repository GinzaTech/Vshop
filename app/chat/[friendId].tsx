import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useChatStore } from "~/utils/chat-store";
import { sendChatMessage } from "~/utils/chat-service";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS } from "~/constants/DesignSystem";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen() {
  const params = useLocalSearchParams<{ friendId: string | string[] }>();
  const friendId = Array.isArray(params.friendId)
    ? params.friendId[0]
    : params.friendId;
  const insets = useSafeAreaInsets();
  
  const friend = useChatStore((state) =>
    friendId ? state.friends[friendId] : undefined
  );
  const messages = useChatStore((state) =>
    friendId ? state.messages[friendId] || [] : []
  );
  const [text, setText] = useState("");

  const handleSend = () => {
    if (friendId && text.trim()) {
      sendChatMessage(friendId, text.trim());
      setText("");
    }
  };

  const displayName = friend?.gameName && friend?.gameName !== "Unknown" 
    ? friend.tagLine
      ? `${friend.gameName}#${friend.tagLine}`
      : friend.gameName
    : friendId || "";

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayName}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble, 
            item.from === "me" ? styles.messageBubbleSent : styles.messageBubbleReceived
          ]}>
            <Text style={styles.messageText}>{item.body}</Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
        inverted={false}
      />

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Send a message..."
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
          <Icon name="send" size={20} color={COLORS.PURE_WHITE} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
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
  inputContainer: {
    flexDirection: "row",
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
});
