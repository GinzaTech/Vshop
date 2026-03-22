import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { useUserStore } from "~/hooks/useUserStore";
import { getAccessTokenFromUri } from "~/utils/misc";
import {
  defaultUser,
  getBalances,
  getEntitlementsToken,
  getProgress,
  getShop,
  getUserId,
  getUsername,
  parseShop,

} from "~/utils/valorant-api";
import Loading from "./Loading";
import WebView from "react-native-webview";
import { loadAssets } from "~/utils/valorant-assets";
import { loadAgent } from "~/utils/valorant-assets";
import { COLORS } from "~/constants/DesignSystem";
import { clearAllCookies } from "~/utils/cookies";

const LOGIN_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

interface LoginWebViewProps {
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export default function LoginWebView({
  minHeight,
  style,
}: LoginWebViewProps) {
  const router = useRouter();
  const { setUser } = useUserStore();
  const [loading, setLoading] = useState<string | null>(null);
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const resolvedMinHeight =
    minHeight ?? Math.max(620, Math.min(height * 0.83, 760));

  const handleWebViewChange = async (newNavState: {
    url?: string;
    title?: string;
    loading?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }) => {
    if (!newNavState.url) return;

    if (newNavState.url.includes("access_token=")) {
      const accessToken = getAccessTokenFromUri(newNavState.url);
      try {
        const region =
          (await AsyncStorage.getItem("region")) || defaultUser.region;

        setLoading(t("fetching.assets"));
        await loadAssets();

        setLoading(t("fetching.agent"));
        await loadAgent();

        setLoading(t("fetching.entitlements_token"));
        const entitlementsToken = await getEntitlementsToken(accessToken);

        setLoading(t("fetching.user_id"));
        const userId = getUserId(accessToken);

        setLoading(t("fetching.username"));
        const username = await getUsername(
          accessToken,
          entitlementsToken,
          userId,
          region
        );

        setLoading(t("fetching.storefront"));
        const shop = await getShop(
          accessToken,
          entitlementsToken,
          region,
          userId
        );
        const shops = await parseShop(shop);

        setLoading(t("fetching.progress"));
        const progress = await getProgress(
          accessToken,
          entitlementsToken,
          region,
          userId
        );

        setLoading(t("fetching.balances"));
        const balances = await getBalances(
          accessToken,
          entitlementsToken,
          region,
          userId
        );

        setUser({
          id: userId,
          name: username.GameName,
          TagLine: username.TagLine,
          region,
          shops,
          progress,
          balances,
          accessToken,
          entitlementsToken,

        });
        router.replace("/shop");
      } catch (e) {
        console.log(e);

        if (!__DEV__) {
          await clearAllCookies(true);
          router.replace("/setup"); // Fallback to setup, so user doesn't get stuck
        }
      }
    }
  };

  if (loading) {
    return <Loading msg={loading} />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          minHeight: resolvedMinHeight,
        },
        style,
      ]}
      renderToHardwareTextureAndroid
    >
      <WebView
        style={styles.webView}
        userAgent="Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36"
        source={{
          uri: LOGIN_URL,
        }}
        onNavigationStateChange={handleWebViewChange}
        injectedJavaScriptBeforeContentLoaded={`(function() {
              const deleteCookieBanner = () => {
                if (document.getElementsByClassName('osano-cm-window').length > 0) document.getElementsByClassName('osano-cm-window')[0].style = "display:none;";
                else setTimeout(deleteCookieBanner, 10)
              }
              deleteCookieBanner();
            })();`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
  },
  webView: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
  },
});
