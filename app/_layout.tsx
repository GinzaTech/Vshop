// 📄 app/_layout.tsx — Root Layout (layout gốc của toàn bộ app)
// Đây là component đầu tiên được mount.
// Nhiệm vụ:
//   - Kết hợp theme Paper + React Navigation thành CombinedAppTheme.
//   - Khởi tạo flow-tracer (debug/tracing).
//   - Bootstrap logic: kiểm tra region → khôi phục session → điều hướng.
//   - Wrap toàn bộ app bằng GestureHandler, PaperProvider, StripeProvider,
//     ThemeProvider và PlausibleProvider.
//   - Định nghĩa Stack navigator với các screen: index, reauth, setup,
//     language, chat/[friendId], (authenticated).

import "~/utils/polyfills";
import {
  Stack,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import "~/utils/localization";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Appbar,
  DefaultTheme as PaperTheme,
  Provider as PaperProvider,
} from "react-native-paper";
import merge from "deepmerge";
import {
  DefaultTheme as NavigationTheme,
  ThemeProvider,
} from "@react-navigation/native";
import React, { useEffect, useRef, useState, type ComponentProps } from "react";
import { View, type GestureResponderEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SplashScreen } from "expo-router";
import { useTranslation } from "react-i18next";
import { initBackgroundFetch, stopBackgroundFetch } from "~/utils/wishlist";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import PlausibleProvider from "~/components/PlausibleProvider";
import { COLORS } from "~/constants/DesignSystem";
import StripeProvider from "~/components/providers/StripeProvider";
import { useUserStore } from "~/hooks/useUserStore";
import {
  canResumeUserSession,
} from "~/utils/auth-session";
import { defaultUser } from "~/utils/valorant-api";
import { flowTracer } from "~/utils/flow-tracer";
import { useCombatStore } from "~/hooks/useCombatStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { ErrorBoundary } from "~/components/ErrorBoundary";
import LoadingScreen from "~/components/LoadingScreen";
import { syncAllData } from "~/utils/data-sync";
import { lockScreenOrientation } from "~/utils/screen-orientation";

/**
 * CombinedAppTheme — Theme tổng hợp từ react-native-paper và @react-navigation/native.
 * Ghi đè các màu sắc bằng Design System tokens (COLORS).
 *
 * - dark: false (luôn là light theme tùy chỉnh).
 * - colors.primary: ACCENT_DEEP.
 * - colors.background: BACKGROUND (xám đen).
 * - colors.surface/card: SURFACE.
 * - colors.text: TEXT_PRIMARY (gần trắng).
 * - colors.placeholder: TEXT_SECONDARY (xám nhạt).
 * - colors.backdrop: OVERLAY.
 * - colors.outlineVariant: BORDER.
 */
export const CombinedAppTheme = {
  ...merge(PaperTheme, NavigationTheme),
  dark: false,
  colors: {
    ...merge(PaperTheme.colors, NavigationTheme.colors),
    primary: COLORS.ACCENT_DEEP,
    accent: COLORS.ACCENT,
    background: COLORS.BACKGROUND,
    surface: COLORS.SURFACE,
    card: COLORS.SURFACE,
    text: COLORS.TEXT_PRIMARY,
    placeholder: COLORS.TEXT_SECONDARY,
    backdrop: COLORS.OVERLAY,
    outlineVariant: COLORS.BORDER,
    onPrimary: "#ffffff",
  },
};

// Ngăn splash screen tự động ẩn — chúng ta tự ẩn sau bootstrap
SplashScreen.preventAutoHideAsync();

/**
 * CustomHeader — Component header tùy chỉnh dùng cho Stack.Screen.
 * Gồm nút Back và title.
 *
 * @param {Object} options - Options từ expo-router (chứa title).
 * @param {Object} navigation - Đối tượng navigation (chứa goBack).
 */
const CustomHeader = ({ options, navigation }: any) => (
  <Appbar.Header
    style={{ backgroundColor: CombinedAppTheme.colors.background, elevation: 0 }}
  >
    <Appbar.BackAction color={CombinedAppTheme.colors.text} onPress={navigation.goBack} />
    <Appbar.Content
      title={options.title}
      titleStyle={{ color: CombinedAppTheme.colors.text }}
    />
  </Appbar.Header>
);

