import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Button,
  Paragraph,
  RadioButton,
  Title,
  useTheme,
} from "react-native-paper";
import { Image } from "expo-image";
import { regions } from "~/utils/misc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUserStore } from "~/hooks/useUserStore";
import LoginWebView from "~/components/LoginWebView";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOOTER_HEIGHT = 92;
const HORIZONTAL_PADDING = 20;

function Setup() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [offsetX, setOffsetX] = useState(0);
  const { t } = useTranslation();
  const { user, setUser } = useUserStore();
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageHeight = useMemo(
    () =>
      Math.max(
        560,
        windowHeight - insets.top - insets.bottom - FOOTER_HEIGHT
      ),
    [insets.bottom, insets.top, windowHeight]
  );
  const heroImageHeight = Math.min(windowHeight * 0.34, 300);
  const loginHeight = Math.max(430, pageHeight - 144);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={scrollViewRef}
        scrollEnabled={false}
        onMomentumScrollEnd={(event) =>
          setOffsetX(event.nativeEvent.contentOffset.x)
        }
      >
        <View
          style={{
            justifyContent: "space-evenly",
            width: windowWidth,
            height: pageHeight,
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: 12,
          }}
        >
          <GlassCard style={{ overflow: "hidden" }} contentStyle={{ padding: 0 }}>
            <Image
              style={{
                height: heroImageHeight,
                width: "100%",
              }}
              contentFit="cover"
              source={require("~/assets/images/mockup.png")}
            />
            <View
              style={{
                flexDirection: "column",
                padding: 20,
              }}
            >
              <Paragraph style={{ color: COLORS.TEXT_SECONDARY }}>
                VShop mobile
              </Paragraph>
              <Title
                style={{ fontSize: 30, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}
              >
                {t("welcome")}
              </Title>
              <Paragraph style={{ color: COLORS.TEXT_SECONDARY }}>
                {t("promotional")}
              </Paragraph>
            </View>
          </GlassCard>
        </View>
        <View
          style={{
            width: windowWidth,
            height: pageHeight,
            padding: HORIZONTAL_PADDING,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <GlassCard style={{ flex: 1 }} contentStyle={{ flex: 1 }}>
            <Title
              style={{ fontSize: 28, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}
            >
              {t("region")}
            </Title>
            <Paragraph style={{ color: COLORS.TEXT_SECONDARY, marginBottom: 10 }}>
              {t("region_info")}
            </Paragraph>
            <RadioButton.Group
              onValueChange={(value) => {
                setUser({ ...user, region: value });
                AsyncStorage.setItem("region", value);
              }}
              value={user.region}
            >
              {regions.map((region) => (
                <RadioButton.Item
                  key={region}
                  label={`${t(`regions.${region}`)} (${region.toUpperCase()})`}
                  value={region}
                  color={COLORS.PURE_BLACK}
                  uncheckedColor={COLORS.TEXT_SECONDARY}
                  labelStyle={{ color: COLORS.TEXT_PRIMARY }}
                />
              ))}
            </RadioButton.Group>
          </GlassCard>
        </View>
        {user.region.length > 0 && (
          <View
            style={{
              width: windowWidth,
              height: pageHeight,
              paddingHorizontal: HORIZONTAL_PADDING,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <GlassCard style={{ flex: 1 }} contentStyle={{ flex: 1 }}>
              <View
                style={{
                  paddingBottom: 10,
                }}
              >
                <Title
                  style={{ fontSize: 26, fontWeight: "700", color: COLORS.TEXT_PRIMARY }}
                >
                  {t("signin")}
                </Title>
                <Paragraph style={{ marginBottom: 4, color: COLORS.TEXT_SECONDARY }}>
                  {t("signin_info")}
                </Paragraph>
              </View>
              <LoginWebView minHeight={loginHeight} />
            </GlassCard>
          </View>
        )}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: HORIZONTAL_PADDING,
          paddingBottom: Math.max(8, insets.bottom + 8),
        }}
      >
        <GlassCard>
          <View style={{ flexDirection: "row" }}>
            <Button
              onPress={() => {
                const x = offsetX - windowWidth;
                scrollViewRef.current?.scrollTo({
                  x,
                  animated: true,
                });
                setOffsetX(x);
              }}
              style={{ width: "50%" }}
              disabled={Math.round(offsetX) === 0}
              labelStyle={{ color: COLORS.TEXT_SECONDARY }}
            >
              {t("back")}
            </Button>
            <Button
              onPress={() => {
                const x = offsetX + windowWidth;
                scrollViewRef.current?.scrollTo({
                  x,
                  animated: true,
                });
                setOffsetX(x);
              }}
              style={{ width: "50%" }}
              disabled={
                Math.round(offsetX / windowWidth) === 2 ||
                (Math.round(offsetX / windowWidth) === 1 &&
                  user.region.length <= 0)
              }
              labelStyle={{ color: COLORS.PURE_BLACK }}
            >
              {t("next")}
            </Button>
          </View>
        </GlassCard>
      </View>
      <SafeAreaView style={{ backgroundColor: colors.background }} />
    </View>
  );
}

export default Setup;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  pager: {
    flex: 1,
  },
});
