import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  normalizeAccountId,
  type AccountSessionSource,
  type SavedAccount,
  upsertSavedAccount,
} from "~/utils/saved-accounts";
import { secureAppStorage } from "~/utils/storage";
import type { RiotAuthCookie } from "~/utils/cookies";

/**
 * Store quản lý danh sách tài khoản Riot đã lưu (persist xuống
 * secureAppStorage — chứa token + cookie snapshot nên phải bảo mật).
 * Store chỉ giữ state; logic chuẩn hóa/merge nằm ở utils/saved-accounts.
 */
interface AccountState {
  /** Danh sách tài khoản đã lưu, sắp xếp theo lastUsedAt giảm dần. */
  accounts: SavedAccount[];
  /** ID tài khoản đang active (null nếu chưa có tài khoản nào). */
  activeAccountId: string | null;
  /** Đã rehydrate từ secure storage xong chưa (chặn render sớm). */
  hydrated: boolean;
  /**
   * Thêm/cập nhật một tài khoản (upsert qua upsertSavedAccount).
   * @param user - Phiên nguồn (token, id, region, name...) cần lưu.
   * @param makeActive - true để đồng thời đặt làm tài khoản active + touch lastUsedAt.
   * @param authCookies - Snapshot cookie Riot để renew phiên sau này (tùy chọn).
   */
  saveAccount: (
    user: AccountSessionSource,
    makeActive?: boolean,
    authCookies?: readonly RiotAuthCookie[]
  ) => void;
  /**
   * Đặt tài khoản thành active và đưa nó lên đầu danh sách (lastUsedAt = now).
   * Guard: id không khớp account nào → không đổi state (trả nguyên state).
   * @param accountId - ID tài khoản cần kích hoạt.
   */
  activateAccount: (accountId: string) => void;
  /**
   * Xóa một tài khoản đã lưu. Guard: KHÔNG xóa tài khoản đang active —
   * caller phải switch/scale về tài khoản khác trước khi xóa.
   * @param accountId - ID tài khoản cần xóa.
   */
  removeAccount: (accountId: string) => void;
  /** Xóa toàn bộ tài khoản + activeAccountId (dùng khi sign-out). */
  clearAccounts: () => void;
  /** Đánh dấu đã rehydrate xong (onRehydrateStorage gọi). */
  setHydrated: (hydrated: boolean) => void;
}

// --- Tạo store với persist (key "saved-riot-accounts", version 1) ---
// Persist accounts + activeAccountId; hydrated chỉ là cờ trong bộ nhớ.
// Immer-style: action trả nguyên `state` khi không có thay đổi để tránh
// re-render thừa và không ghi đĩa không cần thiết.
export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,
      hydrated: false,
      saveAccount: (user, makeActive = false, authCookies) =>
        set((state) => {
          const accounts = upsertSavedAccount(state.accounts, user, {
            now: Date.now(),
            touch: makeActive,
            authCookies,
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
