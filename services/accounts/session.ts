import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAccountStore } from "~/hooks/useAccountStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  hasReusableAccessToken,
  isReauthenticationRequiredError,
  ReauthenticationRequiredError,
  renewAuthenticatedSession,
} from "~/utils/auth-session";
import { disconnectChatService } from "~/utils/chat-service";
import { clearProfileWarmupCache } from "~/utils/profile-cache";
import {
  captureRiotAuthCookies,
  clearAllCookies,
  restoreRiotAuthCookies,
  type RiotAuthCookie,
} from "~/utils/cookies";
import { syncAllData } from "~/utils/data-sync";
import {
  getAccountSessionKey,
  hasUnexpiredAuthCookies,
  normalizeAccountId,
} from "~/utils/saved-accounts";
import { isRiotAuthenticationError } from "~/utils/session-events";
import { defaultUser } from "~/utils/valorant-api";
import {
  getSessionGeneration,
  invalidateSessionOperations,
  isInteractiveAuthentication,
  runSessionOperation,
  SessionChangedError,
  setInteractiveAuthentication,
} from "~/utils/session-operations";

export type SwitchAccountResult =
  | { kind: "switched" }
  | { kind: "reauth-required" }
  | { kind: "missing" }
  | { kind: "busy" }
  | { kind: "failed" };

let switchInProgress = false;

export const isAccountSwitchInProgress = () => switchInProgress;
export const isSessionRecoveryPaused = () =>
  switchInProgress || isInteractiveAuthentication();

const renewalRequests = new Map<string, Promise<typeof defaultUser>>();

// Android can lose session cookies after process death or a cancelled login.
// A remaining Cloudflare cookie must not replace the saved Riot session.
const captureSessionCookies = async () => {
  const cookies = await captureRiotAuthCookies("network");
  return hasUnexpiredAuthCookies(cookies) ? cookies : [];
};

/** Drain native auth work before mounting a WebView or replacing its cookies. */
export async function prepareInteractiveAuthentication(clearCookies = false) {
  setInteractiveAuthentication(true);
  await runSessionOperation(async () => {
    if (!clearCookies) return;
    const user = useUserStore.getState().user;
    const cookies = await captureSessionCookies();
    if (user.id && cookies.length) {
      useAccountStore.getState().saveAccount(user, false, cookies);
    }
    disconnectChatService();
    await clearAllCookies(true);
  });
}

export const finishInteractiveAuthentication = () =>
  setInteractiveAuthentication(false);

export async function signOutRiotAccount() {
  setInteractiveAuthentication(true);
  disconnectChatService();
  // Invalidate in-flight results before awaiting any native storage operation.
  useUserStore.getState().resetUser();
  useAccountStore.getState().clearAccounts();
  // FIX (L12): dọn warm cache in-memory theo session — dữ liệu account cũ
  // không còn chiếm slot và không thể bị nhầm sang session kế tiếp.
  clearProfileWarmupCache();
  try {
    await runSessionOperation(async () => {
      await clearAllCookies(true);
      await AsyncStorage.removeItem("region");
    });
  } finally {
    finishInteractiveAuthentication();
  }
}

const findSavedAccount = (accountId: string) => {
  const normalizedId = normalizeAccountId(accountId);
  return useAccountStore
    .getState()
    .accounts.find(
      (entry) => normalizeAccountId(entry.id) === normalizedId
    );
};

const replaceCookieJar = async (cookies?: readonly RiotAuthCookie[]) => {
  if (!cookies?.length) {
    await clearAllCookies(true);
    return false;
  }
  return restoreRiotAuthCookies(cookies);
};

/** Khôi phục cookie của tài khoản đang active, chủ yếu khi hủy add/switch. */
export const restoreCurrentAccountAuthCookies = async () => {
  invalidateSessionOperations();
  return runSessionOperation(async () => {
    const currentUser = useUserStore.getState().user;
    const account = findSavedAccount(currentUser.id);
    return replaceCookieJar(account?.authCookies);
  });
};

