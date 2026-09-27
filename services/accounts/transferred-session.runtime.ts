import type { MatchCacheSnapshot } from "~/hooks/useMatchStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { captureMatchCache, restoreMatchCache } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { disconnectChatService } from "~/utils/chat-service";
import { syncAllData } from "~/utils/data-sync";
import { buildAuthenticatedUser } from "~/utils/auth-session";
import {
  getSessionGeneration,
  invalidateSessionOperations,
} from "~/utils/session-operations";
import type { TransferredSessionDependencies } from "./transferred-session";
import type { ProfileWarmCache } from "~/utils/profile-cache";

export function createTransferredSessionDependencies(): TransferredSessionDependencies {
  return {
    invalidateSession: invalidateSessionOperations,
    getGeneration: getSessionGeneration,
    getUser: () => useUserStore.getState().user,
    activateUser: (user) => useUserStore.getState().activateUser(user),
    buildAuthenticatedUser,
    clearSavedAccounts: () => useAccountStore.getState().clearAccounts(),
    captureMatchCache,
    restoreMatchCache: (snapshot) => restoreMatchCache(snapshot as MatchCacheSnapshot),
    getProfileCaches: () => useProfileCacheStore.getState().cacheByAuth,
    setProfileCaches: (cache) => useProfileCacheStore.setState({
      cacheByAuth: cache as Record<string, ProfileWarmCache>,
    }),
    getWishlist: () => {
      const state = useWishlistStore.getState();
      return {
        skinIds: state.skinIds,
        notificationEnabled: state.notificationEnabled,
      };
    },
    setWishlist: (wishlist) => {
      const value = wishlist as { skinIds: string[]; notificationEnabled: boolean };
      useWishlistStore.setState({
        skinIds: [...value.skinIds],
        notificationEnabled: value.notificationEnabled,
      });
    },
    getScreenshotMode: () => useFeatureStore.getState().screenshotModeEnabled,
    setScreenshotMode: (value) => useFeatureStore.setState({ screenshotModeEnabled: value }),
    syncAllData,
    disconnectChat: disconnectChatService,
  };
}
