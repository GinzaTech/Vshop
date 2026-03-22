import { useTranslation } from "react-i18next";
import { Dimensions, View } from "react-native";
import { Paragraph, Title } from "react-native-paper";

import LoginWebView from "~/components/LoginWebView";
import { COLORS } from "~/constants/DesignSystem";
import GlassCard from "~/components/ui/GlassCard";

const { height: windowHeight } = Dimensions.get("window");

function ReAuth() {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        backgroundColor: COLORS.BACKGROUND,
      }}
    >
      <View style={{ marginTop: 28, marginBottom: 18 }}>
        <Paragraph style={{ color: COLORS.TEXT_SECONDARY }}>
          Riot Games account
        </Paragraph>
        <Title style={{ fontSize: 32, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}>
          {t("welcome_back")}
        </Title>
        <Paragraph style={{ marginTop: 4, color: COLORS.TEXT_SECONDARY }}>
          {t("welcome_back_info")}
        </Paragraph>
      </View>
      <GlassCard style={{ flex: 1, minHeight: windowHeight * 0.92 }}>
        <LoginWebView minHeight={windowHeight * 0.86} />
      </GlassCard>
    </View>
  );
}

export default ReAuth;
