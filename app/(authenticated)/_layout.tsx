import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import AppWarmup from "~/components/AppWarmup";
import MediaPopup from "~/components/popups/MediaPopup";
import { COLORS, GLOBAL_STYLES } from "~/constants/DesignSystem";
import { useUserStore } from "~/hooks/useUserStore";

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

const PRIMARY_ROUTE_ORDER = [
  "bundles",
  "shop",
  "profile",
  "night_market",
  "settings",
] as const;

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const hasNightMarketItems = useUserStore(
    ({ user }) => user.shops.nightMarket.length > 0
  );
  const [collapsed, setCollapsed] = useState(false);
  const collapseProgress = useRef(new Animated.Value(1)).current;
  const moreLongPressHandledRef = useRef(false);
  const activeRoute = state.routes[state.index];

  useEffect(() => {
    Animated.timing(collapseProgress, {
      toValue: collapsed ? 0 : 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [collapseProgress, collapsed]);

  if (!(activeRoute?.name in PRIMARY_ROUTES)) {
    return null;
  }

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

  return (
    <View
      style={[
        styles.tabBarWrap,
        Platform.OS === "web" && styles.tabBarWrapWeb,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {collapsed ? (
        <Animated.View
          style={[
            styles.collapsedTabBar,
            styles.collapsedTabBarDocked,
            Platform.OS === "web" && styles.tabBarWeb,
            {
              opacity: collapseProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  scale: collapseProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.82],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand navigation"
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
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.tabBar,
            !hasNightMarketItems && styles.tabBarWithoutMarket,
            Platform.OS === "web" && styles.tabBarWeb,
            {
              opacity: collapseProgress,
              transform: [
                {
                  scale: collapseProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {visibleRoutes.map((route: any) => {
            const routeIndex = state.routes.findIndex(
              (item: any) => item.key === route.key
            );
            const focused = state.index === routeIndex;
            const { icon, label } = PRIMARY_ROUTES[route.name];
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
                    navigation.navigate(route.name);
                  }
                }}
                style={({ pressed }) => [
                  styles.tabButton,
                  pressed && styles.tabButtonPressed,
                ]}
              >
                {({ pressed }) => (
                  <>
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
                    <Text
                      style={[
                        styles.tabLabel,
                        focused && styles.tabLabelActive,
                        pressed && !focused && styles.tabLabelPressed,
                      ]}
                    >
                      {label}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

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
        <Tabs.Screen
          name="bundles"
          options={{
            title: t("bundles"),
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: t("shop"),
          }}
        />
        <Tabs.Screen
          name="night_market"
          options={{
            title: t("nightmarket"),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("profile"),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t("settings"),
          }}
        />
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
            headerShown: true,
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
            headerShown: true,
            title: t("history") || "History",
            headerStyle: styles.secondaryHeader,
            headerTintColor: COLORS.TEXT_PRIMARY,
            headerShadowVisible: false,
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

const styles = StyleSheet.create({
  secondaryHeader: {
    backgroundColor: COLORS.BACKGROUND,
  },
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  tabBarWrapWeb: {
    pointerEvents: "none",
  } as any,
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "88%",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 32,
    backgroundColor: COLORS.PURE_BLACK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    ...GLOBAL_STYLES.shadow,
  },
  tabBarWithoutMarket: {
    width: "78%",
  },
  tabBarWeb: {
    pointerEvents: "auto",
  } as any,
  collapsedTabBar: {
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
    borderRadius: 999,
    backgroundColor: COLORS.PURE_BLACK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...GLOBAL_STYLES.shadow,
  },
  collapsedTabBarDocked: {
    alignSelf: "flex-end",
    marginRight: 22,
  },
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
    gap: 6,
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
    backgroundColor: COLORS.PURE_WHITE,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.64)",
  },
  tabLabelPressed: {
    color: "rgba(255,255,255,0.92)",
  },
  tabLabelActive: {
    color: COLORS.PURE_WHITE,
  },
});

export default Layout;
