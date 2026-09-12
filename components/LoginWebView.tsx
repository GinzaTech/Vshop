// 📦 LoginWebView.tsx – Component WebView đăng nhập Riot Games
// Cho phép người dùng đăng nhập tài khoản Riot qua trình duyệt embedded (OAuth2),
// xử lý callback URL để lấy access token và id token

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { useUserStore } from "~/hooks/useUserStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { getAccessTokenFromUri, getIdTokenFromUri } from "~/utils/misc";
import { defaultUser } from "~/utils/valorant-api";
import Loading from "./Loading";
import WebView from "react-native-webview";
import { COLORS } from "~/constants/DesignSystem";
import {
  captureRiotAuthCookies,
} from "~/utils/cookies";
import { buildAuthenticatedUser } from "~/utils/auth-session";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { fetchProfileWarmCache } from "~/utils/profile-cache";
import { disconnectChatService } from "~/utils/chat-service";
import { isAllowedRiotAuthNavigation, isRiotAuthCallbackUrl } from "~/utils/riot-auth-navigation";
import { normalizeAccountId } from "~/utils/saved-accounts";
import { finishInteractiveAuthentication, prepareInteractiveAuthentication, restoreCurrentAccountAuthCookies } from "~/services/accounts/session";
import { getSessionGeneration } from "~/utils/session-operations";

// URL đăng nhập Riot OAuth2
const LOGIN_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";
// Thời gian timeout tối đa cho preload profile
const PROFILE_PRELOAD_TIMEOUT_MS = 4500;

/**
 * isAuthCallbackUrl – Kiểm tra URL có phải là callback xác thực không (chứa access_token hoặc id_token)
 * @param url – URL cần kiểm tra
 * @returns true nếu là callback xác thực
 */
/**
 * wait – Tạo promise resolve sau ms mili giây
 * @param ms – Số mili giây chờ
 */
const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

interface LoginWebViewProps {
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
  expectedAccountId?: string;
}

/**
 * LoginWebView – Component WebView login
 * Hiển thị trang đăng nhập Riot, lắng nghe navigation change để bắt callback,
 * xử lý token, tạo authenticated user, preload matches & profile, chuyển hướng
 */