/**
 * RootLayout — Component layout gốc.
 *
 * State:
 * - bootstrappedRef (useRef, boolean): Đánh dấu đã chạy bootstrap một lần.
 * - touchSequenceRef (useRef, number): Đếm số lần touch để tracing.
 * - user (từ useUserStore): Thông tin người dùng.
 * - hydrated (từ useUserStore): Zustand store đã rehydrate chưa.
 * - setUser (từ useUserStore): Hàm cập nhật user.
 *
 * useEffect #1: Khởi tạo flowTracer (connect, global tracing, trace stores).
 * useEffect #2: Khởi tạo/dừng background fetch cho wishlist.
 * useEffect #3: Bootstrap flow (xem chi tiết bên trong).
 *
 * Bootstrap flow:
 *   1. Nếu allowMatchDemo (debug) → bỏ qua, ẩn splash.
 *   2. Đọc region từ AsyncStorage hoặc user store.
 *   3. Nếu không có region → điều hướng đến /setup.
 *   4. Nếu có region + session khả dụng → gọi buildAuthenticatedUser.
 *      - Thành công → cập nhật user, điều hướng đến /profile.
 *      - Thất bại → reset user, điều hướng đến /reauth.
 *   5. Nếu có region nhưng không thể resume → điều hướng đến /reauth.
 *
 * @returns {JSX.Element} Root layout.
 */
