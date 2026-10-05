import { useMemo } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "~/hooks/useAppTranslation";
import { Platform, StyleSheet, View } from "react-native";
import AppWarmup from "~/components/AppWarmup";
import MediaPopup, { useMediaPopupStore } from "~/components/popups/MediaPopup";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import PrimaryTabScene from "~/components/ui/PrimaryTabScene";
import SecondaryTabScene from "~/components/ui/SecondaryTabScene";
import { COLORS } from "~/constants/DesignSystem";
import { MOTION_TIMING } from "~/constants/Motion";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import { isPrimaryRoute, type PrimaryRouteName } from "~/features/navigation/navigation-model";
import { renderLiquidNavigationShell } from "~/features/navigation/LiquidNavigationShell";
import { createPrimaryTabScreenOptions, getPrimaryTabNavigatorPolicy, PRIMARY_TAB_REDUCED_MOTION_OPTIONS } from "~/utils/primary-tab-motion";

export { FloatingTabBar } from "~/features/navigation/FloatingTabBar";

function Layout() {
  const { t } = useTranslation();
  const reduceMotionEnabled = useMotionPreference();
  const mediaPopupOpen = useMediaPopupStore((state) => state.entries.length > 0);
  const { width: viewportWidth } = useAppWindowDimensions();
  const navigatorPolicy = getPrimaryTabNavigatorPolicy(Platform.OS);
  const primaryTabScreenOptions = useMemo(
    () =>
      reduceMotionEnabled
        ? PRIMARY_TAB_REDUCED_MOTION_OPTIONS
        : createPrimaryTabScreenOptions(viewportWidth),
    [reduceMotionEnabled, viewportWidth],
  );

  return (
    <>
      <View
        accessibilityElementsHidden={mediaPopupOpen}
        importantForAccessibility={
          mediaPopupOpen ? "no-hide-descendants" : "auto"
        }
        pointerEvents={mediaPopupOpen ? "none" : "auto"}
        testID="authenticated-navigation-content"
        style={styles.authenticatedContent}
      >
        <AppWarmup />
        <Tabs
        initialRouteName="profile"
        backBehavior="history"
        detachInactiveScreens={navigatorPolicy.detachInactiveScreens}
        layout={renderLiquidNavigationShell}
        screenLayout={({ children, route }) => isPrimaryRoute(route.name)
          ? <PrimaryTabScene routeName={route.name as PrimaryRouteName}>{children}</PrimaryTabScene>
          : <SecondaryTabScene>{children}</SecondaryTabScene>}
        screenOptions={{
          // The custom retained host owns primary crossfade and secondary entrance.
          animation: reduceMotionEnabled ? "none" : "fade",
          transitionSpec: {
            animation: "timing",
            config: { duration: MOTION_TIMING.fast.duration, easing: MOTION_TIMING.fast.easing },
          },
          headerShown: false,
          tabBarShowLabel: false,
          freezeOnBlur: navigatorPolicy.secondaryFreezeOnBlur,
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
      </View>
      <MediaPopup />
    </>
  );
}

const styles = StyleSheet.create({
  authenticatedContent: { flex: 1 },
  secondaryHeader: { backgroundColor: COLORS.BACKGROUND },
});

export default Layout;
