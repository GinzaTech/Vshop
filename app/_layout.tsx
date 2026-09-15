// 📄 app/_layout.tsx — Root Layout (layout gốc của toàn bộ app)
// Đây là component đầu tiên được mount.
// Nhiệm vụ:
//   - Kết hợp theme Paper + React Navigation thành CombinedAppTheme.
//   - Khởi tạo flow-tracer (debug/tracing).
//   - Bootstrap logic: kiểm tra region → khôi phục session → điều hướng.
//   - Wrap toàn bộ app bằng GestureHandler, PaperProvider,
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
} from "expo-router/react-navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  StatusBar,
  View,
  type GestureResponderEvent,
} from "react-native";
import * as SystemUI from "expo-system-ui";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SplashScreen } from "expo-router";
import { useTranslation } from "react-i18next";
import { initBackgroundFetch, stopBackgroundFetch } from "~/utils/wishlist";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import PlausibleProvider from "~/components/PlausibleProvider";
import { COLORS } from "~/constants/DesignSystem";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  canResumeUserSession,
  isReauthenticationRequiredError,
} from "~/utils/auth-session";
import { defaultUser } from "~/utils/valorant-api";
import { flowTracer } from "~/utils/flow-tracer";
import { useCombatStore } from "~/hooks/useCombatStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { ErrorBoundary } from "~/components/ErrorBoundary";
import LoadingScreen from "~/components/LoadingScreen";
import { syncAllData } from "~/utils/data-sync";
import {
  getScreenOrientationForPathname,
  lockScreenOrientation,
} from "~/utils/screen-orientation";
import {
  isRiotAuthenticationError,
  isTransientNetworkError,
} from "~/utils/session-events";
import { MOTION_DURATION, MOTION_TIMING } from "~/constants/Motion";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import { markAppInteractive } from "~/utils/startup-performance";
import { hasUsableStartupCache } from "~/utils/startup-cache";
import { renewSavedAccountSession } from "~/services/accounts/session";
import { isSessionChangedError } from "~/utils/session-operations";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";

