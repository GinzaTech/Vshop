import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  normalizeAccountId,
  type AccountSessionSource,
  type SavedAccount,
  upsertSavedAccount,
} from "~/utils/saved-accounts";
import { secureAppStorage } from "~/utils/storage";

interface AccountState {
  accounts: SavedAccount[];
  activeAccountId: string | null;
  hydrated: boolean;
  saveAccount: (user: AccountSessionSource, makeActive?: boolean) => void;
  activateAccount: (accountId: string) => void;
  removeAccount: (accountId: string) => void;
  clearAccounts: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,
      hydrated: false,
      saveAccount: (user, makeActive = false) =>
        set((state) => {
          const accounts = upsertSavedAccount(state.accounts, user, {
            now: Date.now(),
            touch: makeActive,
          });
          const activeAccountId =
            makeActive || !state.activeAccountId
              ? user.id
              : state.activeAccountId;

          if (
            accounts === state.accounts &&
            activeAccountId === state.activeAccountId
          ) {
            return state;
          }

          return { accounts, activeAccountId };
        }),
      activateAccount: (accountId) =>
        set((state) => {
          const normalizedId = normalizeAccountId(accountId);
          const account = state.accounts.find(
            (entry) => normalizeAccountId(entry.id) === normalizedId
          );
          if (!account) return state;

          const now = Date.now();
          return {
            activeAccountId: account.id,
            accounts: state.accounts
              .map((entry) =>
                normalizeAccountId(entry.id) === normalizedId
                  ? { ...entry, lastUsedAt: now }
                  : entry
              )
              .sort((left, right) => right.lastUsedAt - left.lastUsedAt),
          };
        }),
      removeAccount: (accountId) =>
        set((state) => {
          const normalizedId = normalizeAccountId(accountId);
          if (
            state.activeAccountId &&
            normalizeAccountId(state.activeAccountId) === normalizedId
          ) {
            return state;
          }

          return {
            accounts: state.accounts.filter(
              (account) => normalizeAccountId(account.id) !== normalizedId
            ),
          };
        }),
      clearAccounts: () => set({ accounts: [], activeAccountId: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "saved-riot-accounts",
      version: 1,
      storage: createJSONStorage(() => secureAppStorage),
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
