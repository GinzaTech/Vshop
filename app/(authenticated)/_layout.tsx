// 📄 app/(authenticated)/_layout.tsx — Layout cho nhóm màn hình đã xác thực
// Sử dụng Tab Navigator (expo-router Tabs) với FloatingTabBar tùy chỉnh.
// Bao gồm AppWarmup (khởi tạo dữ liệu nền) và MediaPopup (popup media toàn app).

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AppWarmup from "~/components/AppWarmup";
import MediaPopup from "~/components/popups/MediaPopup";
import { COLORS, GLOBAL_STYLES } from "~/constants/DesignSystem";
import { useUserStore } from "~/hooks/useUserStore";
import { flowTracer } from "~/utils/flow-tracer";

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
 * - Sliding indicator theo tab active bằng interpolate + withTiming.
 * - collapseProgress dùng Easing.inOut(cubic), duration 340ms (collapse) / 420ms (expand).
 *
 * Logic:
 * - Tab "night_market" chỉ hiện nếu hasNightMarketItems === true.
 * - Tab "settings" long press ≥ 1s → thu gọn thanh.
 * - Khi thanh thu gọn, nhấn/long press vào nút "More" để mở rộng lại.
 * - Back từ sub-screen → indicator jump thẳng (không slide) nhờ shouldJump.
 *
 * @returns {JSX.Element | null} Thanh tab hoặc null nếu route không phải primary.
 */
function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const hasNightMarketItems = useUserStore(
    ({ user }) => user.shops.nightMarket.length > 0
  );
  const [collapsed, setCollapsed] = useState(false);
  const collapseProgress = useSharedValue(1); // 1 = mở, 0 = thu gọn
  const moreLongPressHandledRef = useRef(false);
  const activeRoute = state.routes[state.index];

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
    collapseProgress.value = withTiming(collapsed ? 0 : 1, {
      duration: collapsed ? 340 : 420,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [collapseProgress, collapsed]);


  // Lọc và sắp xếp các route primary (tính trước để dùng cho sliding indicator)
  const visibleRoutes = state.routes
    .filter(
      (route: any) =>
        route.name in PRIMARY_ROUTES &&
        (route.name !== "night_market" || hasNightMarketItems)
    )
    .sort(
      (left: any, right: any) =>
        PRIMARY_ROUTE_ORDER.indexOf(left.name as (typeof PRIMARY_ROUTE_ORDER)[number]) -
        PRIMARY_ROUTE_ORDER.indexOf(right.name as (typeof PRIMARY_ROUTE_ORDER)[number])
    );

  // ── Sliding tab indicator ──
  // Mỗi tab dùng flex: 1 nên chia đều content width; indicator dịch chuyển theo index.
  const TAB_PADDING_H = 18; // = paddingHorizontal của expandedTabContent
  const INDICATOR_SIZE = 50; // khớp với tabIconWrap (50x50)
  const COLLAPSED_BAR_SIZE = 74;
  const EXPANDED_BAR_HEIGHT = 82;
  const expandedBarWidth = Math.round(
    viewportWidth * (hasNightMarketItems ? 0.88 : 0.78)
  );
  const collapsedTranslateX = Math.max(
    0,
    viewportWidth / 2 - 22 - COLLAPSED_BAR_SIZE / 2
  );
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route: any) => route.key === activeRoute?.key)
  );
  const tabButtonWidth =
    visibleRoutes.length > 0
      ? (expandedBarWidth - TAB_PADDING_H * 2) / visibleRoutes.length
      : INDICATOR_SIZE;
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
      transform: [{ translateX: withTiming(targetX, { duration: 200 }) }],
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
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <Reanimated.View
        style={[
          styles.tabBarFrame,
          Platform.OS === "web" && styles.tabBarWeb,
          tabBarAnimatedStyle,
        ]}
      >
        <View style={styles.tabBarClip}>
          <Reanimated.View
            pointerEvents={collapsed ? "none" : "auto"}
            style={[
              styles.expandedTabContent,
              expandedContentAnimatedStyle,
            ]}
          >
            {/* Sliding indicator phía sau tab đang active */}
            <Reanimated.View
              pointerEvents="none"
              style={[styles.tabIndicator, indicatorAnimatedStyle]}
            />
            {visibleRoutes.map((route: any) => {
              const routeIndex = state.routes.findIndex(
                (item: any) => item.key === route.key
              );
              const focused = state.index === routeIndex;
              const { icon } = PRIMARY_ROUTES[route.name];
              const options = descriptors[route.key]?.options ?? {};
              const isMoreRoute = route.name === "settings";

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityLabel={options.tabBarAccessibilityLabel}
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
                        focused && styles.tabIconWrapActive,
                        pressed && !focused && styles.tabIconWrapPressed,
                      ]}
                    >
                      <Icon
                        name={icon}
                        size={22}
                        color={
                          focused
                            ? COLORS.PURE_BLACK
                            : pressed
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

          <Reanimated.View
            pointerEvents={collapsed ? "auto" : "none"}
            style={[
              styles.collapsedTabContent,
              collapsedContentAnimatedStyle,
            ]}
          >
            <Pressable
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
                pressed && styles.collapsedTabButtonPressed,
              ]}
            >
              <Icon name="dots-grid" size={26} color={COLORS.PURE_BLACK} />
            </Pressable>
          </Reanimated.View>
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

  return (
    <>
      <AppWarmup />
      <Tabs
        initialRouteName="profile"
        backBehavior="history"
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
      >
        {/* ── Tab chính ── */}
        <Tabs.Screen name="bundles" options={{ title: t("bundles") }} />
        <Tabs.Screen name="shop" options={{ title: t("shop") }} />
        <Tabs.Screen name="night_market" options={{ title: t("nightmarket") }} />
        <Tabs.Screen name="profile" options={{ title: t("profile") }} />
        <Tabs.Screen name="settings" options={{ title: t("settings") }} />

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
    position: "absolute", // Nổi phía trên nội dung
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  tabBarWrapWeb: {
    pointerEvents: "none", // Web: không chặn click bên dưới
  } as any,
  tabBarFrame: {
    borderRadius: 32,
    backgroundColor: COLORS.PURE_BLACK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...GLOBAL_STYLES.shadow,
  },
  tabBarClip: {
    flex: 1,
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  expandedTabContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  collapsedTabContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBarWeb: {
    pointerEvents: "auto",
  } as any,
  collapsedTabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_WHITE,
  },
  collapsedTabButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingVertical: 1,
  },
  tabButtonPressed: {
    opacity: 0.98,
  },
  tabIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabIconWrapPressed: {
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.PURE_WHITE, // Nền trắng cho tab đang active
  },
  tabIndicator: {
    position: "absolute",
    top: 15, // căn theo tabIconWrap (paddingVertical 14 + tabButton padding 1)
    left: 18, // = paddingHorizontal, căn lề với content box
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
});

export default Layout;
