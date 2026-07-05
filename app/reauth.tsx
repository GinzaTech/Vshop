import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Paragraph, Title } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoginWebView from "~/components/LoginWebView";
import { COLORS } from "~/constants/DesignSystem";
import GlassCard from "~/components/ui/GlassCard";

function ReAuth() {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Paragraph style={{ color: COLORS.TEXT_SECONDARY }}>
          {t("reauth.riot_account")}
        </Paragraph>
        <Title style={{ fontSize: 32, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}>
          {t("welcome_back")}
        </Title>
        <Paragraph style={{ marginTop: 4, color: COLORS.TEXT_SECONDARY }}>
          {t("welcome_back_info")}
        </Paragraph>
      </View>
      <GlassCard style={styles.loginCard} contentStyle={styles.loginCardContent}>
        <LoginWebView minHeight={loginHeight} />
      </GlassCard>
    </ScrollView>
  );
}

export default ReAuth;

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
    marginBottom: 16,
  },
  loginCard: {
    flexGrow: 1,
  },
  loginCardContent: {
    flex: 1,
  },
});
