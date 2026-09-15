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
import { captureAccountData, clearAccountData, restoreAccountData } from "./session-cache";
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
import { sanitizeErrorForLog } from "~/utils/log-redaction";

/** Kết quả chuyển tài khoản: switched (OK) / reauth-required (cần đăng nhập lại
 *  thủ công) / missing (không tìm thấy account) / busy (đang có tác vụ khác) /
 *  failed (lỗi không phân loại được). */
export type SwitchAccountResult =
  | { kind: "switched" }
  | { kind: "reauth-required" }
  | { kind: "missing" }
  | { kind: "busy" }
  | { kind: "failed" };

// Cờ module-level: chỉ cho phép MỘT luồng switch chạy trong cùng thời điểm.
let switchInProgress = false;

/** Đang có luồng chuyển tài khoản chạy hay không (UI dùng để khóa nút). */
export const isAccountSwitchInProgress = () => switchInProgress;
/** Phục hồi phiên (renew nền) có bị tạm dừng hay không — đúng khi đang switch
 *  hoặc đang trong luồng đăng nhập tương tác (WebView login/sign-out). */
export const isSessionRecoveryPaused = () =>
  switchInProgress || isInteractiveAuthentication();

// Dedup renew phiên: key = generation|sessionKey|token cũ → promise chung.
// Nhiều request nền cùng thấy token hết hạn chỉ tạo MỘT luồng renew thật.
const renewalRequests = new Map<string, Promise<typeof defaultUser>>();

// Android có thể mất cookie phiên sau khi process chết hoặc login bị hủy;
// cookie Cloudflare còn sót lại KHÔNG được thay thế phiên Riot đã lưu.
const captureSessionCookies = async () => {
  const cookies = await captureRiotAuthCookies("network");
  return hasUnexpiredAuthCookies(cookies) ? cookies : [];
};

/** Chuẩn bị luồng đăng nhập tương tác: khóa recovery nền và (tùy chọn)
 *  dọn cookie trước khi mount WebView. Snapshot cookie phiên hiện tại được
 *  lưu vào account đã lưu trước khi xóa, tránh mất phiên khi hủy login.
 *  @param clearCookies - true để chụp + lưu cookie cũ rồi clear toàn bộ. */
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

/** Kết thúc luồng đăng nhập tương tác — mở khóa recovery nền trở lại. */
export const finishInteractiveAuthentication = () =>
  setInteractiveAuthentication(false);

/** Đăng xuất tài khoản Riot hiện tại: reset user store, xóa toàn bộ account
 *  đã lưu, dọn warm cache theo session, xóa cookie + region đã lưu.
 *  Chạy trong runSessionOperation để không đụng độ tác vụ mạng khác. */
export async function signOutRiotAccount() {
  setInteractiveAuthentication(true);
  disconnectChatService();
  // Invalidate in-flight results before awaiting any native storage operation.
  useUserStore.getState().resetUser();
  useAccountStore.getState().clearAccounts();
  const cacheCleanup = clearAccountData();
  try {
    await Promise.all([cacheCleanup, runSessionOperation(async () => {
      await Promise.all([clearAllCookies(true), AsyncStorage.removeItem("region")]);
    })]);
  } finally {
    finishInteractiveAuthentication();
  }
}

/** Tìm account đã lưu theo id (chuẩn hóa id trước khi so sánh). */
const findSavedAccount = (accountId: string) => {
  const normalizedId = normalizeAccountId(accountId);
  return useAccountStore
    .getState()
    .accounts.find(
      (entry) => normalizeAccountId(entry.id) === normalizedId
    );
};

/** Thay toàn bộ cookie jar native: xóa sạch nếu rỗng, ngược lại restore
 *  snapshot cookie Riot. @returns true nếu restore thành công. */
const replaceCookieJar = async (cookies?: readonly RiotAuthCookie[]) => {
  if (!cookies?.length) {
    await clearAllCookies(true);
    return false;
  }
  return restoreRiotAuthCookies(cookies);
};

/**
 * Khôi phục cookie của tài khoản ĐANG active vào cookie jar native — dùng chủ
 * yếu khi người dùng hủy add/switch account để trạng thái native khớp store.
 * @returns true nếu có cookie được restore; false nếu clear jar.
 */
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
 * Có dedup: nhiều caller cùng seedUser/token cũ chia sẻ MỘT promise renew.
 * assertCurrent được gọi quanh từng await — session đổi chủ giữa chừng sẽ
 * ném SessionChangedError thay vì ghi token của tài khoản khác lên phiên mới.
 * @param seedUser - User (token cũ) cần làm mới.
 * @returns User mới đã thay access/id/entitlements token + region.
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

/** Chuyển sang tài khoản đã lưu: restore cookie đích → renew phiên nếu token
 *  chết → sync toàn bộ dữ liệu lõi → chỉ hoàn tất khi mọi bước OK; lỗi bất kỳ
 *  sẽ rollback store + cookie về tài khoản cũ. Trả { kind } (xem type trên). */
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

/** Nội bộ của switchSavedAccount (đã nằm trong runSessionOperation):
 *  các bước chuẩn bị → restore/refresh cookie → activate → sync → commit.
 *  Mọi bước bất đồng bộ đều chèn assertCurrent để hủy an toàn khi phiên đổi. */
async function switchSavedAccountInternal(
  accountId: string
): Promise<SwitchAccountResult> {
  let generation = getSessionGeneration();
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
  let previousData: ReturnType<typeof captureAccountData> | undefined;
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

    previousData = captureAccountData();
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
      invalidateSessionOperations();
      generation = getSessionGeneration();
      const accountIdToRestore = previousActiveAccountId || previousUser.id;
      if (accountIdToRestore) {
        useAccountStore.getState().activateAccount(accountIdToRestore);
      }
      useUserStore.getState().activateUser(previousUser);
      if (previousData) {
        try { await restoreAccountData(previousData); }
        catch (cleanupError) {
          // Memory rollback already ran. Optional startup-marker I/O must not
          // skip restoring the region/cookie jar or change the result contract.
          if (__DEV__) console.warn("[account-session] rollback metadata cleanup failed", sanitizeErrorForLog(cleanupError));
        }
      }
      assertCurrent();
      await AsyncStorage.setItem("region", previousUser.region);
    }

    if (__DEV__) {
      console.warn("[account-session] account switch failed", sanitizeErrorForLog(error));
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
