// ===== Import thư viện =====
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

import { useUserStore } from "~/hooks/useUserStore";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { useChatStore, type ChatFriend } from "~/utils/chat-store";
import { initChatService } from "~/utils/chat-service";
import { router } from "expo-router";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";

// FriendStateInfo: thông tin hiển thị cho trạng thái của bạn bè
type FriendStateInfo = { icon: ComponentProps<typeof Icon>["name"]; color: string; label: string };

// STATE_ICONS: mapping trạng thái → icon, màu sắc, label
const STATE_ICONS: Record<string, FriendStateInfo> = {
  chat: { icon: "account-check", color: "#4ade80", label: "friends_page.in_menu" },
  dnd: { icon: "bell-off", color: "#f87171", label: "friends_page.dnd" },
  away: { icon: "clock-outline", color: "#fbbf24", label: "friends_page.idle" },
  mobile: { icon: "cellphone", color: "#60a5fa", label: "friends_page.mobile" },
  offline: { icon: "account-off-outline", color: COLORS.TEXT_SECONDARY, label: "friends_page.offline" },
};

// FRIEND_STATE_ORDER: thứ tự sắp xếp bạn bè theo trạng thái
const FRIEND_STATE_ORDER: Record<string, number> = { chat: 0, mobile: 0, away: 1, offline: 2, dnd: 3 };

// Component FriendsScreen: hiển thị danh sách bạn bè (Riot Friends) với trạng thái online/offline
export default function FriendsScreen() {
  const { t } = useTranslation();

  // Lấy dữ liệu từ store
  const friendsObj = useChatStore((state) => state.friends); // Object bạn bè {id: ChatFriend}
  const status = useChatStore((state) => state.status);      // Trạng thái kết nối chat
  const user = useUserStore((state) => state.user);           // Thông tin user

  // friends: mảng bạn bè đã sắp xếp (memoized)
  // Thứ tự: online (chat/mobile) → away → offline → dnd
  // Cùng trạng thái thì sort theo tên alphabet
  const friends = React.useMemo(
    () =>
      Object.values(friendsObj).sort((left, right) => {
        const leftOrder = FRIEND_STATE_ORDER[left.show] ?? 2;
        const rightOrder = FRIEND_STATE_ORDER[right.show] ?? 2;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        const leftName = left.gameName && left.gameName !== "Unknown" ? left.gameName : "\uffff";
        const rightName = right.gameName && right.gameName !== "Unknown" ? right.gameName : "\uffff";
        return leftName.localeCompare(rightName);
      }),
    [friendsObj]
  );

  // useEffect: tự động kết nối chat service khi component mount
  // Chỉ kết nối nếu có accessToken và status là "disconnected"
  React.useEffect(() => {
    if (!user?.accessToken || !user?.entitlementsToken || status !== "disconnected") return;
    const connectTimer = setTimeout(() => {
      void initChatService(user.accessToken, user.entitlementsToken, user.region, user.id);
    }, 0);
    return () => clearTimeout(connectTimer);
  }, [status, user.accessToken, user.entitlementsToken, user.region, user.id]);

  const refreshFriends = React.useCallback(async () => {
    await fullBackgroundSync(true);
    const latestUser = useUserStore.getState().user;
    if (latestUser.accessToken && latestUser.entitlementsToken) {
      await initChatService(
        latestUser.accessToken,
        latestUser.entitlementsToken,
        latestUser.region,
        latestUser.id
      );
    }
  }, []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshFriends);

  // renderFriend: render một hàng bạn bè (chấm trạng thái, tên, status text, icon)
  const renderFriend = ({ item }: { item: ChatFriend }) => {
    const displayName = item.gameName && item.gameName !== "Unknown"
      ? item.tagLine ? `${item.gameName}#${item.tagLine}` : item.gameName
      : t("friends_page.loading");

    // Xác định thông tin trạng thái dựa trên item.show
    let stateInfo = STATE_ICONS.offline;
    if (item.show === "chat") stateInfo = STATE_ICONS.chat;
    if (item.show === "dnd") stateInfo = STATE_ICONS.dnd;
    if (item.show === "away") stateInfo = STATE_ICONS.away;
    if (item.show === "mobile") stateInfo = STATE_ICONS.mobile;

    return (
      // Pressable: khi nhấn vào → mở chat với bạn đó
      <Pressable
        style={({ pressed }) => [styles.friendRow, pressed && styles.friendRowPressed]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        {/* Chấm trạng thái: màu theo stateInfo */}
        <View style={[styles.statusDot, { backgroundColor: stateInfo.color }]} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.friendStatus}>{item.status ? item.status : t(stateInfo.label)}</Text>
        </View>
        {/* Icon trạng thái */}
        <Icon name={stateInfo.icon} size={18} color={stateInfo.color} />
      </Pressable>
    );
  };

  // Nếu đang kết nối → spinner
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
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={[
          styles.listContent,
          friends.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            <Icon name="account-group-outline" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyTitle}>{t("friends_page.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>{t("friends_page.empty_subtitle")}</Text>
          </GlassCard>
        }
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ===== StyleSheet =====
const styles = StyleSheet.create({
  // Màn hình: nền tối
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  // Centered (loading): canh giữa
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.BACKGROUND },
  loadingText: { marginTop: 12, color: COLORS.TEXT_SECONDARY, fontSize: 14 },
  // Danh sách: padding ngang 20, trên 8, dưới 140
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 140 },
  listContentEmpty: { flexGrow: 1 },
  // Hàng bạn bè: hàng ngang, gap 12, có borderBottom
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  friendRowPressed: { opacity: 0.72 },
  // Chấm trạng thái: 10x10, hình tròn
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  friendStatus: { marginTop: 2, fontSize: 12, color: COLORS.TEXT_SECONDARY },
  // Empty card
  emptyCard: { padding: 32, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  emptySubtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: "center", lineHeight: 20 },
});
