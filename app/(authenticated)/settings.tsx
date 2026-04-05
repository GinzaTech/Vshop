import React from "react";
import {
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

import { useUserStore } from "~/hooks/useUserStore";
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

function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, resetUser } = useUserStore();
  const { screenshotModeEnabled, toggleScreenshotMode } = useFeatureStore();
  const notificationEnabled = useWishlistStore((state) => state.notificationEnabled);
  const setNotificationEnabled = useWishlistStore(
    (state) => state.setNotificationEnabled
  );
  const [updatePopupVisible, setUpdatePopupVisible] = React.useState(false);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [applyingUpdate, setApplyingUpdate] = React.useState(false);
  const [updateResult, setUpdateResult] =
    React.useState<AppUpdateCheckResult | null>(null);

  const handleLogout = async () => {
    await clearAllCookies(true);
    await AsyncStorage.removeItem("region");
    resetUser();
    stopBackgroundFetch();
    setNotificationEnabled(false);
    router.replace("/setup");
  };

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
    { key: "agent", label: t("agent") || "Agent", icon: "account-group-outline", route: "/agent" },
    { key: "combat", label: t("combat") || "Combat", icon: "target", route: "/combat" },
    { key: "history", label: t("history") || "History", icon: "history", route: "/history" },
    { key: "crosshair", label: t("crosshair") || "Crosshair", icon: "crosshairs-gps", route: "/crosshair" },
    {
      key: "update",
      label: t("settings_page.check_update"),
      icon: "update",
      onPress: handleCheckForUpdates,
    },
  ];

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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>{t("settings_page.title")}</Text>
        </View>

        <BatteryOptimizationWarning />

        <View style={styles.shortcutGrid}>
          {shortcutItems.map((item) => (
            <TouchableOpacity
              key={item.key}
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

        <Text style={styles.sectionTitle}>{t("settings_page.links")}</Text>
        <GlassCard style={styles.card}>
          {renderRow({
            icon: "discord",
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

        <Text style={styles.sectionTitle}>{t("settings_page.account")}</Text>
        <GlassCard style={styles.card}>
          {renderRow({
            icon: "content-copy",
            title: t("copy_riot_id"),
            description: user.id,
            onPress: () => Clipboard.setStringAsync(user.id),
          })}
          {renderRow({
            icon: "logout",
            title: t("logout"),
            onPress: handleLogout,
            danger: true,
          })}
        </GlassCard>

        <Text style={styles.disclaimer}>{t("settings_page.disclaimer")}</Text>
      </ScrollView>

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  hero: {
    marginTop: 6,
    marginBottom: 18,
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
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  shortcutCard: {
    width: "48%",
    marginBottom: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    marginBottom: 18,
  },
  shortcutLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  card: {
    marginBottom: 22,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowCompact: {
    paddingVertical: 4,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowLeftCompact: {
    gap: 10,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  rowIconCompact: {
    width: 36,
    height: 36,
  },
  rowIconDanger: {
    backgroundColor: COLORS.ACCENT,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  rowTitleCompact: {
    fontSize: 14,
  },
  rowDescription: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  rowDescriptionCompact: {
    fontSize: 12,
  },
  disclaimer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.TEXT_SECONDARY,
    paddingHorizontal: 12,
  },
});

export default Settings;

