import * as Application from "expo-application";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { captureMatchCache } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { createMobileAccountVaultEnvelope } from "./snapshot-data";
import type { MobileAccountVaultEnvelope } from "./types";

export { createMobileAccountVaultEnvelope } from "./snapshot-data";

export function captureMobileAccountVaultEnvelope(): MobileAccountVaultEnvelope {
  const accountState = useAccountStore.getState();
  const userState = useUserStore.getState();
  if (!accountState.hydrated || !userState.hydrated ||
      !accountState.activeAccountId || accountState.accounts.length === 0) {
    throw new Error("MOBILE_SNAPSHOT_REJECTED");
  }
  const matchCache = captureMatchCache() as unknown as Readonly<Record<string, unknown>>;
  const profileCaches = useProfileCacheStore.getState().cacheByAuth;
  const wishlist = useWishlistStore.getState();
  const screenshotModeEnabled = useFeatureStore.getState().screenshotModeEnabled;
  const versionCode = Number.parseInt(Application.nativeBuildVersion ?? "", 10);

  return createMobileAccountVaultEnvelope({
    accounts: accountState.accounts,
    activeAccountId: accountState.activeAccountId,
    activeUser: userState.user,
    matchCache,
    profileCaches,
    wishlist: wishlist as unknown as Readonly<Record<string, unknown>>,
    screenshotModeEnabled,
    source: {
      packageName: "com.android.vshop",
      appVersion: Application.nativeApplicationVersion || "unknown",
      versionCode: Number.isInteger(versionCode) && versionCode > 0 ? versionCode : 1,
    },
    capturedAt: Date.now(),
  });
}
