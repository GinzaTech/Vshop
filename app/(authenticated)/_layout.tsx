import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import MediaPopup from "~/components/popups/MediaPopup";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";

const PRIMARY_ROUTES: Record<
  string,
  { icon: ComponentProps<typeof Icon>["name"]; label: string }
> = {
  bundles: { icon: "package-variant-closed", label: "Bundles" },
  shop: { icon: "shopping-outline", label: "Store" },
  night_market: { icon: "weather-night", label: "Market" },
  profile: { icon: "account-circle-outline", label: "Profile" },
  settings: { icon: "dots-grid", label: "More" },
};

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];

  if (!(activeRoute?.name in PRIMARY_ROUTES)) {
    return null;
  }

  const visibleRoutes = state.routes.filter(
    (route: any) => route.name in PRIMARY_ROUTES
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarWrap,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.tabBar}>
        {visibleRoutes.map((route: any) => {
          const routeIndex = state.routes.findIndex(
            (item: any) => item.key === route.key
          );
          const focused = state.index === routeIndex;
          const { icon, label } = PRIMARY_ROUTES[route.name];
          const options = descriptors[route.key]?.options ?? {};

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tabButton}
            >
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Icon
                  name={icon}
                  size={22}
                  color={focused ? COLORS.PURE_BLACK : COLORS.PURE_WHITE}
                />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Layout() {
  const { t } = useTranslation();

  return (
    <>
      <Tabs
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
            headerShown: true,
            title: t("combat") || "Combat",
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
            headerShown: true,
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
          name="match_details/[id]"
          options={{
            href: null,
            headerShown: false,
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
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: COLORS.PURE_WHITE,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.64)",
  },
  tabLabelActive: {
    color: COLORS.PURE_WHITE,
  },
});

export default Layout;
