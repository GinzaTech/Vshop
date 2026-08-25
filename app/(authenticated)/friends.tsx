// ===== Import thư viện =====
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

import { useUserStore } from "~/hooks/useUserStore";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { useChatStore, type ChatFriend } from "~/utils/chat-store";
import { refreshFriendsRoster } from "~/utils/chat-service";
import { router, useFocusEffect, useNavigation } from "expo-router";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { filterFriendsByRiotId } from "~/utils/friend-search";

// FriendStateInfo: thông tin hiển thị cho trạng thái của bạn bè
type FriendStateInfo = { icon: ComponentProps<typeof Icon>["name"]; color: string; label: string };

// STATE_ICONS: mapping trạng thái → icon, màu sắc, label
const STATE_ICONS: Record<string, FriendStateInfo> = {
  chat: { icon: "account-check", color: COLORS.SUCCESS, label: "friends_page.in_menu" },
  dnd: { icon: "bell-off", color: COLORS.STATUS_BUSY, label: "friends_page.dnd" },
  away: { icon: "clock-outline", color: COLORS.STATUS_AWAY, label: "friends_page.idle" },
  mobile: { icon: "cellphone", color: COLORS.STATUS_INFO, label: "friends_page.mobile" },
  offline: { icon: "account-off-outline", color: COLORS.TEXT_SECONDARY, label: "friends_page.offline" },
};

// FRIEND_STATE_ORDER: thứ tự sắp xếp bạn bè theo trạng thái
const FRIEND_STATE_ORDER: Record<string, number> = { chat: 0, mobile: 0, away: 1, offline: 2, dnd: 3 };

// Component FriendsScreen: hiển thị danh sách bạn bè (Riot Friends) với trạng thái online/offline
export default function FriendsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  // Lấy dữ liệu từ store
  const friendsObj = useChatStore((state) => state.friends); // Object bạn bè {id: ChatFriend}
  const status = useChatStore((state) => state.status);      // Trạng thái kết nối chat
  const [loadingRoster, setLoadingRoster] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchVisible, setSearchVisible] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            setSearchVisible((visible) => {
              if (visible) setSearchQuery("");
              return !visible;
            });
          }}
          style={({ pressed }) => [
            styles.searchHeaderButton,
            pressed && styles.friendRowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            searchVisible
              ? t("friends_page.close_search")
              : t("friends_page.open_search")
          }
        >
          <Icon
            name={searchVisible ? "close" : "magnify"}
            size={24}
            color={COLORS.TEXT_PRIMARY}
          />
        </Pressable>
      ),
    });
  }, [navigation, searchVisible, t]);

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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleFriends = React.useMemo(
    () => filterFriendsByRiotId(friends, normalizedSearchQuery),
    [friends, normalizedSearchQuery],
  );

  const refreshFriends = React.useCallback(async () => {
    const latestUser = useUserStore.getState().user;
    if (
      !latestUser.accessToken ||
      !latestUser.entitlementsToken ||
      !latestUser.region ||
      !latestUser.id
    ) {
      throw new Error(t("friends_page.connection_error"));
    }

    await refreshFriendsRoster({
      accessToken: latestUser.accessToken,
      entitlementsToken: latestUser.entitlementsToken,
      region: latestUser.region,
      userId: latestUser.id,
    });
  }, [t]);

  // Mỗi lần điều hướng vào Bạn bè đều yêu cầu roster mới. Không xoá cache cũ
  // trong lúc tải để tránh màn hình trống khi mạng chập chờn.
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setLoadingRoster(true);
      setLoadError(null);

      void refreshFriends()
        .catch(() => {
          if (active) setLoadError(t("friends_page.connection_error"));
        })
        .finally(() => {
          if (active) setLoadingRoster(false);
        });

      return () => {
        active = false;
      };
    }, [refreshFriends, t])
  );

  const { refreshing, onRefresh } = useAsyncRefresh(refreshFriends);
  const retryFriends = React.useCallback(() => {
    setLoadingRoster(true);
    setLoadError(null);
    void refreshFriends()
      .catch(() => setLoadError(t("friends_page.connection_error")))
      .finally(() => setLoadingRoster(false));
  }, [refreshFriends, t]);

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
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, ${item.status ? item.status : t(stateInfo.label)}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
          <View style={[styles.statusDot, { backgroundColor: stateInfo.color }]} />
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.friendStatus}>{item.status ? item.status : t(stateInfo.label)}</Text>
        </View>
        {/* Icon trạng thái */}
        <Icon name={stateInfo.icon} size={18} color={stateInfo.color} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      {searchVisible ? (
        <View style={styles.searchBar}>
          <Icon name="magnify" size={22} color={COLORS.TEXT_SECONDARY} />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("friends_page.search_placeholder")}
            placeholderTextColor={COLORS.TEXT_SECONDARY}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("friends_page.search_placeholder")}
          />
          {searchQuery ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              style={({ pressed }) => [
                styles.clearSearchButton,
                pressed && styles.friendRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("friends_page.clear_search")}
            >
              <Icon name="close-circle" size={20} color={COLORS.TEXT_SECONDARY} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <FlatList
        data={visibleFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={[
          styles.listContent,
          visibleFriends.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            {normalizedSearchQuery ? (
              <>
                <Icon name="account-search-outline" size={48} color={COLORS.TEXT_SECONDARY} />
                <Text style={styles.emptyTitle}>{t("friends_page.search_empty_title")}</Text>
                <Text style={styles.emptySubtitle}>
                  {t("friends_page.search_empty_subtitle", { query: searchQuery.trim() })}
                </Text>
              </>
            ) : loadingRoster || status === "connecting" ? (
              <>
                <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
                <Text style={styles.loadingText}>{t("friends_page.loading")}</Text>
              </>
            ) : (
              <>
                <Icon
                  name={loadError ? "wifi-alert" : "account-group-outline"}
                  size={48}
                  color={COLORS.TEXT_SECONDARY}
                />
                <Text style={styles.emptyTitle}>
                  {loadError ?? t("friends_page.empty_title")}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {loadError
                    ? t("friends_page.connection_subtitle")
                    : t("friends_page.empty_subtitle")}
                </Text>
                {loadError ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.friendRowPressed,
                    ]}
                    onPress={retryFriends}
                    accessibilityRole="button"
                    accessibilityLabel={t("friends_page.retry")}
                  >
                    <Text style={styles.retryButtonText}>{t("friends_page.retry")}</Text>
                  </Pressable>
                ) : null}
              </>
            )}
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
  searchHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    minHeight: 52,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 26,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
  },
  clearSearchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 12, color: COLORS.TEXT_SECONDARY, fontSize: 14 },
  // Danh sách: padding ngang 20, trên 8, dưới 140
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1 },
  // Hàng bạn bè: hàng ngang, gap 12, có borderBottom
  friendRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  friendRowPressed: { opacity: 0.72 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED },
  avatarText: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: "800" },
  statusDot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: COLORS.BACKGROUND },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  friendStatus: { marginTop: 2, fontSize: 12, color: COLORS.TEXT_SECONDARY },
  // Empty card
  emptyCard: { padding: 32, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  emptySubtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: "center", lineHeight: 20 },
  retryButton: { marginTop: 4, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ACCENT },
  retryButtonText: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: "800" },
});
