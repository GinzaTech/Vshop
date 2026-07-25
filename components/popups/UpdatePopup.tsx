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

// ─── UpdatePopupProps ──────────────────────────────────────────────────────────
//   - visible: boolean – popup có đang hiển thị không
//   - checking: boolean – đang kiểm tra bản cập nhật
//   - applying: boolean – đang áp dụng bản cập nhật (disable nút)
//   - result: AppUpdateCheckResult | null – kết quả kiểm tra (null nếu chưa check)
//   - onDismiss: () => void – callback đóng popup
//   - onPrimaryAction?: () => void – callback cho nút hành động chính

interface UpdatePopupProps {
  visible: boolean;
  checking: boolean;
  applying: boolean;
  result: AppUpdateCheckResult | null;
  onDismiss: () => void;
  onPrimaryAction?: () => void;
}

// ─── formatContent ─────────────────────────────────────────────────────────────
// Hàm xử lý logic xác định nội dung popup dựa trên trạng thái kiểm tra & kết quả.
//
// Tham số:
//   - checking: boolean – đang kiểm tra
//   - result: AppUpdateCheckResult | null – kết quả từ server
//   - t: hàm dịch i18n
//
// Return:
//   - { title, description, primaryLabel?, showPrimary }
//
// Các case:
//   - checking: đang kiểm tra => hiển thị spinner, không có nút primary
//   - null result: idle (chưa check) => không có nút primary
//   - "ota-available": có bản OTA => nút "Update Now"
//   - "native-update": có bản native => nút "Open Release"
//     (riêng Expo Go / dev environment có description riêng)
//   - "error": có lỗi, nếu có latestVersion thì hiển thị nút Open Release
//   - "up-to-date": đã up-to-date, tuỳ theo canUseOta/environment có description khác

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

// ─── UpdatePopup ───────────────────────────────────────────────────────────────
// Component popup thông báo cập nhật ứng dụng (dùng react-native-paper Dialog).
//
// State & Hook:
//   - t (useTranslation): hàm dịch
//   - currentVersion (getCurrentAppVersionLabel): label phiên bản hiện tại
//
// useMemo:
//   - { title, description, primaryLabel, showPrimary } = formatContent(...)
//     Phụ thuộc: [checking, result, t]
//     Tính toán lại nội dung popup khi trạng thái thay đổi
//
// Props:
//   - visible: điều khiển hiển thị Dialog
//   - applying: nếu true thì onDismiss bị vô hiệu (không cho đóng) và nút disabled
//   - onPrimaryAction: chỉ render nút primary nếu showPrimary && có label && có callback

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
          {/*
            titleRow: icon + title text
            Icon thay đổi theo checking: progress-download (khi check) / update
            */}
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
          {/*
            loadingWrap: chỉ hiển thị ActivityIndicator khi checking
            */}
          {checking ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator animating color={COLORS.PURE_BLACK} />
            </View>
          ) : null}

          <Paragraph style={styles.description}>{description}</Paragraph>

          {/*
            metaBlock: thông tin phiên bản hiện tại
            */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t("update_popup.meta.current_build")}</Text>
            <Text style={styles.metaValue}>{currentVersion}</Text>
          </View>

          {/*
            metaBlock: phiên bản mới nhất (nếu có)
            */}
          {result?.latestVersion ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>{t("update_popup.meta.latest_release")}</Text>
              <Text style={styles.metaValue}>v{result.latestVersion}</Text>
            </View>
          ) : null}

          {/*
            metaBlock: channel cập nhật (nếu có)
            */}
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

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // titleRow: hàng ngang icon + title
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // titleText: title dialog, cách icon 10px, màu primary
  titleText: {
    marginLeft: 10,
    color: COLORS.TEXT_PRIMARY,
  },
  // loadingWrap: vùng chứa spinner, căn giữa, margin bottom 16
  loadingWrap: {
    marginBottom: 16,
    alignItems: "center",
  },
  // description: text mô tả, secondary, lineHeight 22
  description: {
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  // metaBlock: khối thông tin meta, margin top 14
  metaBlock: {
    marginTop: 14,
  },
  // metaLabel: nhãn meta, secondary, 12px, uppercase, letterSpacing 0.5
  metaLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // metaValue: giá trị meta, primary, 15px, bold 700
  metaValue: {
    marginTop: 4,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
});