/**
 * Làm mới đúng tài khoản đang active. Cookie snapshot được khôi phục trước khi
 * gọi Riot và subject của token mới tiếp tục được kiểm tra trong auth-session.
 */
export function renewSavedAccountSession(
  seedUser: typeof defaultUser
): Promise<typeof defaultUser> {
  const generation = getSessionGeneration();
  const key = `${generation}|${getAccountSessionKey(seedUser)}|${seedUser.accessToken}`;
  const pending = renewalRequests.get(key);
  if (pending) return pending;

  const request = runSessionOperation(async () => {
    const assertCurrent = () => {
      const current = useUserStore.getState().user;
      if (
        isSessionRecoveryPaused() || generation !== getSessionGeneration() ||
        !seedUser.id || getAccountSessionKey(current) !== getAccountSessionKey(seedUser)
      ) throw new SessionChangedError();
      return current;
    };
    const current = assertCurrent();
    // Another completed renewal already replaced this caller's old token.
    if (current.accessToken !== seedUser.accessToken && hasReusableAccessToken(current.accessToken)) {
      return current;
    }
    const account = findSavedAccount(current.id);
    if (account?.authCookies?.length) {
      if (!hasUnexpiredAuthCookies(account.authCookies)) {
        throw new ReauthenticationRequiredError("Saved Riot cookies have expired");
      }
      const restored = await restoreRiotAuthCookies(account.authCookies);
      assertCurrent();
      if (!restored) {
        // A native module/Keystore failure does not prove Riot logged us out.
        throw new Error("Saved Riot cookies could not be restored");
      }
    }
    const renewed = await renewAuthenticatedSession(current).catch(async (error: unknown) => {
      assertCurrent();
      // Keep rotated cookies even if a later entitlement request fails.
      const cookies = await captureSessionCookies();
      const latest = assertCurrent();
      if (cookies.length && !isReauthenticationRequiredError(error)) {
        useAccountStore.getState().saveAccount(latest, false, cookies);
      }
      throw error;
    });
    assertCurrent();
    const cookies = await captureSessionCookies();
    const latest = assertCurrent();
    const nextUser = {
      ...latest,
      accessToken: renewed.accessToken,
      idToken: renewed.idToken,
      entitlementsToken: renewed.entitlementsToken,
      region: renewed.region,
    };
    useUserStore.getState().setUser(nextUser);
    useAccountStore.getState().saveAccount(
      nextUser, false, cookies.length ? cookies : account?.authCookies
    );
    return nextUser;
  });
  renewalRequests.set(key, request);
  void request.finally(() => {
    if (renewalRequests.get(key) === request) renewalRequests.delete(key);
  }).catch(() => undefined);
  return request;
}

export async function switchSavedAccount(
  accountId: string
): Promise<SwitchAccountResult> {
  if (isSessionRecoveryPaused()) return { kind: "busy" };
  switchInProgress = true;
  invalidateSessionOperations();
  try {
    return await runSessionOperation(() => switchSavedAccountInternal(accountId));
  } finally {
    switchInProgress = false;
  }
}

