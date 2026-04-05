import React, { useMemo } from "react";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  Paragraph,
  Portal,
  Text,
  Title,
} from "react-native-paper";
import { useTranslation } from "react-i18next";

import { COLORS } from "~/constants/DesignSystem";
import {
  AppUpdateCheckResult,
  getCurrentAppVersionLabel,
} from "~/utils/app-update";

interface UpdatePopupProps {
  visible: boolean;
  checking: boolean;
  applying: boolean;
  result: AppUpdateCheckResult | null;
  onDismiss: () => void;
  onPrimaryAction?: () => void;
}

const formatContent = (
  checking: boolean,
  result: AppUpdateCheckResult | null,
  t: (key: string, options?: Record<string, unknown>) => string
): {
  title: string;
  description: string;
  primaryLabel?: string;
  showPrimary: boolean;
} => {
  if (checking) {
    return {
      title: t("update_popup.checking_title"),
      description: t("update_popup.checking_description"),
      showPrimary: false,
    };
  }

  if (!result) {
    return {
      title: t("update_popup.idle_title"),
      description: t("update_popup.idle_description"),
      showPrimary: false,
    };
  }

  switch (result.kind) {
    case "ota-available":
      return {
        title: t("update_popup.ota_title"),
        description: t("update_popup.ota_description"),
        primaryLabel: t("update_popup.actions.update_now"),
        showPrimary: true,
      };
    case "native-update":
      if (result.environment === "expo-go" || result.environment === "development") {
        return {
          title: t("update_popup.native_title"),
          description: t("update_popup.native_dev_description"),
          primaryLabel: t("update_popup.actions.open_release"),
          showPrimary: true,
        };
      }

      return {
        title: t("update_popup.native_title"),
        description: t("update_popup.native_description"),
        primaryLabel: t("update_popup.actions.open_release"),
        showPrimary: true,
      };
    case "error":
      return {
        title: t("update_popup.error_title"),
        description: result.message,
        primaryLabel: result.latestVersion
          ? t("update_popup.actions.open_release")
          : undefined,
        showPrimary: Boolean(result.latestVersion),
      };
    case "up-to-date":
    default:
      if (!result.canUseOta && result.environment !== "web") {
        return {
          title: t("update_popup.current_title"),
          description: t("update_popup.current_description"),
          showPrimary: false,
        };
      }

      return {
        title: t("update_popup.up_to_date_title"),
        description: t("update_popup.up_to_date_description"),
        showPrimary: false,
      };
  }
};

export default function UpdatePopup({
  visible,
  checking,
  applying,
  result,
  onDismiss,
  onPrimaryAction,
}: UpdatePopupProps) {
  const { t } = useTranslation();
  const currentVersion = getCurrentAppVersionLabel();
  const { title, description, primaryLabel, showPrimary } = useMemo(
    () => formatContent(checking, result, t),
    [checking, result, t]
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={applying ? undefined : onDismiss}>
        <Dialog.Title>
          <View style={styles.titleRow}>
            <Icon
              name={checking ? "progress-download" : "update"}
              size={22}
              color={COLORS.TEXT_PRIMARY}
            />
            <Title style={styles.titleText}>{title}</Title>
          </View>
        </Dialog.Title>
        <Dialog.Content>
          {checking ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator animating color={COLORS.PURE_BLACK} />
            </View>
          ) : null}

          <Paragraph style={styles.description}>{description}</Paragraph>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t("update_popup.meta.current_build")}</Text>
            <Text style={styles.metaValue}>{currentVersion}</Text>
          </View>

          {result?.latestVersion ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>{t("update_popup.meta.latest_release")}</Text>
              <Text style={styles.metaValue}>v{result.latestVersion}</Text>
            </View>
          ) : null}

          {result?.channel ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>{t("update_popup.meta.channel")}</Text>
              <Text style={styles.metaValue}>{result.channel}</Text>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={applying}>
            {t("update_popup.actions.close")}
          </Button>
          {showPrimary && primaryLabel && onPrimaryAction ? (
            <Button onPress={onPrimaryAction} loading={applying} disabled={applying}>
              {primaryLabel}
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: {
    marginLeft: 10,
    color: COLORS.TEXT_PRIMARY,
  },
  loadingWrap: {
    marginBottom: 16,
    alignItems: "center",
  },
  description: {
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  metaBlock: {
    marginTop: 14,
  },
  metaLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    marginTop: 4,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
});
