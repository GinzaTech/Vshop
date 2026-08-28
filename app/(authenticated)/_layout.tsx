// 📄 app/(authenticated)/_layout.tsx — Layout cho nhóm màn hình đã xác thực
// Sử dụng Tab Navigator (expo-router Tabs) với FloatingTabBar tùy chỉnh.
// Bao gồm AppWarmup (khởi tạo dữ liệu nền) và MediaPopup (popup media toàn app).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Tabs } from "expo-router";
import type { BottomTabNavigationOptions } from "expo-router/tabs";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import AppWarmup from "~/components/AppWarmup";
import MediaPopup from "~/components/popups/MediaPopup";
import { COLORS, SHADOWS } from "~/constants/DesignSystem";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { useUserStore } from "~/hooks/useUserStore";
import { flowTracer } from "~/utils/flow-tracer";
import { runWhenIdle } from "~/utils/idle-task";
import { MOTION_DURATION, MOTION_TIMING } from "~/constants/Motion";

type FloatingRoute = {
  key: string;
  name: string;
  params?: unknown;
};

type FloatingTabBarProps = {
  state: {
    index: number;
    routes: FloatingRoute[];
  };
  descriptors: Record<
    string,
    { options?: { tabBarAccessibilityLabel?: string } }
  >;
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (routeName: string) => void;
    preload?: (routeName: string) => void;
  };
};

/**
 * PRIMARY_ROUTES — Định nghĩa các tab chính hiển thị trên thanh điều hướng.
 * Key: tên route, value: { icon (tên MaterialCommunityIcons), label (text hiển thị) }.
 */
const PRIMARY_ROUTES: Record<
  string,
  { icon: ComponentProps<typeof Icon>["name"]; label: string }
> = {
  bundles: { icon: "package-variant-closed", label: "Bundles" },
  shop: { icon: "shopping-outline", label: "Store" },
  profile: { icon: "account-circle-outline", label: "Profile" },
  night_market: { icon: "weather-night", label: "Market" },
  settings: { icon: "dots-grid", label: "More" },
};

/**
 * PRIMARY_ROUTE_ORDER — Thứ tự hiển thị các tab trên thanh điều hướng.
 */
const PRIMARY_ROUTE_ORDER = [
  "bundles",
  "shop",
  "profile",
  "night_market",
  "settings",
] as const;

type TabSceneInterpolator = NonNullable<
  BottomTabNavigationOptions["sceneStyleInterpolator"]
>;

export const PRIMARY_TAB_SLIDE_DISTANCE = Dimensions.get("window").width;

const primaryTabSceneInterpolator: TabSceneInterpolator = ({ current }) => ({
  sceneStyle: {
    opacity: 1,
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [
            -PRIMARY_TAB_SLIDE_DISTANCE,
            0,
            PRIMARY_TAB_SLIDE_DISTANCE,
          ],
        }),
      },
    ],
  },
});

export const PRIMARY_TAB_SCREEN_TRANSITION = {
  animation: "shift",
  sceneStyleInterpolator: primaryTabSceneInterpolator,
  transitionSpec: {
    animation: "timing",
    config: {
      duration: MOTION_DURATION.emphasized,
      easing: MOTION_TIMING.emphasized.easing,
    },
  },
} satisfies Pick<
  BottomTabNavigationOptions,
  "animation" | "sceneStyleInterpolator" | "transitionSpec"
>;

export const PRIMARY_TAB_SCREEN_OPTIONS = {
  lazy: true,
  freezeOnBlur: false,
  ...PRIMARY_TAB_SCREEN_TRANSITION,
} as const;

export const PRIMARY_TAB_REDUCED_MOTION_OPTIONS = {
  lazy: true,
  freezeOnBlur: false,
  animation: "none",
} as const;

