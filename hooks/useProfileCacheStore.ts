import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ProfileWarmCache } from "~/utils/profile-cache";
import { appStorage } from "~/utils/storage";

interface ProfileCacheState {
  cacheByAuth: Record<string, ProfileWarmCache>;
  setProfileCache: (cache: ProfileWarmCache) => void;
  resetProfileCache: () => void;
}

export const useProfileCacheStore = create<ProfileCacheState>()(
  persist(
    (set) => ({
      cacheByAuth: {},
      setProfileCache: (cache) =>
        set((state) => ({
          cacheByAuth: {
            ...state.cacheByAuth,
            [cache.authKey]: cache,
          },
        })),
      resetProfileCache: () => set({ cacheByAuth: {} }),
    }),
    {
      name: "profile-warm-cache",
      storage: createJSONStorage(() => appStorage),
      partialize: (state) => ({ cacheByAuth: state.cacheByAuth }),
    }
  )
);
