import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from "react-native";
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
  ownedItems,
  parseShop,

} from "~/utils/valorant-api";
import Loading from "./Loading";
import WebView from "react-native-webview";
import { loadAssets } from "~/utils/valorant-assets";
import { loadAgent } from "~/utils/valorant-assets";
import { COLORS } from "~/constants/DesignSystem";
import { clearAllCookies } from "~/utils/cookies";
import { VItemTypes } from "~/utils/misc";

const LOGIN_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

const isAuthCallbackUrl = (url?: string) =>
  Boolean(url && (url.includes("access_token=") || url.includes("id_token=")));

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
  const [webIssue, setWebIssue] = useState<string | null>(null);
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const resolvedMinHeight =
    minHeight ?? Math.max(680, Math.min(height * 0.91, 820));

  const handleWebViewChange = async (newNavState: {
    url?: string;
    title?: string;
    loading?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }) => {
    if (!newNavState.url) return;

    if (isAuthCallbackUrl(newNavState.url)) {
      setWebIssue(null);
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

        setLoading("Fetching owned skins");
        const [ownedSkinLevels, ownedSkinChromas] = await Promise.allSettled([
          ownedItems(
            accessToken,
            entitlementsToken,
            region,
            userId,
            VItemTypes.SkinLevel
          ),
          ownedItems(
            accessToken,
            entitlementsToken,
            region,
            userId,
            VItemTypes.SkinChroma
          ),
        ]);

        const ownedSkinIds = Array.from(
          new Set(
            [ownedSkinLevels, ownedSkinChromas].flatMap((result) =>
              result.status === "fulfilled"
                ? (result.value?.EntitlementsByTypes ?? []).flatMap((entry) =>
                    (entry.Entitlements ?? []).map((entitlement) => entitlement.ItemID)
                  )
                : []
            )
          )
        );

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
          ownedSkinIds,
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
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        cacheEnabled
        source={{
          uri: LOGIN_URL,
        }}
        onNavigationStateChange={(state) => {
          void handleWebViewChange(state);
        }}
        onLoadStart={() => {
          setWebIssue(null);
        }}
        onLoadEnd={() => setWebIssue(null)}
        onError={(event) => {
          if (isAuthCallbackUrl(event.nativeEvent.url)) {
            setWebIssue(null);
            return;
          }

          const issue = `${event.nativeEvent.description || "WebView error"} (${event.nativeEvent.code})`;
          setWebIssue(issue);
          if (__DEV__) {
            console.log("[LoginWebView] error", {
              code: event.nativeEvent.code,
              description: event.nativeEvent.description,
            });
          }
        }}
        onHttpError={(event) => {
          if (isAuthCallbackUrl(event.nativeEvent.url)) {
            setWebIssue(null);
            return;
          }

          const issue = `HTTP ${event.nativeEvent.statusCode} ${event.nativeEvent.description || ""}`.trim();
          setWebIssue(issue);
          if (__DEV__) {
            console.log("[LoginWebView] http-error", {
              statusCode: event.nativeEvent.statusCode,
              description: event.nativeEvent.description,
            });
          }
        }}
        injectedJavaScriptBeforeContentLoaded={`(function() {
              const deleteCookieBanner = () => {
                if (document.getElementsByClassName('osano-cm-window').length > 0) document.getElementsByClassName('osano-cm-window')[0].style = "display:none;";
                else setTimeout(deleteCookieBanner, 10)
              }
              deleteCookieBanner();
            })();`}
      />
      {webIssue ? <Text style={styles.issueText}>{webIssue}</Text> : null}
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
  issueText: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
});