async function switchSavedAccountInternal(
  accountId: string
): Promise<SwitchAccountResult> {
  const generation = getSessionGeneration();
  const assertCurrent = () => {
    if (generation !== getSessionGeneration()) throw new SessionChangedError();
  };
  const accountStore = useAccountStore.getState();
  const account = findSavedAccount(accountId);

  if (!account) return { kind: "missing" };

  const normalizedId = normalizeAccountId(account.id);
  const userStore = useUserStore.getState();
  const previousUser = userStore.user;
  if (normalizeAccountId(previousUser.id) === normalizedId) {
    return { kind: "switched" };
  }

  const previousActiveAccountId = accountStore.activeAccountId;
  const previousSavedAccount = findSavedAccount(previousUser.id);
  let previousCookieSnapshot: RiotAuthCookie[] = [];
  let targetActivated = false;
  let succeeded = false;
  let targetUser = {
    ...defaultUser,
    id: account.id,
    name: account.name,
    TagLine: account.tagLine,
    region: account.region,
    accessToken: account.accessToken,
    idToken: account.idToken,
    entitlementsToken: account.entitlementsToken,
  };
  const renewTargetSession = async () => {
    try {
      targetUser = await renewAuthenticatedSession(targetUser);
      assertCurrent();
      const cookies = await captureSessionCookies();
      assertCurrent();
      useAccountStore.getState().saveAccount(targetUser, false,
        cookies.length ? cookies : account.authCookies);
    } catch (error) {
      assertCurrent();
      if (!isReauthenticationRequiredError(error)) {
        const cookies = await captureSessionCookies();
        assertCurrent();
        if (cookies.length) useAccountStore.getState().saveAccount(targetUser, false, cookies);
      }
      throw error;
    }
  };

  try {
    disconnectChatService();

    previousCookieSnapshot = await captureSessionCookies();
    assertCurrent();
    if (previousCookieSnapshot.length && previousUser.id) {
      useAccountStore
        .getState()
        .saveAccount(previousUser, false, previousCookieSnapshot);
    }

    const targetCookies = account.authCookies ?? [];
    if (!hasReusableAccessToken(targetUser.accessToken) && targetCookies.length &&
        !hasUnexpiredAuthCookies(targetCookies)) {
      return { kind: "reauth-required" };
    }
    if (targetCookies.length) {
      const restored = await restoreRiotAuthCookies(targetCookies);
      if (!restored && !hasReusableAccessToken(targetUser.accessToken)) {
        return { kind: "failed" };
      }
    } else {
      await clearAllCookies(true);
    }
    assertCurrent();

    if (!hasReusableAccessToken(targetUser.accessToken)) {
      if (!targetCookies.length) {
        return { kind: "reauth-required" };
      }

      try {
        await renewTargetSession();
      } catch (error) {
        if (
          isReauthenticationRequiredError(error)
        ) {
          await clearAllCookies(true);
          return { kind: "reauth-required" };
        }
        throw error;
      }
    }
    assertCurrent();

    useAccountStore.getState().activateAccount(account.id);
    userStore.activateUser(targetUser);
    targetActivated = true;
    await AsyncStorage.setItem("region", account.region);

    // Không rời More cho đến khi toàn bộ dữ liệu lõi của account mới sẵn sàng.
    try {
      await syncAllData(targetUser, account.region);
    } catch (error) {
      assertCurrent();
      if (!isRiotAuthenticationError(error)) throw error;
      if (!targetCookies.length) throw new ReauthenticationRequiredError();
      // A JWT can be revoked before its expiry. Renew once and retry the read sync.
      await renewTargetSession();
      assertCurrent();
      userStore.setUser(targetUser);
      await syncAllData(targetUser, targetUser.region);
    }
    assertCurrent();

    const syncedUser = useUserStore.getState().user;
    if (
      getAccountSessionKey(syncedUser) !== getAccountSessionKey(targetUser)
    ) {
      throw new Error("Selected account changed before synchronization completed");
    }

    const refreshedCookies = await captureSessionCookies();
    assertCurrent();
    useAccountStore.getState().saveAccount(
      syncedUser,
      true,
      refreshedCookies.length ? refreshedCookies : targetCookies
    );
    succeeded = true;
    return { kind: "switched" };
  } catch (error) {
    if (targetActivated && generation === getSessionGeneration()) {
      const accountIdToRestore = previousActiveAccountId || previousUser.id;
      if (accountIdToRestore) {
        useAccountStore.getState().activateAccount(accountIdToRestore);
      }
      useUserStore.getState().activateUser(previousUser);
      await AsyncStorage.setItem("region", previousUser.region);
    }

    if (__DEV__) {
      console.warn("[account-session] account switch failed", error);
    }
    return { kind: isReauthenticationRequiredError(error) ? "reauth-required" : "failed" };
  } finally {
    if (!succeeded && generation === getSessionGeneration()) {
      await replaceCookieJar(previousCookieSnapshot.length
        ? previousCookieSnapshot
        : previousSavedAccount?.authCookies);
    }
  }
}
