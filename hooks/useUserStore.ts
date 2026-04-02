import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultUser } from "~/utils/valorant-api";
import { appStorage } from "~/utils/storage";

interface UserState {
  user: typeof defaultUser;
  hydrated: boolean;
  setUser: (user: typeof defaultUser) => void;
  resetUser: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: defaultUser,
      hydrated: false,
      setUser: (user) => set({ user }),
      resetUser: () => set({ user: defaultUser }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "user-session",
      storage: createJSONStorage(() => appStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
