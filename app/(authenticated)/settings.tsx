// 📦 settings.tsx – Màn hình Cài đặt (Settings)
// Cho phép người dùng quản lý tài khoản, ngôn ngữ, thông báo, các shortcut tính năng,
// kiểm tra cập nhật, và các liên kết hữu ích

import React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Switch,
  Text,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUserStore } from "~/hooks/useUserStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { initBackgroundFetch, stopBackgroundFetch } from "~/utils/wishlist";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import BatteryOptimizationWarning from "~/components/BatteryOptimizationWarning";
import GlassCard from "~/components/ui/GlassCard";
import UpdatePopup from "~/components/popups/UpdatePopup";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { clearAllCookies } from "~/utils/cookies";
import {
  AppUpdateCheckResult,
  applyOtaUpdate,
  checkForAppUpdate,
} from "~/utils/app-update";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";
import { hasReusableAccessToken } from "~/utils/auth-session";
import { disconnectChatService } from "~/utils/chat-service";
import { switchSavedAccount } from "~/services/accounts/session";
import {
  normalizeAccountId,
  toSavedAccount,
  type SavedAccount,
} from "~/utils/saved-accounts";
import { getPrimaryTabContentBottomPadding } from "~/constants/Layout";

/**
 * Settings – Component chính hiển thị trang cài đặt
 * Gồm: shortcut grid, preferences (ngôn ngữ, thông báo, screenshot mode),
 * links (Discord, credits, privacy), account (copy ID, logout), và update popup
 */
