// 📄 app/reauth.tsx — Màn hình đăng nhập lại (re-authentication)
// Được điều hướng đến khi token của người dùng đã hết hạn
// hoặc không thể khôi phục session từ cache.

import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Paragraph, Title } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";

import LoginWebView from "~/components/LoginWebView";
import { COLORS } from "~/constants/DesignSystem";
import GlassCard from "~/components/ui/GlassCard";

/**
 * ReAuth — Component yêu cầu người dùng đăng nhập lại.
 *
 * Các giá trị:
 * - windowHeight: Chiều cao cửa sổ hiện tại.
 * - insets: Khoảng cách safe area (notch, status bar, home indicator).
 * - loginHeight: Chiều cao tối thiểu cho LoginWebView,
 *   đảm bảo >= 520px và co giãn theo windowHeight.
 *
 * Layout:
 * - Header: "Tài khoản Riot" + "Chào mừng trở lại" + mô tả.
 * - GlassCard chứa LoginWebView để xử lý OAuth.
 *
 * @returns {JSX.Element} Màn hình re-auth.
 */
function ReAuth() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mode = params.mode === "add" || params.mode === "switch"
    ? params.mode
    : "reauth";
  const canCancel = mode !== "reauth";
  const title =
    mode === "add"
      ? t("settings_page.accounts.add_title")
      : mode === "switch"
        ? t("settings_page.accounts.switch_title")
        : t("welcome_back");
  const subtitle =
    mode === "add"
      ? t("settings_page.accounts.add_subtitle")
      : mode === "switch"
        ? t("settings_page.accounts.switch_subtitle")
        : t("welcome_back_info");

  // Tính chiều cao login webview, đảm bảo >= 520
  const loginHeight = Math.max(
    520,
    windowHeight - insets.top - insets.bottom - 160
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(20, insets.top + 12),
          paddingBottom: Math.max(20, insets.bottom + 20),
        },
      ]}
      keyboardShouldPersistTaps="handled" // Cho phép tap vào TextInput trong webview
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        {canCancel ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.replace("/settings")}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t("settings_page.accounts.back_to_more")}
          >
            <Icon name="arrow-left" size={20} color={COLORS.TEXT_PRIMARY} />
            <Paragraph style={styles.backButtonText}>
              {t("settings_page.accounts.back_to_more")}
            </Paragraph>
          </TouchableOpacity>
        ) : null}
        <Paragraph style={{ color: COLORS.TEXT_SECONDARY }}>
          {t("reauth.riot_account")}
        </Paragraph>
        <Title style={{ fontSize: 32, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}>
          {title}
        </Title>
        <Paragraph style={{ marginTop: 4, color: COLORS.TEXT_SECONDARY }}>
          {subtitle}
        </Paragraph>
      </View>

      {/* ── Form đăng nhập ── */}
      <GlassCard style={styles.loginCard} contentStyle={styles.loginCardContent}>
        <LoginWebView minHeight={loginHeight} />
      </GlassCard>
    </ScrollView>
  );
}

export default ReAuth;

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,  // Khoảng cách giữa header và login card
  },
  backButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  backButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  loginCard: {
    flexGrow: 1,       // Card co giãn theo nội dung
  },
  loginCardContent: {
    flex: 1,           // Nội dung bên trong chiếm toàn bộ card
  },
});