function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { demo } = useGlobalSearchParams<{ demo?: string | string[] }>();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const hydrated = useUserStore((state) => state.hydrated);
  const setUser = useUserStore((state) => state.setUser);
  const bootstrappedRef = useRef(false);
  const touchSequenceRef = useRef(0);
  const [isPreloading, setIsPreloading] = useState(false);
  const demoValue = Array.isArray(demo) ? demo[0] : demo;
  const allowMatchDemo =
    __DEV__ &&
    (demoValue === "1" || demoValue === "true") &&
    (pathname === "/history" || pathname.startsWith("/match_details/"));
  const isCombatSessionRoute =
    pathname === "/combat_session" || pathname.endsWith("/combat_session");

  // Every screen stays portrait. The combat session owns its landscape lock
  // while focused, then restores portrait when it closes.
  useEffect(() => {
    if (!isCombatSessionRoute) {
      void lockScreenOrientation("portrait");
    }
  }, [isCombatSessionRoute]);

  // ── Effect 1: Khởi tạo flow-tracer ──
  useEffect(() => {
    flowTracer.connect();
    flowTracer.installGlobalTracing();
    flowTracer.traceZustandStore("useUserStore", useUserStore);
    flowTracer.traceZustandStore("useWishlistStore", useWishlistStore);
    flowTracer.traceZustandStore("useMatchStore", useMatchStore);
    flowTracer.traceZustandStore("useCombatStore", useCombatStore);
    flowTracer.traceZustandStore("useFeatureStore", useFeatureStore);
    flowTracer.traceZustandStore("useProfileCacheStore", useProfileCacheStore);
    flowTracer.startTrace("Vshop App Startup");
    flowTracer.track({
      type: "FUNCTION_CALL",
      label: "RootLayout mounted",
      source: {
        file: "app/_layout.tsx",
        componentName: "RootLayout",
      },
      tool: "Manual",
    });
  }, []);

  // ── Effect 2: Khởi tạo / dừng background fetch cho wishlist ──
  useEffect(() => {
    const notificationEnabled = useWishlistStore.getState().notificationEnabled;
    if (notificationEnabled) {
      initBackgroundFetch();
    } else {
      stopBackgroundFetch();
    }
  }, []);

  // ── Effect 3: Bootstrap — xác định route đầu tiên ──
  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    if (allowMatchDemo) {
      void SplashScreen.hideAsync();
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      // Đọc region từ AsyncStorage hoặc từ store
      const storedRegion = await AsyncStorage.getItem("region");
      const region = storedRegion || user.region || defaultUser.region;

      // Đồng bộ region lên storage nếu chưa có
      if (!storedRegion && user.region) {
        await AsyncStorage.setItem("region", user.region);
      }

      // Không có region => chưa setup lần đầu
      if (!region) {
        if (!cancelled) {
          router.replace("/setup");
        }
        await SplashScreen.hideAsync();
        return;
      }

      // Có region + session khả dụng => hiện loading screen, fetch ALL, rồi vào app
      if (canResumeUserSession(user, region)) {
        // Hiện loading screen ngay lập tức, ẩn splash
        if (!cancelled) setIsPreloading(true);
        await SplashScreen.hideAsync();

        try {
          await Promise.race([
            syncAllData(user, region),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("sync_timeout")), 20_000)
            ),
          ]);

          if (!cancelled) {
            setIsPreloading(false);
            router.replace("/profile");
          }
        } catch (error) {
          const isTimeout = error instanceof Error && error.message === "sync_timeout";

          if (isTimeout) {
            if (!cancelled) {
              setIsPreloading(false);
              router.replace("/profile");
            }
          } else {
            if (!cancelled) {
              setIsPreloading(false);
              setUser({ ...defaultUser, region });
              router.replace("/reauth");
            }
          }
        }
        return;
      }

      // Có region nhưng không có session => đăng nhập
      if (!cancelled) {
        setUser({ ...defaultUser, region });
        router.replace("/reauth");
      }
      await SplashScreen.hideAsync();
    };

    void bootstrap();

    return () => {
      cancelled = true; // Cleanup: tránh setState sau khi unmount
    };
  }, [allowMatchDemo, hydrated, router, setUser, user.accessToken, user.region]);

  /**
   * handleGlobalTouchStart — Handler global cho mọi touch event.
   * Dùng để tracing UI events qua flowTracer.
   *
   * @param {GestureResponderEvent} event - Event touch từ React Native.
   * @returns {boolean} false (không claim responder).
   */
  const handleGlobalTouchStart = (event: GestureResponderEvent) => {
    const touch = event.nativeEvent;
    touchSequenceRef.current += 1;

    flowTracer.track({
      type: "UI_EVENT",
      label: `Touch #${touchSequenceRef.current} on ${pathname || "unknown route"}`,
      source: {
        file: "app/_layout.tsx",
        componentName: "RootLayout",
        functionName: "onStartShouldSetResponderCapture",
      },
      input: {
        route: pathname,
        target: touch.target,
        pageX: Math.round(touch.pageX),
        pageY: Math.round(touch.pageY),
        locationX: Math.round(touch.locationX),
        locationY: Math.round(touch.locationY),
        timestamp: touch.timestamp,
      },
      tool: "Manual",
    });

    return false;
  };

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={handleGlobalTouchStart}
      >
        {isPreloading ? (
          <LoadingScreen message="Loading data..." />
        ) : (
        <PlausibleProvider>
          {/* SafeAreaView phía trên (status bar) */}
          <SafeAreaView
            style={{ backgroundColor: CombinedAppTheme.colors.background }}
          />
          <PaperProvider theme={CombinedAppTheme}>
            <StripeProvider
              publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLIC_KEY ?? ""}
            >
              <ThemeProvider value={CombinedAppTheme}>
                <Stack
                  screenOptions={{
                    headerStyle: {
                      backgroundColor: CombinedAppTheme.colors.background,
                    },
                    headerTintColor: CombinedAppTheme.colors.text,
                    header: CustomHeader,
                    gestureEnabled: false, // Tắt gesture back mặc định
                    animation: "slide_from_right",
                    animationDuration: 250,
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="reauth" options={{ headerShown: false }} />
                  <Stack.Screen name="setup" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="language"
                    options={{ presentation: "modal", title: t("language") }}
                  />
                  <Stack.Screen
                    name="chat/[friendId]"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="(authenticated)"
                    options={{ headerShown: false }}
                  />
                </Stack>
              </ThemeProvider>
            </StripeProvider>
          </PaperProvider>
        </PlausibleProvider>
        )}
      </View>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default RootLayout;
