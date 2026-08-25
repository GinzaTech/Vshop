import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAccountStore } from "~/hooks/useAccountStore";
import { useUserStore } from "~/hooks/useUserStore";
import { hasReusableAccessToken } from "~/utils/auth-session";
import { disconnectChatService } from "~/utils/chat-service";
import { clearAllCookies } from "~/utils/cookies";
import { syncAllData } from "~/utils/data-sync";
import {
  getAccountSessionKey,
  normalizeAccountId,
} from "~/utils/saved-accounts";
import { defaultUser } from "~/utils/valorant-api";

export type SwitchAccountResult =
  | { kind: "switched" }
  | { kind: "reauth-required" }
  | { kind: "missing" }
  | { kind: "busy" }
  | { kind: "failed" };

let switchInProgress = false;

export const isAccountSwitchInProgress = () => switchInProgress;

export async function switchSavedAccount(
  accountId: string
): Promise<SwitchAccountResult> {
  const normalizedId = normalizeAccountId(accountId);
  const accountStore = useAccountStore.getState();
  const account = accountStore.accounts.find(
    (entry) => normalizeAccountId(entry.id) === normalizedId
  );

  if (!account) return { kind: "missing" };

  const userStore = useUserStore.getState();
  const previousUser = userStore.user;
  if (normalizeAccountId(previousUser.id) === normalizedId) {
    return { kind: "switched" };
  }

  if (switchInProgress) return { kind: "busy" };

  if (!hasReusableAccessToken(account.accessToken)) {
    disconnectChatService();
    await clearAllCookies(true);
    return { kind: "reauth-required" };
  }

  const previousActiveAccountId = accountStore.activeAccountId;
  const targetUser = {
    ...defaultUser,
    id: account.id,
    name: account.name,
    TagLine: account.tagLine,
    region: account.region,
    accessToken: account.accessToken,
    idToken: account.idToken,
    entitlementsToken: account.entitlementsToken,
  };

  switchInProgress = true;
  try {
    disconnectChatService();
    await clearAllCookies(true);

    accountStore.activateAccount(account.id);
    userStore.activateUser(targetUser);
    await AsyncStorage.setItem("region", account.region);

    // Không rời More cho đến khi toàn bộ dữ liệu lõi của account mới sẵn sàng.
    await syncAllData(targetUser, account.region);

    const syncedUser = useUserStore.getState().user;
    if (
      getAccountSessionKey(syncedUser) !== getAccountSessionKey(targetUser)
    ) {
      return { kind: "failed" };
    }

    useAccountStore.getState().saveAccount(syncedUser, true);
    return { kind: "switched" };
  } catch (error) {
    const currentUser = useUserStore.getState().user;
    if (
      getAccountSessionKey(currentUser) === getAccountSessionKey(targetUser)
    ) {
      if (previousActiveAccountId) {
        useAccountStore.getState().activateAccount(previousActiveAccountId);
      }
      useUserStore.getState().activateUser(previousUser);
      await AsyncStorage.setItem("region", previousUser.region);
    }

    if (__DEV__) {
      console.warn("[account-session] account switch failed", error);
    }
    return { kind: "failed" };
  } finally {
    switchInProgress = false;
  }
}
