import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "~/utils/storage";

interface WishlistState {
  notificationEnabled: boolean;
  setNotificationEnabled: (value: boolean) => void;
  skinIds: string[];
  toggleSkin: (uuid: string) => void;
}

// @ts-ignore
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      notificationEnabled: false,
      setNotificationEnabled: (value) => {
        set({ notificationEnabled: value });
      },
      skinIds: [],
      toggleSkin: (uuid: string) =>
        set({
          skinIds: get().skinIds.includes(uuid)
            ? get().skinIds.filter((el) => el !== uuid)
            : [...get().skinIds, uuid],
        }),
    }),
    {
      name: "wishlist",
      storage: createJSONStorage(() => appStorage),
    }
  )
);