export default function LoginWebView({
  minHeight,
  style,
  expectedAccountId,
}: LoginWebViewProps) {
  const router = useRouter();
  // Hàm setUser từ store (lưu thông tin user sau đăng nhập)
  const activateUser = useUserStore((state) => state.activateUser);

  // State: thông báo loading (hiển thị progress message)
  const [loading, setLoading] = useState<string | null>(null);
  // State: lỗi WebView (nếu có)
  const [webIssue, setWebIssue] = useState<string | null>(null);
  // Ref: ngăn xử lý auth nhiều lần đồng thời
  const authInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    void prepareInteractiveAuthentication().then(() => {
      if (mountedRef.current) setAuthReady(true);
    });
    return () => {
      mountedRef.current = false;
      finishInteractiveAuthentication();
    };
  }, []);
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  // Chiều cao tối thiểu của WebView (tự động tính hoặc nhận từ props)
  const resolvedMinHeight =
    minHeight ?? Math.max(500, Math.min(height * 0.74, 720));

  /**
   * handleWebViewChange – Xử lý sự kiện navigation change của WebView
   * Khi phát hiện callback URL chứa token:
   * 1. Trích xuất access token và id token
   * 2. Xây dựng authenticated user
   * 3. Lưu region
   * 4. Preload matches và profile
   * 5. Chuyển đến màn hình profile
   * @param newNavState – Trạng thái navigation mới (url, loading, ...)
   */
  const handleWebViewChange = async (newNavState: {
    url?: string;
    title?: string;
    loading?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }) => {
    if (!newNavState.url) return;

    if (authReady && mountedRef.current && isRiotAuthCallbackUrl(newNavState.url)) {
      // Nếu đang xử lý auth request trước đó thì bỏ qua
      if (authInFlightRef.current) {
        return;
      }

      authInFlightRef.current = true;
      const generation = getSessionGeneration();
      const isCurrentAttempt = () => mountedRef.current && generation === getSessionGeneration();
      setWebIssue(null);
      // Bắt đầu snapshot khi WebView vẫn còn mounted; iOS cần WebKit store đã
      // được khởi tạo để đọc cookie của phiên vừa hoàn tất.
      const authCookiesPromise = captureRiotAuthCookies("webview");
      const loginStart = Date.now();
      try {
        const accessToken = getAccessTokenFromUri(newNavState.url);
        const idToken = getIdTokenFromUri(newNavState.url);
        const authCookies = await authCookiesPromise;
        if (!isCurrentAttempt()) return;
        // Lấy region từ AsyncStorage hoặc dùng mặc định
        const region =
          (await AsyncStorage.getItem("region")) || defaultUser.region;

        setLoading(t("fetching.storefront"));
        // Xây dựng authenticated user từ token
        const authenticatedUser = await buildAuthenticatedUser(
          accessToken,
          region,
          undefined,
          idToken
        );
        if (!isCurrentAttempt()) return;

        if (
          expectedAccountId &&
          normalizeAccountId(authenticatedUser.id) !==
            normalizeAccountId(expectedAccountId)
        ) {
          await restoreCurrentAccountAuthCookies();
          authInFlightRef.current = false;
          setLoading(null);
          Alert.alert(
            t("settings_page.accounts.switch_failed_title"),
            t("settings_page.accounts.switch_failed_description")
          );
          router.replace("/settings");
          return;
        }

        // Lưu region nếu khác
        if (authenticatedUser.region && authenticatedUser.region !== region) {
          await AsyncStorage.setItem("region", authenticatedUser.region);
        }

        // Login là hành động đổi phiên có chủ đích. Ngắt socket của account cũ,
        // lưu account mới rồi mới kích hoạt để mọi effect chạy đúng credentials.
        if (!isCurrentAttempt()) return;
        disconnectChatService();
        useAccountStore.getState().saveAccount(
          authenticatedUser,
          true,
          authCookies.length ? authCookies : undefined
        );
        activateUser(authenticatedUser);

        setLoading(t("fetching.progress"));

        // Preload matches (không await để không chặn luồng)
        void useMatchStore.getState().fetchMatches(authenticatedUser).catch((preloadErr) => {
          if (__DEV__) {
            console.log("Match preload failed, falling back", preloadErr);
          }
        });

        // Preload profile cache với timeout
        const profileWarmupPromise = fetchProfileWarmCache(authenticatedUser)
          .then((cache) => {
            if (cache) {
              useProfileCacheStore.getState().setProfileCache(cache);
            }
          })
          .catch((preloadErr) => {
            if (__DEV__) {
              console.log("Profile preload failed, falling back", preloadErr);
            }
          });

        // Đảm bảo tối thiểu 2s loading trước khi chuyển màn hình
        const remainingDelay = Math.max(0, 2000 - (Date.now() - loginStart));
        await Promise.allSettled([
          remainingDelay > 0 ? wait(remainingDelay) : Promise.resolve(),
          Promise.race([profileWarmupPromise, wait(PROFILE_PRELOAD_TIMEOUT_MS)]),
        ]);

        if (isCurrentAttempt()) router.replace("/profile");
      } catch {
        if (!isCurrentAttempt()) return;
        authInFlightRef.current = false;
        setLoading(null);
        setWebIssue(t("login_web_view.completion_error"));
        // Keep Riot cookies and retry only the failed completion step.
        Alert.alert(t("login_web_view.completion_error"), t("login_web_view.retry_hint"), [
          { text: t("settings_page.accounts.cancel"), style: "cancel" },
          { text: t("login_web_view.retry"),
            onPress: () => { void handleWebViewChange(newNavState); } },
        ]);
      }
    }
  };

  // Hiển thị màn hình loading với message trong quá trình xử lý đăng nhập
  if (!authReady) {
    return <Loading msg={t("fetching.progress")} />;
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
      {/* WebView đăng nhập Riot */}
      <WebView
        style={styles.webView}
        // User agent giả Android Chrome để tránh bị chặn
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
        source={{
          uri: LOGIN_URL,
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (isAllowedRiotAuthNavigation(request.url)) return true;

          if (/^https?:\/\//i.test(request.url)) {
            void Linking.openURL(request.url).catch((error: unknown) => {
              if (__DEV__) {
                console.warn("[LoginWebView] Could not open external URL", error);
              }
            });
          }
          return false;
        }}
        // Theo dõi navigation để bắt callback auth
        onNavigationStateChange={(state) => {
          void handleWebViewChange(state);
        }}
        onLoadStart={() => {
          setWebIssue(null);
        }}
        onLoadEnd={() => setWebIssue(null)}
        // Xử lý lỗi native
        onError={(event) => {
          if (isRiotAuthCallbackUrl(event.nativeEvent.url || "")) {
            setWebIssue(null);
            return;
          }

          const issue = `${event.nativeEvent.description || t("login_web_view.error")} (${event.nativeEvent.code})`;
          setWebIssue(issue);
          if (__DEV__) {
            console.log("[LoginWebView] error", {
              code: event.nativeEvent.code,
              description: event.nativeEvent.description,
            });
          }
        }}
        // Xử lý lỗi HTTP
        onHttpError={(event) => {
          if (isRiotAuthCallbackUrl(event.nativeEvent.url || "")) {
            setWebIssue(null);
            return;
          }

          const issue = t("login_web_view.http_error", { statusCode: event.nativeEvent.statusCode, description: event.nativeEvent.description || "" }).trim();
          setWebIssue(issue);
          if (__DEV__) {
            console.log("[LoginWebView] http-error", {
              statusCode: event.nativeEvent.statusCode,
              description: event.nativeEvent.description,
            });
          }
        }}
        // Inject JavaScript để ẩn cookie banner Osano
        injectedJavaScriptBeforeContentLoaded={`(function() {
              let attempts = 0;
              const maxAttempts = 250;
              const deleteCookieBanner = () => {
                if (document.getElementsByClassName('osano-cm-window').length > 0) document.getElementsByClassName('osano-cm-window')[0].style = "display:none;";
                else if (attempts++ < maxAttempts) setTimeout(deleteCookieBanner, 20);
              }
              deleteCookieBanner();
            })();`}
      />
      {/* Hiển thị lỗi WebView nếu có */}
      {webIssue ? <Text style={styles.issueText}>{webIssue}</Text> : null}
      {loading ? (
        <View style={StyleSheet.absoluteFill} accessibilityLiveRegion="polite">
          <Loading msg={loading} />
        </View>
      ) : null}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho LoginWebView
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // container – View bọc WebView, bo góc, nền SURFACE
  container: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
  },
  // webView – WebView chiếm toàn bộ không gian
  webView: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
  },
  // issueText – Text hiển thị lỗi WebView (phía dưới cùng)
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
