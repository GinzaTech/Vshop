// 📦 settings.tsx – Màn hình Cài đặt (Settings)
// Cho phép người dùng quản lý tài khoản, ngôn ngữ, thông báo, các shortcut tính năng,
// kiểm tra cập nhật, và các liên kết hữu ích

import React from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  ToastAndroid,
  View,
} from "react-native";
import {
  Switch,
  Text,
} from "react-native-paper";
import { useTranslation } from "~/hooks/useAppTranslation";
import { MoreGlassScene } from "~/components/ui/more-glass/MoreGlassScene";
import { MoreGlassCard } from "~/components/ui/more-glass/MoreGlassCard";
import { AccountSwitcherPopupHost } from "~/components/settings/AccountSwitcherPopupHost";
import { AccountSwitcherRow } from "~/components/settings/AccountSwitcherRow";
import { toAccountDisplayRow } from "~/components/settings/AccountSwitcherDisplay";
import TouchableOpacity from "~/components/ui/ContentCardTouchable";
import Animated from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUserStore } from "~/hooks/useUserStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { initBackgroundFetch, stopBackgroundFetch } from "~/utils/wishlist";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import BatteryOptimizationWarning from "~/components/BatteryOptimizationWarning";
import UpdatePopup from "~/components/popups/UpdatePopup";
import { COLORS, RADIUS, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import {
  AppUpdateCheckResult,
  applyOtaUpdate,
  checkForAppUpdate,
} from "~/utils/app-update";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import AppIcon from "~/components/ui/AppIcon";
import type { AppIconName } from "~/components/ui/app-icon-registry";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";
import { hasReusableAccessToken } from "~/utils/auth-session";
import { prepareInteractiveAuthentication, signOutRiotAccount, switchSavedAccount } from "~/services/accounts/session";
import MobileAccountMirrorPanel from "~/components/MobileAccountMirrorPanel";
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
  const savedAccounts = useAccountStore((state) => state.accounts);
  const removeAccount = useAccountStore((state) => state.removeAccount);
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
  const [accountPopupVisible, setAccountPopupVisible] = React.useState(false);
  const dismissAccountPopup = React.useCallback(() => setAccountPopupVisible(false), []);
  // refreshApp: pull-to-refresh chạy full sync nền (force = true)
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  /**
   * accountRows – Danh sách account đã lưu để render (memoized).
   * Account hiện tại luôn đứng đầu: nếu chưa có trong savedAccounts thì
   * chèn tạm bản build từ user; còn lại sort theo lastUsedAt giảm dần.
   */
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
  const accountDisplayRows = accountRows.map((account) => {
    const isCurrent = normalizeAccountId(account.id) === normalizeAccountId(user.id);
    return toAccountDisplayRow({
      id: account.id, name: isCurrent ? user.name : account.name,
      tagLine: isCurrent ? user.TagLine : account.tagLine,
      region: isCurrent ? user.region : account.region,
    }, isCurrent ? "current" : hasReusableAccessToken(account.accessToken) ? "ready" : "login-required");
  });
  const currentAccount = accountDisplayRows.find((account) => account.status === "current");


  /**
   * handleLogout – Xử lý đăng xuất: xóa cookies, reset user, dừng background fetch,
   * tắt thông báo, chuyển về màn hình setup
   */
  const handleLogout = async () => {
    await signOutRiotAccount();
    stopBackgroundFetch();
    setNotificationEnabled(false);
    router.replace("/setup");
  };

  // handleAddAccount: mở flow đăng nhập thêm account mới (mode "add").
  // Side effects: chuẩn bị interactive auth, điều hướng /reauth?mode=add.
  const handleAddAccount = async () => {
    await prepareInteractiveAuthentication(true);
    router.push({ pathname: "/reauth", params: { mode: "add" } });
  };

  /**
   * handleSwitchAccount – Chuyển sang account đã lưu khác.
   * @param {string} accountId – ID account đích. Bỏ qua nếu trùng account
   *   hiện tại hoặc đang có một lần chuyển khác chạy (switchingAccountId).
   * Theo kết quả: "switched" → /profile; "reauth-required" → /reauth
   * mode "switch"; "failed" → Alert lỗi.
   * Side effects: setState switchingAccountId, navigation.
   */
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
        await prepareInteractiveAuthentication(true);
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

  // confirmRemoveAccount: hiện Alert xác nhận trước khi xóa account đã lưu
  // khỏi useAccountStore (action destructive, không ảnh hưởng account khác)
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
    icon: AppIconName;
    route?: string;
    onPress?: () => void;
  }[] = [
    { key: "equip", label: t("equip"), icon: "equipmentProfile", route: "/equip" },
    { key: "accessories", label: t("accessories"), icon: "accessory", route: "/accessories" },
    { key: "gallery", label: t("gallery"), icon: "imageGrid", route: "/gallery" },
    { key: "agent", label: t("agent"), icon: "accountGroup", route: "/agent" },
    { key: "combat", label: t("combat"), icon: "target", route: "/combat" },
    { key: "history", label: t("history"), icon: "history", route: "/history" },
    { key: "crosshair", label: t("crosshair"), icon: "crosshair", route: "/crosshair" },
    { key: "leaderboard", label: t("leaderboard_page.title"), icon: "leaderboardSeason", route: "/leaderboard" },
    { key: "friends", label: t("friends_page.title"), icon: "party", route: "/friends" },
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
    icon: AppIconName;
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
          <AppIcon
            name={icon}
            size={compact ? 16 : 18}
            color={danger ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
            decorative
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
      {right ?? (
        <AppIcon
          name="chevronRight"
          size={20}
          color={COLORS.TEXT_SECONDARY}
          decorative
        />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <MoreGlassScene accessibilityElementsHidden={accountPopupVisible} aria-hidden={accountPopupVisible}
        importantForAccessibility={accountPopupVisible ? "no-hide-descendants" : "auto"}>
      {({ onShortcutGridLayout, onShortcutLayout, onCardLayout, onScroll }) => <Animated.ScrollView
        removeClippedSubviews={Platform.OS === "android"}
        style={styles.screen}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.content, { paddingBottom: getPrimaryTabContentBottomPadding(insets.bottom) }]}>
        {/* Hero: tiêu đề */}
        <View style={styles.hero}>
          <Text style={styles.title}>{t("settings_page.title")}</Text>
        </View>

        {/* Cảnh báo tối ưu pin Android */}
        <BatteryOptimizationWarning />

        {/* Grid các shortcut tính năng */}
        <View style={styles.shortcutGrid} onLayout={onShortcutGridLayout}>
          {shortcutItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              testID={`settings-shortcut-${item.key}`}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              activeOpacity={0.85}
              style={styles.shortcutCard}
              onLayout={(event) => onShortcutLayout(index, event)}
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
              <MoreGlassCard index={index} style={styles.shortcutGlass} contentStyle={styles.shortcutContent}>
                <View style={styles.shortcutIcon}>
                  <AppIcon name={item.icon} size={20} color={COLORS.TEXT_PRIMARY} decorative />
                </View>
                <Text style={styles.shortcutLabel}>{item.label}</Text>
              </MoreGlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Preferences: ngôn ngữ, thông báo, screenshot mode */}
        <Text style={styles.sectionTitle}>{t("settings_page.preferences")}</Text>
        <MoreGlassCard index={10} onLayout={(event) => onCardLayout(10, event)} style={styles.card} contentStyle={styles.groupContent}>
          {renderRow({
            icon: "settingsLanguage",
            title: t("language"),
            onPress: () => router.push("/language"),
          })}
          {Platform.OS === "android"
            ? renderRow({
                icon: "settings",
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
                icon: "imageGrid",
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
        </MoreGlassCard>

        {/* Section Links: Discord, credits, privacy, xóa tài khoản */}
        <Text style={styles.sectionTitle}>{t("settings_page.links")}</Text>
        <MoreGlassCard index={11} onLayout={(event) => onCardLayout(11, event)} style={styles.card} contentStyle={styles.groupContent}>
          {renderRow({
            icon: "accountGroup",
            title: t("discord_server"),
            onPress: () => Linking.openURL("https://discord.gg/gB2nM6vKrD"),
          })}
          {renderRow({
            icon: "settingsAbout",
            title: t("credits"),
            onPress: () => Linking.openURL("https://vshop.one/credits"),
          })}
          {renderRow({
            icon: "success",
            title: t("privacy_policy"),
            onPress: () => Linking.openURL("https://vshop.one/privacy"),
          })}
          {renderRow({
            icon: "settingsDeleteAccount",
            title: t("delete_account"),
            onPress: () =>
              Linking.openURL(
                "https://support-valorant.riotgames.com/hc/en-us/articles/360050328414-Deleting-Your-Riot-Account-and-All-Your-Data"
              ),
          })}
        </MoreGlassCard>

        <MobileAccountMirrorPanel mode="accounts" />

        {/* Current account inline; the count opens other saved accounts. */}
        <View style={styles.sectionHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitleInline}>
            {t("settings_page.accounts.logged_in")}
          </Text>
          <TouchableOpacity testID="settings-account-count"
            accessibilityRole="button" accessibilityState={{ expanded: accountPopupVisible, disabled: Boolean(switchingAccountId) }}
            disabled={Boolean(switchingAccountId)} onPress={() => { if (!switchingAccountId) setAccountPopupVisible(true); }}
            style={{ minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel={t("settings_page.accounts.logged_in_count", { count: accountDisplayRows.length })}>
            <View style={styles.accountCountBadge}>
              <Text style={styles.accountCountText}>{accountDisplayRows.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <MoreGlassCard index={12} onLayout={(event) => onCardLayout(12, event)} style={styles.card} contentStyle={styles.groupContent}>
          {currentAccount ? <AccountSwitcherRow account={currentAccount} isCurrent
            busy={Boolean(switchingAccountId)} switching={switchingAccountId === currentAccount.id} /> : null}
        </MoreGlassCard>

        {/* Account management actions */}
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t("settings_page.accounts.manage")}
        </Text>
        <MoreGlassCard index={13} onLayout={(event) => onCardLayout(13, event)} style={styles.card} contentStyle={styles.groupContent}>
          {renderRow({
            icon: "settingsAccount",
            title: t("settings_page.accounts.add"),
            description: t("settings_page.accounts.add_description"),
            onPress: () => void handleAddAccount(),
          })}
          {renderRow({
            icon: "copyCode",
            title: t("copy_riot_id"),
            description: user.id,
            onPress: () => Clipboard.setStringAsync(user.id),
          })}
          {renderRow({
            icon: "settingsLogoutAll",
            title: t("settings_page.accounts.logout_all"),
            onPress: handleLogout,
            danger: true,
          })}
        </MoreGlassCard>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t("settings_page.disclaimer")}</Text>
      </View>
      </Animated.ScrollView>}
      </MoreGlassScene>

      <AccountSwitcherPopupHost visible={accountPopupVisible} accounts={accountDisplayRows}
        currentId={user.id} busyId={switchingAccountId} onDismiss={dismissAccountPopup}
        onSwitch={handleSwitchAccount} onRemove={(id) => {
          if (switchingAccountId || normalizeAccountId(id) === normalizeAccountId(user.id)) return;
          const account = accountRows.find((row) => row.id === id);
          if (account) confirmRemoveAccount(account);
        }} />

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
    backgroundColor: "transparent",
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
    padding: 0,
    borderRadius: RADIUS.card,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  shortcutGlass: {
    flex: 1,
    minHeight: 112,
    borderRadius: RADIUS.card,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    boxShadow: "none",
  },
  shortcutContent: {
    padding: 14,
  },
  // shortcutIcon – Icon trong card shortcut
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MORE_GLASS_MATERIAL.tint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.ON_DARK_BORDER,
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
  groupContent: { padding: 16 },
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