type CustomHeaderProps = {
  options: { title?: string };
  navigation: { goBack: () => void };
};

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

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
const CustomHeader = ({ options, navigation }: CustomHeaderProps) => (
  <Appbar.Header
    style={{ backgroundColor: CombinedAppTheme.colors.background, elevation: 0 }}
  >
    <Appbar.BackAction color={CombinedAppTheme.colors.text} onPress={navigation.goBack} />
    <Appbar.Content
      title={options.title ?? ""}
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
 *   1. Nếu allowDemoRoute (debug) → bỏ qua, ẩn splash.
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
  const reduceMotionEnabled = useMotionPreference();
  const router = useRouter();
  const pathname = usePathname();
  const { demo } = useGlobalSearchParams<{ demo?: string | string[] }>();
  const { t } = useTranslation();
  const hydrated = useUserStore((state) => state.hydrated);
  const accountsHydrated = useAccountStore((state) => state.hydrated);
  const setUser = useUserStore((state) => state.setUser);
  const topInsetTone = useSystemChromeStore((state) => state.topInsetTone);
  const topInsetProgress = useSharedValue(topInsetTone === "dark" ? 1 : 0);
  const bootstrappedRef = useRef(false);
  const nativeSplashHiddenRef = useRef(false);
  const touchSequenceRef = useRef(0);
  const startupWaitResolverRef = useRef<
    ((action: "retry" | "cache") => void) | null
  >(null);
  const [isPreloading, setIsPreloading] = useState(true);
  const [startupMessage, setStartupMessage] = useState("Preparing your VShop");
  const [startupRecovery, setStartupRecovery] = useState({
    visible: false,
    canUseCachedData: false,
  });
  const allowDemoRoute = isDevelopmentDemoRoute({
    demo,
    isDev: __DEV__,
    pathname,
  });
  const requiredScreenOrientation = getScreenOrientationForPathname(pathname);

  /**
   * requestStartupRetry — Yêu cầu vòng bootstrap thử lại ngay lập tức.
   * Được bắn khi user bấm "Retry" trên LoadingScreen ở giai đoạn startup.
   * Side effect: resolve promise đang chờ trong waitForRecovery với "retry"
   * (reset backoff delay về 1.5s).
   */
  const requestStartupRetry = useCallback(() => {
    startupWaitResolverRef.current?.("retry");
  }, []);

  /**
   * requestCachedStartup — Yêu cầu bootstrap dùng dữ liệu cache đã lưu.
   * Được bắn khi user chọn "Use cached data" trên LoadingScreen (chỉ hiện
   * khi hasUsableStartupCache cho phép). Side effect: điều hướng /profile
   * bằng dữ liệu cache thay vì chờ sync thành công.
   */
  const requestCachedStartup = useCallback(() => {
    startupWaitResolverRef.current?.("cache");
  }, []);

  // Effect: Đồng bộ màu hệ điều hành (SystemUI) và animate màu SafeAreaView
  // theo tone của top inset (dark/light). Re-run khi topInsetTone đổi hoặc
  // khi Reduce Motion bật/tắt (duration = 0 nếu reduce motion).
  useEffect(() => {
    const topInsetColor =
      topInsetTone === "dark"
        ? COLORS.PURE_BLACK
        : CombinedAppTheme.colors.background;
    void SystemUI.setBackgroundColorAsync(topInsetColor);
    topInsetProgress.value = withTiming(
      topInsetTone === "dark" ? 1 : 0,
      { ...MOTION_TIMING.standard, duration: reduceMotionEnabled ? 0 : MOTION_TIMING.standard.duration },
    );
  }, [reduceMotionEnabled, topInsetProgress, topInsetTone]);

  // The native splash is only a launch hand-off. Once persisted state is
  // ready, reveal the branded React shell immediately instead of holding the
  // user on a static grey icon while AsyncStorage/bootstrap work continues.
  useEffect(() => {
    if (!hydrated || nativeSplashHiddenRef.current) return;

    const hideTimer = setTimeout(() => {
      nativeSplashHiddenRef.current = true;
      void SplashScreen.hideAsync();
    }, 0);

    return () => clearTimeout(hideTimer);
  }, [hydrated]);

  // Animated style: nội suy màu nền SafeAreaView giữa background app và đen
  // theo tiến độ topInsetProgress (chạy trên UI thread bằng Reanimated).
  const topInsetAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      topInsetProgress.value,
      [0, 1],
      [CombinedAppTheme.colors.background, COLORS.PURE_BLACK],
    ),
  }));

  // Combat session is always landscape; every other route is always portrait.
  // Re-apply the route lock after returning from the background because some
  // Android vendors can drop the Activity orientation request while suspended.
  useEffect(() => {
    const applyRequiredOrientation = () => {
      void lockScreenOrientation(requiredScreenOrientation);
    };

    applyRequiredOrientation();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        applyRequiredOrientation();
      }
    });

    return () => subscription.remove();
  }, [requiredScreenOrientation]);

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
  // FIX (L5): đọc `notificationEnabled` QUA subscription thay vì đọc 1 lần lúc
  // mount. Persist hydration là async (fallback AsyncStorage path) — trước đây
  // effect chạy trước khi store hydrate xong → đọc được default `false` → gọi
  // stopBackgroundFetch() và wishlist nền bị tắt cả session dù user đã bật.
  useEffect(() => {
    const syncBackgroundFetch = () => {
      const notificationEnabled =
        useWishlistStore.getState().notificationEnabled;
      if (notificationEnabled) {
        initBackgroundFetch();
      } else {
        stopBackgroundFetch();
      }
    };
    // Chạy ngay (path MMKV hydrate sync) + subscribe để bắt thay đổi sau hydrate
    const unsubscribe = useWishlistStore.subscribe(syncBackgroundFetch);
    syncBackgroundFetch();
    return unsubscribe;
  }, []);

  // ── Effect 3: Bootstrap — xác định route đầu tiên ──
  useEffect(() => {
    if (!hydrated || !accountsHydrated || bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    if (allowDemoRoute) {
      setIsPreloading(false);
      markAppInteractive(pathname === "/profile" ? "profile-demo" : "match-demo");
      void SplashScreen.hideAsync();
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const sessionUser = useUserStore.getState().user;
      // Đọc region từ AsyncStorage hoặc từ store
      const storedRegion = await AsyncStorage.getItem("region");
      const region = storedRegion || sessionUser.region || defaultUser.region;

      // Đồng bộ region lên storage nếu chưa có
      if (!storedRegion && sessionUser.region) {
        await AsyncStorage.setItem("region", sessionUser.region);
      }

      // Không có region => chưa setup lần đầu
      if (!region) {
        if (!cancelled) {
          router.replace("/setup");
          setIsPreloading(false);
          markAppInteractive("setup");
        }
        await SplashScreen.hideAsync();
        return;
      }

       // Keep the branded shell visible until every core authenticated source
       // is ready. The user requested a complete, usable app rather than a
       // cache-first screen that later fails when its APIs are stale.
       if (sessionUser.accessToken && sessionUser.id) {
        let syncUser = sessionUser;
        let retryDelayMs = 1_500;
        let silentRecoveryAttempted = false;

        const waitForRecovery = async () => {
          const canUseCachedData = await hasUsableStartupCache(syncUser);
          if (cancelled) return true;

          setStartupRecovery({ visible: true, canUseCachedData });
          const action = await new Promise<"auto" | "retry" | "cache">(
            (resolve) => {
              let settled = false;
              const finish = (result: "auto" | "retry" | "cache") => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                startupWaitResolverRef.current = null;
                resolve(result);
              };
              const timer = setTimeout(() => finish("auto"), retryDelayMs);
              startupWaitResolverRef.current = (result) => finish(result);
            }
          );

          if (cancelled) return true;
          setStartupRecovery({ visible: false, canUseCachedData: false });

          if (action === "cache" && canUseCachedData) {
            router.replace("/profile");
            setIsPreloading(false);
            markAppInteractive("profile-cached");
            return true;
          }
          if (action === "retry") {
            retryDelayMs = 1_500;
          } else {
            retryDelayMs = Math.min(retryDelayMs * 2, 10_000);
          }
          return false;
        };

        while (!cancelled) {
          try {
            syncUser = useUserStore.getState().user;
            if (!canResumeUserSession(syncUser, region)) {
              if (!cancelled) setStartupMessage("Restoring your Riot session");
              syncUser = await renewSavedAccountSession({ ...syncUser, region });
            }

            if (!cancelled) setStartupMessage("Loading your VShop data");
            await syncAllData(syncUser, syncUser.region || region);
            setStartupRecovery({ visible: false, canUseCachedData: false });

            if (!cancelled) {
              router.replace("/profile");
              setIsPreloading(false);
              markAppInteractive("profile");
            }
            return;
          } catch (error) {
            if (cancelled) return;

            if (isSessionChangedError(error)) {
              if (!useUserStore.getState().user.id) return;
              setStartupMessage("Restoring your Riot session");
              if (await waitForRecovery()) return;
              continue;
            }

            let recoveryError: unknown = error;
            if (isRiotAuthenticationError(error) && !silentRecoveryAttempted) {
              silentRecoveryAttempted = true;
              try {
                setStartupMessage("Refreshing your Riot session");
                syncUser = await renewSavedAccountSession(
                  useUserStore.getState().user
                );
                continue;
              } catch (renewError) {
                recoveryError = renewError;
              }
            }

            if (isReauthenticationRequiredError(recoveryError)) {
              // Preserve account identity and cache while the user signs in.
              router.replace("/reauth");
              setIsPreloading(false);
              markAppInteractive("reauth");
              return;
            }

            setStartupMessage(isTransientNetworkError(recoveryError)
              ? "Waiting for Riot services…"
              : "Unable to refresh data. Retry or use your saved data.");
            if (await waitForRecovery()) return;
            silentRecoveryAttempted = false;
          }
        }
        return;
      }

      // Có region nhưng không có session => đăng nhập
      if (!cancelled) {
        setUser({ ...defaultUser, region });
        router.replace("/reauth");
        setIsPreloading(false);
        markAppInteractive("reauth");
      }
      await SplashScreen.hideAsync();
    };

    void bootstrap();

    return () => {
      cancelled = true; // Cleanup: tránh setState sau khi unmount
      startupWaitResolverRef.current?.("retry");
      startupWaitResolverRef.current = null;
      // FIX (L13): cho phép bootstrap chạy lại nếu effect được tear-down rồi
      // mount lại (deps đổi giữa chừng). Trước đây bootstrappedRef giữ true
      // mãi → lần re-run bị return sớm → isPreloading kẹt true, app kẹt dưới
      // LoadingScreen vĩnh viễn.
      bootstrappedRef.current = false;
    };
  }, [accountsHydrated, allowDemoRoute, hydrated, pathname, router, setUser]);

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
        <PlausibleProvider>
          {/* SafeAreaView phía trên (status bar) */}
          <StatusBar
            animated={!reduceMotionEnabled}
            backgroundColor={
              topInsetTone === "dark"
                ? COLORS.PURE_BLACK
                : CombinedAppTheme.colors.background
            }
            barStyle={
              topInsetTone === "dark" ? "light-content" : "dark-content"
            }
          />
          <AnimatedSafeAreaView
            edges={["top"]}
            style={topInsetAnimatedStyle}
          />
          <PaperProvider theme={CombinedAppTheme}>
            <ThemeProvider value={CombinedAppTheme}>
              <Stack
                screenOptions={{
                  headerStyle: {
                    backgroundColor: CombinedAppTheme.colors.background,
                  },
                  headerTintColor: CombinedAppTheme.colors.text,
                  header: CustomHeader,
                  gestureEnabled: true,
                  animation: reduceMotionEnabled ? "none" : "slide_from_right",
                  animationDuration: MOTION_DURATION.standard,
                  contentStyle: { backgroundColor: COLORS.BACKGROUND },
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
          </PaperProvider>
        </PlausibleProvider>
        {isPreloading ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 1000,
            }}
          >
            <LoadingScreen
              message={startupMessage}
              showRecoveryActions={startupRecovery.visible}
              canUseCachedData={startupRecovery.canUseCachedData}
              onRetry={requestStartupRetry}
              onUseCachedData={requestCachedStartup}
            />
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default RootLayout;
