import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import type { LoginWebViewProps } from "~/components/LoginWebView.types";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  finishInteractiveAuthentication,
  prepareInteractiveAuthentication,
  restoreCurrentAccountAuthCookies,
} from "~/services/accounts/session";
import {
  createInteractiveAuthAttempt,
  validateInteractiveAuthCallback,
  type InteractiveAuthAttempt,
} from "~/services/accounts/interactive-auth";
import { buildRiotInteractiveAuthUrl } from "~/services/riot/endpoints";
import { buildAuthenticatedUser } from "~/utils/auth-session";
import { disconnectChatService } from "~/utils/chat-service";
import { captureRiotAuthCookies } from "~/utils/cookies";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { fetchProfileWarmCache } from "~/utils/profile-cache";
import { normalizeAccountId } from "~/utils/saved-accounts";
import { getSessionGeneration } from "~/utils/session-operations";
import { defaultUser } from "~/utils/valorant-api";

const PROFILE_PRELOAD_TIMEOUT_MS = 4_500;
const MINIMUM_LOADING_MS = 2_000;
const COMPLETION_ISSUE_KEY = "login_web_view.completion_error";

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export type RiotInteractiveLoginController = Readonly<{
  authReady: boolean;
  loginUrl: string | null;
  loading: string | null;
  completionIssue: string | null;
  completeCallback: (callbackUrl: string) => Promise<void>;
}>;

export function useRiotInteractiveLogin({
  expectedAccountId,
}: Pick<LoginWebViewProps, "expectedAccountId">): RiotInteractiveLoginController {
  const router = useRouter();
  const { t } = useTranslation();
  const activateUser = useUserStore((state) => state.activateUser);
  const [loading, setLoading] = useState<string | null>(null);
  const [completionIssue, setCompletionIssue] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const authInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const attemptRef = useRef<InteractiveAuthAttempt | null>(null);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    void Promise.all([
      prepareInteractiveAuthentication(),
      createInteractiveAuthAttempt(),
    ]).then(([, attempt]) => {
      if (cancelled || !mountedRef.current) return;
      attemptRef.current = attempt;
      setLoginUrl(buildRiotInteractiveAuthUrl(attempt));
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (cancelled || !mountedRef.current) return;
      if (__DEV__) {
        console.warn(
          "[LoginWebView] Authentication preparation failed",
          sanitizeErrorForLog(error),
        );
      }
      setCompletionIssue(COMPLETION_ISSUE_KEY);
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      attemptRef.current = null;
      finishInteractiveAuthentication();
    };
  }, []);

  const completeCallback = async (callbackUrl: string): Promise<void> => {
    if (!authReady || !mountedRef.current || authInFlightRef.current) return;
    authInFlightRef.current = true;
    let generation = getSessionGeneration();
    const attempt = attemptRef.current;
    const isCurrentAttempt = () =>
      mountedRef.current &&
      attemptRef.current === attempt &&
      generation === getSessionGeneration();
    setCompletionIssue(null);
    const loginStart = Date.now();
    try {
      if (!attempt) throw new Error("Authentication attempt is unavailable");
      const { accessToken, idToken } = validateInteractiveAuthCallback(
        callbackUrl,
        attempt,
      );
      const authCookies = await captureRiotAuthCookies("webview");
      if (!isCurrentAttempt()) return;
      const region = (await AsyncStorage.getItem("region")) || defaultUser.region;
      if (!isCurrentAttempt()) return;

      setLoading(t("fetching.storefront"));
      const authenticatedUser = await buildAuthenticatedUser(
        accessToken,
        region,
        undefined,
        idToken,
      );
      if (!isCurrentAttempt()) return;

      if (
        expectedAccountId &&
        normalizeAccountId(authenticatedUser.id) !== normalizeAccountId(expectedAccountId)
      ) {
        const restore = restoreCurrentAccountAuthCookies();
        generation = getSessionGeneration();
        await restore;
        if (!isCurrentAttempt()) return;
        authInFlightRef.current = false;
        setLoading(null);
        Alert.alert(
          t("settings_page.accounts.switch_failed_title"),
          t("settings_page.accounts.switch_failed_description"),
        );
        router.replace("/settings");
        return;
      }

      if (authenticatedUser.region && authenticatedUser.region !== region) {
        await AsyncStorage.setItem("region", authenticatedUser.region);
      }
      if (!isCurrentAttempt()) return;

      disconnectChatService();
      useAccountStore.getState().saveAccount(
        authenticatedUser,
        true,
        authCookies.length ? authCookies : undefined,
      );
      activateUser(authenticatedUser);
      setLoading(t("fetching.progress"));

      void useMatchStore.getState().fetchMatches(authenticatedUser).catch((error) => {
        if (__DEV__) {
          console.log(
            "Match preload failed, falling back",
            sanitizeErrorForLog(error),
          );
        }
      });

      const profileWarmup = fetchProfileWarmCache(authenticatedUser)
        .then((cache) => {
          const currentUser = useUserStore.getState().user;
          if (
            cache &&
            isCurrentAttempt() &&
            currentUser.id === authenticatedUser.id &&
            currentUser.accessToken === authenticatedUser.accessToken &&
            currentUser.idToken === authenticatedUser.idToken &&
            currentUser.entitlementsToken === authenticatedUser.entitlementsToken &&
            currentUser.region === authenticatedUser.region
          ) {
            useProfileCacheStore.getState().setProfileCache(cache);
          }
        })
        .catch((error) => {
          if (__DEV__) {
            console.log(
              "Profile preload failed, falling back",
              sanitizeErrorForLog(error),
            );
          }
        });

      const remainingDelay = Math.max(
        0,
        MINIMUM_LOADING_MS - (Date.now() - loginStart),
      );
      await Promise.allSettled([
        remainingDelay > 0 ? wait(remainingDelay) : Promise.resolve(),
        Promise.race([profileWarmup, wait(PROFILE_PRELOAD_TIMEOUT_MS)]),
      ]);
      if (isCurrentAttempt()) router.replace("/profile");
    } catch {
      if (!isCurrentAttempt()) return;
      authInFlightRef.current = false;
      setLoading(null);
      setCompletionIssue(COMPLETION_ISSUE_KEY);
      Alert.alert(t(COMPLETION_ISSUE_KEY), t("login_web_view.retry_hint"), [
        { text: t("settings_page.accounts.cancel"), style: "cancel" },
        {
          text: t("login_web_view.retry"),
          onPress: () => { void completeCallback(callbackUrl); },
        },
      ]);
    }
  };

  return {
    authReady,
    loginUrl,
    loading,
    completionIssue,
    completeCallback,
  };
}
