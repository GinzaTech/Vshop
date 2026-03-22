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
  result: AppUpdateCheckResult | null
): {
  title: string;
  description: string;
  primaryLabel?: string;
  showPrimary: boolean;
} => {
  if (checking) {
    return {
      title: "Checking for updates",
      description: "Looking for both OTA patches and newer app releases.",
      showPrimary: false,
    };
  }

  if (!result) {
    return {
      title: "App updates",
      description: "Check whether this build can download a newer update.",
      showPrimary: false,
    };
  }

  switch (result.kind) {
    case "ota-available":
      return {
        title: "Update ready",
        description:
          "A new JS/UI update is available for this build. Download it now and the app will reload without reinstalling.",
        primaryLabel: "Update now",
        showPrimary: true,
      };
    case "native-update":
      if (result.environment === "expo-go" || result.environment === "development") {
        return {
          title: "Newer build available",
          description:
            "This session is running in Expo Go or a development build, so it cannot apply production OTA updates. Build one preview/production app once, then future JS/UI fixes can update in-app.",
          primaryLabel: "Open release",
          showPrimary: true,
        };
      }

      return {
        title: "Newer build available",
        description:
          "A newer native build is available. This specific release still needs a new install because the native layer changed.",
        primaryLabel: "Open release",
        showPrimary: true,
      };
    case "error":
      return {
        title: "Unable to update",
        description: result.message,
        primaryLabel: result.latestVersion ? "Open release" : undefined,
        showPrimary: Boolean(result.latestVersion),
      };
    case "up-to-date":
    default:
      if (!result.canUseOta && result.environment !== "web") {
        return {
          title: "This build is current",
          description:
            "No newer release was found. To update inside the app later, ship one preview/production build with expo-updates enabled.",
          showPrimary: false,
        };
      }

      return {
        title: "You're up to date",
        description: "No newer update is available for this build right now.",
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
  const currentVersion = getCurrentAppVersionLabel();
  const { title, description, primaryLabel, showPrimary } = useMemo(
    () => formatContent(checking, result),
    [checking, result]
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
            <Text style={styles.metaLabel}>Current build</Text>
            <Text style={styles.metaValue}>{currentVersion}</Text>
          </View>

          {result?.latestVersion ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Latest release</Text>
              <Text style={styles.metaValue}>v{result.latestVersion}</Text>
            </View>
          ) : null}

          {result?.channel ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Channel</Text>
              <Text style={styles.metaValue}>{result.channel}</Text>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={applying}>
            Close
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