function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // User store: thông tin user + hàm reset
  const user = useUserStore((state) => state.user);
  const resetUser = useUserStore((state) => state.resetUser);
  const savedAccounts = useAccountStore((state) => state.accounts);
  const saveAccount = useAccountStore((state) => state.saveAccount);
  const removeAccount = useAccountStore((state) => state.removeAccount);
  const clearAccounts = useAccountStore((state) => state.clearAccounts);
  // Feature store: screenshot mode
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);
  const toggleScreenshotMode = useFeatureStore((state) => state.toggleScreenshotMode);
  // Wishlist store: trạng thái thông báo
  const notificationEnabled = useWishlistStore((state) => state.notificationEnabled);
  const setNotificationEnabled = useWishlistStore(
    (state) => state.setNotificationEnabled
  );

  // State: popup kiểm tra cập nhật
  const [updatePopupVisible, setUpdatePopupVisible] = React.useState(false);
  // State: đang kiểm tra cập nhật
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  // State: đang áp dụng cập nhật OTA
  const [applyingUpdate, setApplyingUpdate] = React.useState(false);
  // State: kết quả kiểm tra cập nhật
  const [updateResult, setUpdateResult] =
    React.useState<AppUpdateCheckResult | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = React.useState<
    string | null
  >(null);
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  const accountRows = React.useMemo(() => {
    const currentId = normalizeAccountId(user.id);
    const hasCurrentAccount = savedAccounts.some(
      (account) => normalizeAccountId(account.id) === currentId
    );
    const rows: SavedAccount[] =
      currentId && !hasCurrentAccount && user.accessToken
        ? [toSavedAccount(user, 0), ...savedAccounts]
        : savedAccounts;

    return [...rows].sort((left, right) => {
      const leftIsCurrent = normalizeAccountId(left.id) === currentId;
      const rightIsCurrent = normalizeAccountId(right.id) === currentId;
      if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
      return right.lastUsedAt - left.lastUsedAt;
    });
  }, [savedAccounts, user]);

  /**
   * handleLogout – Xử lý đăng xuất: xóa cookies, reset user, dừng background fetch,
   * tắt thông báo, chuyển về màn hình setup
   */
  const handleLogout = async () => {
    await clearAllCookies(true);
    await AsyncStorage.removeItem("region");
    disconnectChatService();
    clearAccounts();
    resetUser();
    stopBackgroundFetch();
    setNotificationEnabled(false);
    router.replace("/setup");
  };

  const handleAddAccount = async () => {
    if (user.id && user.accessToken) {
      saveAccount(user, true);
    }
    disconnectChatService();
    await clearAllCookies(true);
    router.push({ pathname: "/reauth", params: { mode: "add" } });
  };

  const handleSwitchAccount = async (accountId: string) => {
    if (
      normalizeAccountId(accountId) === normalizeAccountId(user.id) ||
      switchingAccountId
    ) {
      return;
    }

    setSwitchingAccountId(accountId);
    try {
      const result = await switchSavedAccount(accountId);
      if (result.kind === "switched") {
        router.replace("/profile");
        return;
      }

      if (result.kind === "reauth-required") {
        router.push({
          pathname: "/reauth",
          params: { mode: "switch", accountId },
        });
        return;
      }

      if (result.kind === "failed") {
        Alert.alert(
          t("settings_page.accounts.switch_failed_title"),
          t("settings_page.accounts.switch_failed_description")
        );
      }
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const confirmRemoveAccount = (account: SavedAccount) => {
    Alert.alert(
      t("settings_page.accounts.remove_title"),
      t("settings_page.accounts.remove_description", {
        account: `${account.name}#${account.tagLine}`,
      }),
      [
        { text: t("settings_page.accounts.cancel"), style: "cancel" },
        {
          text: t("settings_page.accounts.remove"),
          style: "destructive",
          onPress: () => removeAccount(account.id),
        },
      ]
    );
  };

  /**
   * toggleNotificationState – Bật/tắt thông báo wishlist
   * Khi bật: yêu cầu quyền thông báo, khởi tạo background fetch
   * Khi tắt: dừng background fetch
   */
  const toggleNotificationState = async () => {
    if (!notificationEnabled) {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.granted) {
        await initBackgroundFetch();
        setNotificationEnabled(true);
        if (Platform.OS === "android") {
          ToastAndroid.show(t("wishlist.notification.enabled"), ToastAndroid.LONG);
        }
      } else if (Platform.OS === "android") {
        ToastAndroid.show(t("wishlist.notification.no_permission"), ToastAndroid.LONG);
      }
    } else {
      await stopBackgroundFetch();
      setNotificationEnabled(false);
      if (Platform.OS === "android") {
        ToastAndroid.show(t("wishlist.notification.disabled"), ToastAndroid.LONG);
      }
    }
  };

  /**
   * handleCheckForUpdates – Mở popup kiểm tra cập nhật
   */
  const handleCheckForUpdates = async () => {
    setUpdatePopupVisible(true);
    setCheckingUpdate(true);

    try {
      const result = await checkForAppUpdate();
      setUpdateResult(result);
    } finally {
      setCheckingUpdate(false);
    }
  };

  /**
   * handleUpdatePrimaryAction – Xử lý hành động chính trong popup cập nhật
   * Nếu có OTA: áp dụng OTA update; nếu không: mở link release
   */
  const handleUpdatePrimaryAction = async () => {
    if (!updateResult) return;

    if (updateResult.kind === "ota-available") {
      setApplyingUpdate(true);

      const applyResult = await applyOtaUpdate();
      if (!applyResult.applied) {
        setUpdateResult({
          kind: "error",
          currentVersion: updateResult.currentVersion,
          latestVersion: updateResult.latestVersion,
          releaseUrl: updateResult.releaseUrl,
          environment: updateResult.environment,
          canUseOta: updateResult.canUseOta,
          channel: updateResult.channel,
          message: applyResult.message,
        });
        setApplyingUpdate(false);
      }
      return;
    }

    await Linking.openURL(updateResult.releaseUrl);
    setUpdatePopupVisible(false);
  };

  // Danh sách các shortcut (lối tắt) đến các tính năng chính
  const shortcutItems: {
    key: string;
    label: string | undefined;
    icon: React.ComponentProps<typeof Icon>["name"];
    route?: string;
    onPress?: () => void;
  }[] = [
    { key: "equip", label: t("equip"), icon: "shield-sword-outline", route: "/equip" },
    { key: "accessories", label: t("accessories"), icon: "cards-outline", route: "/accessories" },
    { key: "gallery", label: t("gallery"), icon: "image-multiple-outline", route: "/gallery" },
    { key: "agent", label: t("agent"), icon: "account-group-outline", route: "/agent" },
    { key: "combat", label: t("combat"), icon: "target", route: "/combat" },
    { key: "history", label: t("history"), icon: "history", route: "/history" },
    { key: "crosshair", label: t("crosshair"), icon: "crosshairs-gps", route: "/crosshair" },
    { key: "leaderboard", label: t("leaderboard_page.title"), icon: "podium", route: "/leaderboard" },
    { key: "friends", label: t("friends_page.title"), icon: "account-group-outline", route: "/friends" },
    {
      key: "update",
      label: t("settings_page.check_update"),
      icon: "update",
      onPress: handleCheckForUpdates,
    },
  ];

  /**
   * renderRow – Render một hàng trong card cài đặt
   * @param icon – Tên icon
   * @param title – Tiêu đề
   * @param description – Mô tả (tùy chọn)
   * @param onPress – Hàm xử lý khi bấm
   * @param right – Component bên phải (tùy chọn, mặc định là chevron)
   * @param danger – Nếu true thì icon nền đỏ
   * @param compact – Nếu true thì thu nhỏ kích thước
   */
  const renderRow = ({
    icon,
    title,
    description,
    onPress,
    right,
    danger,
    compact,
  }: {
    icon: React.ComponentProps<typeof Icon>["name"];
    title: string;
    description?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
    compact?: boolean;
  }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.row, compact && styles.rowCompact]}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !onPress }}
    >
      <View style={[styles.rowLeft, compact && styles.rowLeftCompact]}>
        <View
          style={[
            styles.rowIcon,
            compact && styles.rowIconCompact,
            danger && styles.rowIconDanger,
          ]}
        >
          <Icon
            name={icon}
            size={compact ? 16 : 18}
            color={danger ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, compact && styles.rowTitleCompact]}>
            {title}
          </Text>
          {description ? (
            <Text style={[styles.rowDescription, compact && styles.rowDescriptionCompact]}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      {right ?? <Icon name="chevron-right" size={20} color={COLORS.TEXT_SECONDARY} />}
    </TouchableOpacity>
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: getPrimaryTabContentBottomPadding(insets.bottom) },
        ]}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: tiêu đề */}
        <View style={styles.hero}>
          <Text style={styles.title}>{t("settings_page.title")}</Text>
        </View>

        {/* Cảnh báo tối ưu pin Android */}
        <BatteryOptimizationWarning />

        {/* Grid các shortcut tính năng */}
        <View style={styles.shortcutGrid}>
          {shortcutItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              testID={`settings-shortcut-${item.key}`}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              activeOpacity={0.85}
              style={styles.shortcutCard}
              onPress={() => {
                if (item.onPress) {
                  item.onPress();
                  return;
                }

                if (item.route) {
                  router.push(item.route as never);
                }
              }}
            >
              <View style={styles.shortcutIcon}>
                <Icon name={item.icon} size={20} color={COLORS.TEXT_PRIMARY} />
              </View>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Preferences: ngôn ngữ, thông báo, screenshot mode */}
        <Text style={styles.sectionTitle}>{t("settings_page.preferences")}</Text>
        <GlassCard style={styles.card}>
          {renderRow({
            icon: "translate",
            title: t("language"),
            onPress: () => router.push("/language"),
          })}
          {Platform.OS === "android"
            ? renderRow({
                icon: "cellphone-message",
                title: t("wishlist.notification.name"),
                description: t("wishlist.notification.info"),
                onPress: toggleNotificationState,
                right: (
                  <Switch
                    value={notificationEnabled}
                    onValueChange={toggleNotificationState}
                    color={COLORS.PURE_BLACK}
                  />
                ),
              })
            : null}
          {__DEV__
            ? renderRow({
                icon: "cellphone-screenshot",
                title: t("screenshot_mode"),
                onPress: toggleScreenshotMode,
                right: (
                  <Switch
                    value={screenshotModeEnabled}
                    onValueChange={toggleScreenshotMode}
                    color={COLORS.PURE_BLACK}
                  />
                ),
              })
            : null}
        </GlassCard>

        {/* Section Links: Discord, credits, privacy, xóa tài khoản */}
        <Text style={styles.sectionTitle}>{t("settings_page.links")}</Text>
        <GlassCard style={styles.card}>
          {renderRow({
            icon: "forum-outline",
            title: t("discord_server"),
            onPress: () => Linking.openURL("https://discord.gg/gB2nM6vKrD"),
          })}
          {renderRow({
            icon: "information-outline",
            title: t("credits"),
            onPress: () => Linking.openURL("https://vshop.one/credits"),
          })}
          {renderRow({
            icon: "shield-check-outline",
            title: t("privacy_policy"),
            onPress: () => Linking.openURL("https://vshop.one/privacy"),
          })}
          {renderRow({
            icon: "account-remove-outline",
            title: t("delete_account"),
            onPress: () =>
              Linking.openURL(
                "https://support-valorant.riotgames.com/hc/en-us/articles/360050328414-Deleting-Your-Riot-Account-and-All-Your-Data"
              ),
          })}
        </GlassCard>

        {/* Saved account list: current account first, then recent accounts */}
        <View style={styles.sectionHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitleInline}>
            {t("settings_page.accounts.logged_in")}
          </Text>
          <View
            accessible
            accessibilityRole="text"
            style={styles.accountCountBadge}
            accessibilityLabel={t("settings_page.accounts.logged_in_count", {
              count: accountRows.length,
            })}
          >
            <Text style={styles.accountCountText}>{accountRows.length}</Text>
          </View>
        </View>
        <GlassCard style={styles.card}>
          {accountRows.map((account) => {
            const isCurrent =
              normalizeAccountId(account.id) === normalizeAccountId(user.id);
            const isSwitching = switchingAccountId === account.id;
            const sessionReady = hasReusableAccessToken(account.accessToken);
            const displayName = account.name
              ? `${account.name}#${account.tagLine}`
              : account.id;

            return (
              <View key={account.id} style={styles.accountRow}>
                <TouchableOpacity
                  activeOpacity={isCurrent ? 1 : 0.82}
                  disabled={isCurrent || Boolean(switchingAccountId)}
                  onPress={() => void handleSwitchAccount(account.id)}
                  style={styles.accountMain}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings_page.accounts.switch_to", {
                    account: displayName,
                  })}
                  accessibilityState={{
                    disabled: isCurrent || Boolean(switchingAccountId),
                    selected: isCurrent,
                    busy: isSwitching,
                  }}
                >
                  <View
                    style={[
                      styles.accountAvatar,
                      isCurrent && styles.accountAvatarCurrent,
                    ]}
                  >
                    <Icon
                      name="account-outline"
                      size={21}
                      color={isCurrent ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
                    />
                  </View>
                  <View style={styles.accountCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text style={styles.rowDescription} numberOfLines={1}>
                      {isCurrent
                        ? t("settings_page.accounts.current", {
                            region: account.region.toUpperCase(),
                          })
                        : sessionReady
                          ? t("settings_page.accounts.ready", {
                              region: account.region.toUpperCase(),
                            })
                          : t("settings_page.accounts.login_required", {
                              region: account.region.toUpperCase(),
                            })}
                    </Text>
                  </View>
                  {isSwitching ? (
                    <ActivityIndicator size="small" color={COLORS.TEXT_PRIMARY} />
                  ) : isCurrent ? (
                    <Icon name="check-circle" size={22} color={COLORS.SUCCESS} />
                  ) : (
                    <Icon name="swap-horizontal" size={22} color={COLORS.TEXT_SECONDARY} />
                  )}
                </TouchableOpacity>
                {!isCurrent ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => confirmRemoveAccount(account)}
                    disabled={Boolean(switchingAccountId)}
                    style={styles.removeAccountButton}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings_page.accounts.remove_account", {
                      account: displayName,
                    })}
                  >
                    <Icon name="close" size={20} color={COLORS.TEXT_SECONDARY} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </GlassCard>

        {/* Account management actions */}
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t("settings_page.accounts.manage")}
        </Text>
        <GlassCard style={styles.card}>
          {renderRow({
            icon: "account-plus-outline",
            title: t("settings_page.accounts.add"),
            description: t("settings_page.accounts.add_description"),
            onPress: () => void handleAddAccount(),
          })}
          {renderRow({
            icon: "content-copy",
            title: t("copy_riot_id"),
            description: user.id,
            onPress: () => Clipboard.setStringAsync(user.id),
          })}
          {renderRow({
            icon: "logout",
            title: t("settings_page.accounts.logout_all"),
            onPress: handleLogout,
            danger: true,
          })}
        </GlassCard>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t("settings_page.disclaimer")}</Text>
      </ScrollView>

      {/* Popup kiểm tra cập nhật */}
      <UpdatePopup
        visible={updatePopupVisible}
        checking={checkingUpdate}
        applying={applyingUpdate}
        result={updateResult}
        onDismiss={() => {
          if (applyingUpdate) return;
          setUpdatePopupVisible(false);
        }}
        onPrimaryAction={handleUpdatePrimaryAction}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho màn hình Settings
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container chính
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // content – Padding cho ScrollView
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  // hero – Container tiêu đề
  hero: {
    marginTop: 6,
    marginBottom: 18,
  },
  // title – Tiêu đề chính
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // subtitle – Phụ đề (không dùng nhưng định nghĩa)
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  // shortcutGrid – Grid 2 cột chứa các shortcut
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  // shortcutCard – Một card shortcut
  shortcutCard: {
    width: "48%",
    minHeight: 112,
    marginBottom: 10,
    padding: 14,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // shortcutIcon – Icon trong card shortcut
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    marginBottom: 12,
  },
  // shortcutLabel – Label của shortcut
  shortcutLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // sectionTitle – Tiêu đề section
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  sectionHeading: {
    minHeight: 32,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitleInline: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  accountCountBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
  },
  accountCountText: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    fontWeight: "700",
  },
  // card – Margin bottom cho GlassCard
  card: {
    marginBottom: 20,
  },
  // row – Một hàng trong card settings
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  // rowCompact – Hàng với padding nhỏ hơn
  rowCompact: {
    paddingVertical: 4,
  },
  // rowLeft – Bên trái của row (icon + text)
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  // rowLeftCompact – Row left compact
  rowLeftCompact: {
    gap: 10,
  },
  // rowIcon – Icon trong row
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  // rowIconCompact – Icon compact
  rowIconCompact: {
    width: 36,
    height: 36,
  },
  // rowIconDanger – Icon màu đỏ danger
  rowIconDanger: {
    backgroundColor: COLORS.ACCENT,
  },
  // rowTitle – Tiêu đề của row
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // rowTitleCompact – Title compact
  rowTitleCompact: {
    fontSize: 14,
  },
  // rowDescription – Mô tả trong row
  rowDescription: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  // rowDescriptionCompact – Description compact
  rowDescriptionCompact: {
    fontSize: 12,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
  },
  accountMain: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  accountAvatarCurrent: {
    backgroundColor: COLORS.PURE_BLACK,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  removeAccountButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  // disclaimer – Text disclaimer cuối trang
  disclaimer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.TEXT_SECONDARY,
    paddingHorizontal: 12,
  },
});

export default Settings;

