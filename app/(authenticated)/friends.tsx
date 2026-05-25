import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

import { useUserStore } from "~/hooks/useUserStore";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { useChatStore } from "~/utils/chat-store";
import { initChatService } from "~/utils/chat-service";
import { router } from "expo-router";

type FriendStateInfo = {
  icon: ComponentProps<typeof Icon>["name"];
  color: string;
  label: string;
};

const STATE_ICONS: Record<string, FriendStateInfo> = {
  chat: { icon: "account-check", color: "#4ade80", label: "friends_page.in_menu" },
  dnd: { icon: "bell-off", color: "#f87171", label: "friends_page.dnd" },
  away: { icon: "clock-outline", color: "#fbbf24", label: "friends_page.idle" },
  mobile: { icon: "cellphone", color: "#60a5fa", label: "friends_page.mobile" },
};

const FRIEND_STATE_ORDER: Record<string, number> = {
  chat: 0,
  mobile: 0,
  away: 1,
  offline: 2,
  dnd: 3,
};

export default function FriendsScreen() {
  const { t } = useTranslation();

  const friendsObj = useChatStore((state) => state.friends);
  const status = useChatStore((state) => state.status);
  const user = useUserStore((state) => state.user);
  const chatInitKeyRef = React.useRef<string | null>(null);

  const friends = React.useMemo(
    () =>
      Object.values(friendsObj).sort((left, right) => {
        const leftOrder = FRIEND_STATE_ORDER[left.show] ?? 2;
        const rightOrder = FRIEND_STATE_ORDER[right.show] ?? 2;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        const leftName =
          left.gameName && left.gameName !== "Unknown" ? left.gameName : left.id;
        const rightName =
          right.gameName && right.gameName !== "Unknown" ? right.gameName : right.id;

        return leftName.localeCompare(rightName);
      }),
    [friendsObj]
  );

  React.useEffect(() => {
    // Only init if not already connecting/connected
    if (
      status === "disconnected" &&
      user?.accessToken &&
      user?.entitlementsToken
    ) {
      const chatInitKey = [
        user.id,
        user.region,
        user.accessToken,
        user.entitlementsToken,
      ].join("|");

      if (chatInitKeyRef.current === chatInitKey) {
        return;
      }

      chatInitKeyRef.current = chatInitKey;
      initChatService(user.accessToken, user.entitlementsToken, user.region);
    }
  }, [status, user]);

  const renderFriend = ({ item }: { item: any }) => {
    const displayName = item.gameName && item.gameName !== "Unknown"
      ? item.tagLine
        ? `${item.gameName}#${item.tagLine}`
        : item.gameName
      : item.id;
      
    // Determine state info based on show/status
    let stateInfo = STATE_ICONS.away;
    if (item.show === "chat") stateInfo = STATE_ICONS.chat;
    if (item.show === "dnd") stateInfo = STATE_ICONS.dnd;
    if (item.show === "mobile") stateInfo = STATE_ICONS.mobile;

    return (
      <TouchableOpacity 
        style={styles.friendRow} 
        activeOpacity={0.7}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        <View
          style={[styles.statusDot, { backgroundColor: stateInfo.color }]}
        />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.friendStatus}>
            {item.status ? item.status : t(stateInfo.label)}
          </Text>
        </View>
        <Icon name={stateInfo.icon} size={18} color={stateInfo.color} />
      </TouchableOpacity>
    );
  };

  if (status === "connecting") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>Connecting to Chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerContent}>
        <Text style={styles.title}>{t("friends_page.title")}</Text>
        <Text style={styles.subtitle}>{t("friends_page.subtitle")}</Text>
      </View>

      {friends.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Icon
            name="account-group-outline"
            size={48}
            color={COLORS.TEXT_SECONDARY}
          />
          <Text style={styles.emptyTitle}>
            {t("friends_page.empty_title")}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t("friends_page.empty_subtitle")}
          </Text>
        </GlassCard>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriend}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  loadingText: {
    marginTop: 12,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  friendStatus: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  emptyCard: {
    marginHorizontal: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
});
