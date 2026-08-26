// 📦 LoginWebView.tsx – Component WebView đăng nhập Riot Games
// Cho phép người dùng đăng nhập tài khoản Riot qua trình duyệt embedded (OAuth2),
// xử lý callback URL để lấy access token và id token

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from "react-native";
import { useUserStore } from "~/hooks/useUserStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { getAccessTokenFromUri, getIdTokenFromUri } from "~/utils/misc";
import { defaultUser } from "~/utils/valorant-api";
import Loading from "./Loading";
import WebView from "react-native-webview";
import { COLORS } from "~/constants/DesignSystem";
import { clearAllCookies } from "~/utils/cookies";
import { buildAuthenticatedUser } from "~/utils/auth-session";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { fetchProfileWarmCache } from "~/utils/profile-cache";
import { disconnectChatService } from "~/utils/chat-service";
import { isAllowedRiotAuthNavigation } from "~/utils/riot-auth-navigation";

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
const isAuthCallbackUrl = (url?: string) =>
  Boolean(url && (url.includes("access_token=") || url.includes("id_token=")));

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
}

/**
 * LoginWebView – Component WebView login
 * Hiển thị trang đăng nhập Riot, lắng nghe navigation change để bắt callback,
 * xử lý token, tạo authenticated user, preload matches & profile, chuyển hướng
 */
export default function LoginWebView({
  minHeight,
  style,
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

    if (isAuthCallbackUrl(newNavState.url)) {
      // Nếu đang xử lý auth request trước đó thì bỏ qua
      if (authInFlightRef.current) {
        return;
      }

      authInFlightRef.current = true;
      setWebIssue(null);
      const accessToken = getAccessTokenFromUri(newNavState.url);
      const idToken = getIdTokenFromUri(newNavState.url);
      const loginStart = Date.now();
      try {
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

        // Lưu region nếu khác
        if (authenticatedUser.region && authenticatedUser.region !== region) {
          await AsyncStorage.setItem("region", authenticatedUser.region);
        }

        // Login là hành động đổi phiên có chủ đích. Ngắt socket của account cũ,
        // lưu account mới rồi mới kích hoạt để mọi effect chạy đúng credentials.
        disconnectChatService();
        useAccountStore.getState().saveAccount(authenticatedUser, true);
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

        router.replace("/profile");
      } catch (e) {
        if (__DEV__) console.log(e);
        authInFlightRef.current = false;

        // Trong production: xóa cookies và chuyển về setup để không bị kẹt
        if (!__DEV__) {
          await clearAllCookies(true);
          router.replace("/setup");
        }
      }
    }
  };

  // Hiển thị màn hình loading với message trong quá trình xử lý đăng nhập
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
          if (isAuthCallbackUrl(event.nativeEvent.url)) {
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
          if (isAuthCallbackUrl(event.nativeEvent.url)) {
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
