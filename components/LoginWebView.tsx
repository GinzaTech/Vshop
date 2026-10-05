import { useState } from "react";
import { useTranslation } from "~/hooks/useAppTranslation";
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import WebView from "react-native-webview";

import type { LoginWebViewProps } from "./LoginWebView.types";
import Loading from "./Loading";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { COLORS } from "~/constants/DesignSystem";
import { useRiotInteractiveLogin } from "~/hooks/useRiotInteractiveLogin";
import {
  isAllowedRiotAuthNavigation,
  isRiotAuthCallbackUrl,
} from "~/utils/riot-auth-navigation";
import { sanitizeErrorForLog } from "~/utils/log-redaction";

export type { LoginWebViewProps } from "./LoginWebView.types";

/** Native Riot sign-in shell. Expo Web resolves LoginWebView.web.tsx instead. */
export default function LoginWebView({
  minHeight,
  style,
  expectedAccountId,
}: LoginWebViewProps) {
  const { t } = useTranslation();
  const { height } = useAppWindowDimensions();
  const [webIssue, setWebIssue] = useState<string | null>(null);
  const {
    authReady,
    loginUrl,
    loading,
    completionIssue,
    completeCallback,
  } = useRiotInteractiveLogin({ expectedAccountId });
  const resolvedMinHeight = minHeight ?? Math.max(500, Math.min(height * 0.74, 720));

  if (!authReady || !loginUrl) {
    if (completionIssue) {
      return (
        <Text accessibilityRole="alert" style={styles.issueText}>
          {t(completionIssue)}
        </Text>
      );
    }
    return <Loading msg={t("fetching.progress")} />;
  }

  const renderedIssue = webIssue ?? (completionIssue ? t(completionIssue) : null);

  return (
    <View
      style={[styles.container, { minHeight: resolvedMinHeight }, style]}
      renderToHardwareTextureAndroid
    >
      <WebView
        style={styles.webView}
        userAgent="Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36"
        originWhitelist={[
          "https://*.riotgames.com",
          "https://riotgames.com",
          "https://*.playvalorant.com",
          "https://playvalorant.com",
        ]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        cacheEnabled
        source={{ uri: loginUrl }}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedRiotAuthNavigation(request.url)) return true;
          if (/^https?:\/\//i.test(request.url)) {
            void Linking.openURL(request.url).catch((error: unknown) => {
              if (__DEV__) {
                console.warn(
                  "[LoginWebView] Could not open external URL",
                  sanitizeErrorForLog(error),
                );
              }
            });
          }
          return false;
        }}
        onNavigationStateChange={(state) => {
          if (state.url && isRiotAuthCallbackUrl(state.url)) {
            void completeCallback(state.url);
          }
        }}
        onLoadStart={() => setWebIssue(null)}
        onLoadEnd={() => setWebIssue(null)}
        onError={(event) => {
          if (isRiotAuthCallbackUrl(event.nativeEvent.url || "")) {
            setWebIssue(null);
            return;
          }
          setWebIssue(`${t("login_web_view.error")} (${event.nativeEvent.code})`);
          if (__DEV__) {
            console.log(
              "[LoginWebView] error",
              sanitizeErrorForLog(event.nativeEvent),
            );
          }
        }}
        onHttpError={(event) => {
          if (isRiotAuthCallbackUrl(event.nativeEvent.url || "")) {
            setWebIssue(null);
            return;
          }
          setWebIssue(t("login_web_view.http_error", {
            statusCode: event.nativeEvent.statusCode,
            description: "",
          }).trim());
          if (__DEV__) {
            console.log(
              "[LoginWebView] http-error",
              sanitizeErrorForLog({ status: event.nativeEvent.statusCode }),
            );
          }
        }}
        injectedJavaScriptBeforeContentLoaded={`(function() {
          let attempts = 0;
          const maxAttempts = 250;
          const deleteCookieBanner = () => {
            if (document.getElementsByClassName('osano-cm-window').length > 0) document.getElementsByClassName('osano-cm-window')[0].style = "display:none;";
            else if (attempts++ < maxAttempts) setTimeout(deleteCookieBanner, 20);
          };
          deleteCookieBanner();
        })();`}
      />
      {renderedIssue ? <Text style={styles.issueText}>{renderedIssue}</Text> : null}
      {loading ? (
        <View style={StyleSheet.absoluteFill} accessibilityLiveRegion="polite">
          <Loading msg={loading} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "stretch",
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