/**
 * FloatingTabBar — Thanh tab nổi (floating) tùy chỉnh.
 *
 * Props: nhận state, descriptors, navigation từ Tabs render prop.
 *
 * State:
 * - insets (từ useSafeAreaInsets): Safe area bottom để padding.
 * - viewportWidth (từ useWindowDimensions): Chiều rộng màn hình để tính width thanh tab.
 * - hasNightMarketItems (từ useUserStore): Có items trong night market?
 * - collapsed (state, boolean): Thanh tab đang thu gọn (chỉ hiện nút tròn)?
 * - collapseProgress (SharedValue<number>): Giá trị Reanimated animation mở/thu gọn (1 = mở, 0 = thu).
 * - moreLongPressHandledRef (useRef): Đánh dấu long press đã được xử lý.
 * - wasHiddenRef (useRef): Đánh dấu tab bar vừa ẩn (đang ở sub-screen).
 * - shouldJump (SharedValue<boolean>): true → indicator nhảy thẳng (không animate) khi lần đầu mount hoặc Back từ sub-screen.
 * - activeRoute: Route hiện tại đang active.
 *
 * Animation (Reanimated, chạy trên UI thread):
 * - Khi collapsed = true: thanh thu gọn thành nút tròn nhỏ (74×74), dịch chuyển sang phải.
 * - Khi collapsed = false: thanh mở rộng full width với tất cả tab.
 * - Sliding indicator theo tab active bằng timing trên UI thread.
 * - collapseProgress dùng motion token và tôn trọng Reduce Motion của hệ điều hành.
 *
 * Logic:
 * - Tab "night_market" chỉ hiện nếu hasNightMarketItems === true.
 * - Tab "settings" long press ≥ 1s → thu gọn thanh.
 * - Khi thanh thu gọn, nhấn/long press vào nút "More" để mở rộng lại.
 * - Back từ sub-screen → indicator jump thẳng (không slide) nhờ shouldJump.
 *
 * @returns {JSX.Element | null} Thanh tab hoặc null nếu route không phải primary.
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotion();
  const primaryNavigationTone = useSystemChromeStore(
    (chrome) => chrome.primaryNavigationTone,
  );
  const hasNightMarketItems = useUserStore(
    ({ user }) => user.shops.nightMarket.length > 0
  );
  const [collapsed, setCollapsed] = useState(false);
  const collapseProgress = useSharedValue(1); // 1 = mở, 0 = thu gọn
  const moreLongPressHandledRef = useRef(false);
  const preloadedRouteNamesRef = useRef(new Set<string>());
  const indicatorTranslateX = useSharedValue(0);
  const transitionInProgressRef = useRef(false);
  const activeRoute = state.routes[state.index];

  const unlockTabTransition = useCallback(() => {
    transitionInProgressRef.current = false;
  }, []);

  // Track khi tab bar chuyển từ hidden → visible (Back từ sub-screen)
  // Khi visible lại → indicator JUMP trực tiếp, không animate
  const isPrimaryRoute = activeRoute?.name in PRIMARY_ROUTES;
  const wasHiddenRef = useRef(false);
  const shouldJump = useSharedValue(true); // true lần đầu mount

  useEffect(() => {
    if (isPrimaryRoute && wasHiddenRef.current) {
      // Vừa quay lại từ sub-screen → jump, không slide
      shouldJump.value = true;
    }
    wasHiddenRef.current = !isPrimaryRoute;
  }, [isPrimaryRoute, shouldJump]);

  // Animation khi thay đổi trạng thái collapsed
  useEffect(() => {
    collapseProgress.value = withTiming(
      collapsed ? 0 : 1,
      MOTION_TIMING.emphasized,
    );
  }, [collapseProgress, collapsed]);

  // Lọc và sắp xếp các route primary (tính trước để dùng cho sliding indicator)
  const visibleRoutes = useMemo(
    () =>
      state.routes
        .filter(
          (route) =>
            route.name in PRIMARY_ROUTES &&
            (route.name !== "night_market" || hasNightMarketItems),
        )
        .sort(
          (left, right) =>
            PRIMARY_ROUTE_ORDER.indexOf(
              left.name as (typeof PRIMARY_ROUTE_ORDER)[number],
            ) -
            PRIMARY_ROUTE_ORDER.indexOf(
              right.name as (typeof PRIMARY_ROUTE_ORDER)[number],
            ),
        ),
    [hasNightMarketItems, state.routes],
  );

  // ── Sliding tab indicator ──
  // Mỗi tab dùng flex: 1 nên chia đều content width; indicator dịch chuyển theo index.
  const TAB_PADDING_H = 18; // = paddingHorizontal của expandedTabContent
  const INDICATOR_SIZE = 44;
  const COLLAPSED_BAR_SIZE = 62;
  const EXPANDED_BAR_HEIGHT = 68;
  const expandedBarWidth = Math.min(
    560,
    viewportWidth - 24,
    Math.round(viewportWidth * (hasNightMarketItems ? 0.88 : 0.78))
  );
  const collapsedTranslateX = Math.max(
    0,
    viewportWidth / 2 - 22 - COLLAPSED_BAR_SIZE / 2
  );
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === activeRoute?.key)
  );
  const tabButtonWidth =
    visibleRoutes.length > 0
      ? (expandedBarWidth - TAB_PADDING_H * 2) / visibleRoutes.length
      : INDICATOR_SIZE;
  const indicatorTargetX =
    activeVisibleIndex * tabButtonWidth +
    (tabButtonWidth - INDICATOR_SIZE) / 2;

  useEffect(() => {
    if (!navigation.preload) return;

    // Chuẩn bị các scene nặng sau khi frame hiện tại rảnh. Khi người dùng
    // bấm tab, React không còn phải mount cả page trên đường animation.
    const idleTask = runWhenIdle(() => {
      for (const route of visibleRoutes) {
        if (
          route.key === activeRoute?.key ||
          preloadedRouteNamesRef.current.has(route.name)
        ) {
          continue;
        }
        navigation.preload?.(route.name);
        preloadedRouteNamesRef.current.add(route.name);
      }
    });

    return idleTask.cancel;
  }, [activeRoute?.key, navigation, visibleRoutes]);

  useEffect(() => {
    if (!isPrimaryRoute) return;
    if (shouldJump.value) {
      indicatorTranslateX.value = indicatorTargetX;
      shouldJump.value = false;
      return;
    }
    // onPress đã khởi động indicator cùng lúc với scene transition.
    if (transitionInProgressRef.current) return;
    indicatorTranslateX.value = withTiming(
      indicatorTargetX,
      MOTION_TIMING.standard,
    );
  }, [
    indicatorTargetX,
    indicatorTranslateX,
    isPrimaryRoute,
    shouldJump,
  ]);
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      collapseProgress.value,
      [0, 1],
      [COLLAPSED_BAR_SIZE, expandedBarWidth]
    ),
    height: interpolate(
      collapseProgress.value,
      [0, 1],
      [COLLAPSED_BAR_SIZE, EXPANDED_BAR_HEIGHT]
    ),
    borderRadius: interpolate(collapseProgress.value, [0, 1], [37, 32]),
    transform: [
      {
        translateX: interpolate(
          collapseProgress.value,
          [0, 1],
          [collapsedTranslateX, 0]
        ),
      },
    ],
  }));
  const expandedContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapseProgress.value, [0, 0.35, 1], [0, 0, 1]),
    transform: [
      {
        scale: interpolate(collapseProgress.value, [0, 1], [0.94, 1]),
      },
    ],
  }));
  const collapsedContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapseProgress.value, [0, 0.45, 1], [1, 0, 0]),
    transform: [
      {
        scale: interpolate(collapseProgress.value, [0, 1], [1, 0.84]),
      },
    ],
  }));
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const targetX =
      activeVisibleIndex * tabButtonWidth +
      (tabButtonWidth - INDICATOR_SIZE) / 2;

    // Jump trực tiếp (Back navigation hoặc first mount) — KHÔNG animate
    if (shouldJump.value) {
      return {
        opacity: collapseProgress.value,
        transform: [{ translateX: targetX }],
      };
    }

    // User chủ động đổi tab → animate slide
    return {
      opacity: collapseProgress.value,
      transform: [{ translateX: indicatorTranslateX.value }],
    };
  });
  // Nếu route hiện tại không phải primary → ẩn tab bar
  if (!(activeRoute?.name in PRIMARY_ROUTES)) {
    return null;
  }

  return (
    <View
      style={[
        styles.tabBarWrap,
        Platform.OS === "web" && styles.tabBarWrapWeb,
        {
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <Reanimated.View
        style={[
          styles.tabBarFrame,
          primaryNavigationTone === "light" && styles.tabBarFrameLight,
          Platform.OS === "web" && styles.tabBarWeb,
          tabBarAnimatedStyle,
        ]}
      >
        <View style={styles.tabBarClip}>
          {!collapsed ? (
            <Reanimated.View
              style={[
                styles.expandedTabContent,
                expandedContentAnimatedStyle,
              ]}
            >
            {/* Sliding indicator phía sau tab đang active */}
            <Reanimated.View
              pointerEvents="none"
              testID="primary-tab-indicator"
              style={[
                styles.tabIndicator,
                primaryNavigationTone === "light" && styles.tabIndicatorLight,
                indicatorAnimatedStyle,
              ]}
            />
            {visibleRoutes.map((route) => {
              const routeIndex = state.routes.findIndex(
                (item) => item.key === route.key
              );
              const focused = state.index === routeIndex;
              const { icon } = PRIMARY_ROUTES[route.name];
              const options = descriptors[route.key]?.options ?? {};
              const isMoreRoute = route.name === "settings";

              return (
                <Pressable
                  key={route.key}
                  testID={`primary-tab-${route.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    options.tabBarAccessibilityLabel ??
                    PRIMARY_ROUTES[route.name].label
                  }
                  accessibilityState={{ selected: focused }}
                  delayLongPress={isMoreRoute ? 1000 : undefined}
                  onLongPress={
                    isMoreRoute
                      ? () => {
                          moreLongPressHandledRef.current = true;
                          setCollapsed(true);
                        }
                      : undefined
                  }
                  onPress={() => {
                    if (transitionInProgressRef.current) return;

                    if (moreLongPressHandledRef.current) {
                      moreLongPressHandledRef.current = false;
                      return;
                    }

                    const event = navigation.emit({
                      type: "tabPress",
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!focused && !event.defaultPrevented) {
                      flowTracer.startTrace(
                        `Vshop Tab Navigation: ${activeRoute.name} to ${route.name}`
                      );
                      flowTracer.track({
                        type: "UI_EVENT",
                        label: `User presses ${route.name} tab`,
                        source: {
                          file: "app/(authenticated)/_layout.tsx",
                          componentName: "FloatingTabBar",
                          functionName: "onPress",
                        },
                        input: { from: activeRoute.name, to: route.name },
                        tool: "Manual",
                      });
                      flowTracer.track({
                        type: "NAVIGATION",
                        label: `navigation.navigate('${route.name}')`,
                        source: {
                          file: "app/(authenticated)/_layout.tsx",
                          functionName: "navigation.navigate",
                        },
                        input: { from: activeRoute.name, to: route.name },
                        tool: "React Navigation",
                      });

                      if (reduceMotionEnabled) {
                        navigation.navigate(route.name);
                        return;
                      }

                      const targetVisibleIndex = Math.max(
                        0,
                        visibleRoutes.findIndex(
                          (visibleRoute) => visibleRoute.key === route.key,
                        ),
                      );
                      const targetIndicatorX =
                        targetVisibleIndex * tabButtonWidth +
                        (tabButtonWidth - INDICATOR_SIZE) / 2;
                      transitionInProgressRef.current = true;
                      indicatorTranslateX.value = withTiming(
                        targetIndicatorX,
                        MOTION_TIMING.emphasized,
                        () => {
                          scheduleOnRN(unlockTabTransition);
                        },
                      );
                      navigation.navigate(route.name);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.tabButton,
                    pressed && styles.tabButtonPressed,
                  ]}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.tabIconWrap,
                        pressed &&
                          !focused &&
                          (primaryNavigationTone === "light"
                            ? styles.tabIconWrapPressedLight
                            : styles.tabIconWrapPressed),
                      ]}
                    >
                      <Icon
                        name={icon}
                        size={22}
                        color={
                          focused
                            ? primaryNavigationTone === "light"
                              ? COLORS.PURE_WHITE
                              : COLORS.PURE_BLACK
                            : primaryNavigationTone === "light" || pressed
                              ? COLORS.TEXT_PRIMARY
                              : COLORS.PURE_WHITE
                        }
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
            </Reanimated.View>
          ) : (
            <Reanimated.View
              style={[
                styles.collapsedTabContent,
                collapsedContentAnimatedStyle,
              ]}
            >
            <Pressable
              testID="primary-navigation-expand"
              accessibilityRole="button"
              accessibilityLabel="Expand navigation"
              delayLongPress={600}
              onLongPress={() => setCollapsed(false)}
              onPress={() => {
                moreLongPressHandledRef.current = false;
                setCollapsed(false);
              }}
              style={({ pressed }) => [
                styles.collapsedTabButton,
                primaryNavigationTone === "light" && styles.collapsedTabButtonLight,
                pressed && styles.collapsedTabButtonPressed,
              ]}
            >
              <Icon
                name="dots-grid"
                size={26}
                color={
                  primaryNavigationTone === "light"
                    ? COLORS.PURE_WHITE
                    : COLORS.PURE_BLACK
                }
              />
            </Pressable>
            </Reanimated.View>
          )}
        </View>
      </Reanimated.View>
    </View>
  );
}

/**
 * Layout — Component chính của authenticated group.
 *
 * Sử dụng Tabs (expo-router) với:
 * - initialRouteName: "profile"
 * - backBehavior: "history"
 * - tabBar: FloatingTabBar tùy chỉnh
 * - headerShown: false, tabBarShowLabel: false
 *
 * Các tab chính: bundles, shop, night_market, profile, settings.
 * Các tab phụ (href: null, không hiện trên tab bar):
 * accessories, agent, combat, combat_session, crosshair, equip,
 * gallery, history, contracts, leaderboard, item_upgrades, friends, about.
 *
 * Bao gồm:
 * - AppWarmup: Khởi tạo dữ liệu nền (assets, v.v.).
 * - MediaPopup: Popup media toàn cục.
 *
 * @returns {JSX.Element} Authenticated tab layout.
 */
function Layout() {
  const { t } = useTranslation();
  const reduceMotionEnabled = useReducedMotion();
  const primaryTabScreenOptions = reduceMotionEnabled
    ? PRIMARY_TAB_REDUCED_MOTION_OPTIONS
    : PRIMARY_TAB_SCREEN_OPTIONS;

  return (
    <>
      <AppWarmup />
      <Tabs
        initialRouteName="profile"
        backBehavior="history"
        detachInactiveScreens={Platform.OS !== "android"}
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          // Tab chính nhận opaque transform transition từ options riêng;
          // các route không khai báo animation vẫn dùng mặc định tức thời.
          headerShown: false,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: COLORS.BACKGROUND },
        }}
      >
        {/* ── Tab chính ── */}
        <Tabs.Screen
          name="bundles"
          options={{ ...primaryTabScreenOptions, title: t("bundles") }}
        />
        <Tabs.Screen
          name="shop"
          options={{ ...primaryTabScreenOptions, title: t("shop") }}
        />
        <Tabs.Screen
          name="night_market"
          options={{ ...primaryTabScreenOptions, title: t("nightmarket") }}
        />
        <Tabs.Screen
          name="profile"
          options={{ ...primaryTabScreenOptions, title: t("profile") }}
        />
        <Tabs.Screen
          name="settings"
          options={{ ...primaryTabScreenOptions, title: t("settings") }}
        />

        {/* ── Tab phụ (href: null → ẩn khỏi tab bar) ── */}
        <Tabs.Screen
          name="accessories"
          options={{
            href: null,
            headerShown: true,
            title: t("accessories"),
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="agent"
          options={{
            href: null,
            headerShown: true,
            title: t("agent") || "Agent",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="combat"
          options={{
            href: null,
            headerShown: false,
            title: t("combat") || "Combat",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="combat_session"
          options={{
            href: null,
            headerShown: false,
            title: t("combat_session_page.title") || "Session",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="crosshair"
          options={{
            href: null,
            headerShown: true,
            title: t("crosshair") || "Crosshair",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="equip"
          options={{
            href: null,
            headerShown: true,
            title: t("equip"),
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="gallery"
          options={{
            href: null,
            headerShown: false,
            title: t("gallery"),
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            href: null,
            headerShown: false,
            title: t("history") || "History",
          }}
        />
        <Tabs.Screen
          name="contracts"
          options={{
            href: null,
            headerShown: true,
            title: t("contracts_page.title") || "Contracts",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            href: null,
            headerShown: true,
            title: t("leaderboard_page.title") || "Leaderboard",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="item_upgrades"
          options={{
            href: null,
            headerShown: true,
            title: t("item_upgrades_page.title") || "Upgrades",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            href: null,
            headerShown: true,
            title: t("friends_page.title") || "Friends",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            href: null,
            headerShown: true,
            title: t("about_page.title") || "About",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
      </Tabs>
      <MediaPopup />
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  secondaryHeader: {
    backgroundColor: COLORS.BACKGROUND,
  },
  tabBarWrap: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabBarWrapWeb: {
    pointerEvents: "none", // Web: không chặn click bên dưới
  },
  tabBarFrame: {
    borderRadius: 28,
    backgroundColor: COLORS.PURE_BLACK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...SHADOWS.md,
  },
  tabBarFrameLight: {
    backgroundColor: COLORS.PURE_WHITE,
    borderColor: COLORS.BORDER_STRONG,
    ...SHADOWS.xs,
  },
  tabBarClip: {
    flex: 1,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  expandedTabContent: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  collapsedTabContent: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarWeb: {
    pointerEvents: "auto",
  },
  collapsedTabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_WHITE,
  },
  collapsedTabButtonLight: {
    backgroundColor: COLORS.PURE_BLACK,
  },
  collapsedTabButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 1,
  },
  tabButtonPressed: {
    opacity: 0.98,
  },
  tabIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabIconWrapPressed: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  tabIconWrapPressedLight: {
    backgroundColor: "rgba(17,24,28,0.08)",
  },
  tabIndicator: {
    position: "absolute",
    top: 12,
    left: 18, // = paddingHorizontal, căn lề với content box
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PURE_WHITE,
  },
  tabIndicatorLight: {
    backgroundColor: COLORS.PURE_BLACK,
  },
});

export default Layout;
