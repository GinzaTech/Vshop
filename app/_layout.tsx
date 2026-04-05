import "~/utils/polyfills";
import { Stack, useRouter } from "expo-router";
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
import { useEffect, useRef } from "react";
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
  buildAuthenticatedUser,
  canResumeUserSession,
} from "~/utils/auth-session";
import { defaultUser } from "~/utils/valorant-api";

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

SplashScreen.preventAutoHideAsync();

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

function RootLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, hydrated, setUser } = useUserStore();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    // "Sync" background fetch with local state
    const notificationEnabled = useWishlistStore.getState().notificationEnabled;
    if (notificationEnabled) {
      initBackgroundFetch();
    } else {
      stopBackgroundFetch();
    }
  }, []);

  useEffect(() => {
    if (!hydrated || bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    let cancelled = false;

    const bootstrap = async () => {
      const storedRegion = await AsyncStorage.getItem("region");
      const region = storedRegion || user.region || defaultUser.region;

      if (!storedRegion && user.region) {
        await AsyncStorage.setItem("region", user.region);
      }

      if (!region) {
        if (!cancelled) {
          router.replace("/setup");
        }
        await SplashScreen.hideAsync();
        return;
      }

      if (canResumeUserSession(user, region)) {
        if (!cancelled) {
          router.replace("/shop");
        }
        await SplashScreen.hideAsync();

        try {
          const authenticatedUser = await buildAuthenticatedUser(
            user.accessToken,
            region,
            user
          );

          if (!cancelled) {
            setUser(authenticatedUser);
          }
        } catch {
          if (!cancelled) {
            setUser({ ...defaultUser, region });
            router.replace("/reauth");
          }
        }
        return;
      }

      if (!cancelled) {
        setUser({ ...defaultUser, region });
        router.replace("/reauth");
      }
      await SplashScreen.hideAsync();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hydrated, router, setUser, user]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PlausibleProvider>
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
                  gestureEnabled: false,
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
                name="(authenticated)"
                options={{ headerShown: false }}
              />
            </Stack>
            </ThemeProvider>
          </StripeProvider>
        </PaperProvider>
      </PlausibleProvider>
    </GestureHandlerRootView>
  );
}

export default RootLayout;
