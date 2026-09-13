/**
 * saved-accounts.ts — Helper cho tính năng đa tài khoản đã lưu.
 *
 * Toàn bộ hàm thuần (pure function) trên mảng SavedAccount; nơi lưu trữ thật
 * là useAccountStore (Zustand persist). accountKey chuẩn là "region|id" (đã
 * lowercase) do getAccountSessionKey tạo ra — mọi layer đều dùng chung.
 */

import type { RiotAuthCookie } from "./cookies";

// Số tài khoản tối đa được giữ trong danh sách (cũ nhất bị loại khi vượt).
export const MAX_SAVED_ACCOUNTS = 6;

/**
 * hasUnexpiredAuthCookies — Kiểm tra snapshot cookie có còn cookie "ssid"
 * dùng được (session cookie Riot) hay không. Cookie phiên không có expiry
 * được coi là còn hiệu lực; việc xác thực cuối cùng thuộc về native storage.
 * @param {readonly RiotAuthCookie[]} cookies - Danh sách cookie đã lưu
 * @param {number} [now] - Thời điểm đối chiếu (mặc định Date.now())
 * @returns {boolean} true nếu có ít nhất một cookie ssid còn hiệu lực
 */
export const hasUnexpiredAuthCookies = (cookies: readonly RiotAuthCookie[], now = Date.now()) =>
  cookies.some((cookie) => {
      // Anti-bot/tracking cookies can outlive the Riot login session.
      if (cookie.name !== "ssid" || !cookie.value) return false;
    const expiresAt = cookie.expires ? Date.parse(cookie.expires) : NaN;
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });

/**
 * AccountSessionSource - Dữ liệu tối thiểu cần thiết để lưu một tài khoản.
 * @property {string} id - PUUID của người chơi
 * @property {string} name - Tên hiển thị (GameName)
 * @property {string} TagLine - TagLine (VD: #NA1)
 * @property {string} region - Region của tài khoản
 * @property {string} accessToken - Access token xác thực
 * @property {string} idToken - ID token
 * @property {string} entitlementsToken - Entitlements token
 */
export type AccountSessionSource = {
  id: string;
  name: string;
  TagLine: string;
  region: string;
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
};

/** Chỉ cần id + region để tạo accountKey định danh một phiên tài khoản. */
export type AccountIdentitySource = Pick<AccountSessionSource, "id" | "region">;

/**
 * SavedAccount - Một tài khoản đã lưu trong danh sách đa tài khoản.
 * @property {string} authCookies - (tuỳ chọn) Snapshot cookie Riot để silent re-auth
 * @property {number} lastUsedAt - Thời điểm dùng gần nhất (ms), để sắp xếp
 */
export type SavedAccount = {
  id: string;
  name: string;
  tagLine: string;
  region: string;
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  authCookies?: RiotAuthCookie[];
  lastUsedAt: number;
};

/**
 * normalizeAccountId — Chuẩn hóa ID tài khoản: trim + lowercase, để so khớp
 * tài khoản nhất quán giữa các layer (Riot ID có thể khác nhau về hoa/thường).
 * @param {string} accountId - ID tài khoản (PUUID) gốc
 * @returns {string} ID đã chuẩn hóa
 */
export const normalizeAccountId = (accountId: string) =>
  accountId.trim().toLowerCase();

/**
 * getAccountSessionKey — Tạo khóa định danh phiên tài khoản "region|id"
 * (đã lowercase). Đây là quy ước CHUẨN dùng chung toàn app: profile-cache,
 * app-sync, data-sync, startup-cache... đều dùng key này để tách dữ liệu
 * theo tài khoản. Trả về "guest" nếu thiếu id hoặc region.
 * @param {AccountIdentitySource} account - Tài khoản (cần id + region)
 * @returns {string} Khóa phiên, hoặc "guest" nếu không đủ thông tin
 */
export const getAccountSessionKey = (account: AccountIdentitySource) => {
  const accountId = normalizeAccountId(account.id);
  const region = account.region.trim().toLowerCase();
  return accountId && region ? `${region}|${accountId}` : "guest";
};

/**
 * isSameAccountSessionKey — So sánh 2 khóa phiên có cùng tài khoản không.
 * @param {string} currentKey - Khóa phiên hiện tại
 * @param {string} expectedKey - Khóa phiên kỳ vọng
 * @returns {boolean} true nếu 2 khóa giống nhau
 */
export const isSameAccountSessionKey = (
  currentKey: string,
  expectedKey: string
) => currentKey === expectedKey;

/**
 * isSavableAccount — Kiểm tra tài khoản có đủ thông tin để lưu không
 * (cần id, region, accessToken và entitlementsToken).
 * @param {AccountSessionSource} user - Tài khoản cần kiểm tra
 * @returns {boolean} true nếu tài khoản đủ điều kiện lưu
 */
export const isSavableAccount = (
  user: AccountSessionSource
): boolean =>
  Boolean(
    normalizeAccountId(user.id) &&
      user.region &&
      user.accessToken &&
      user.entitlementsToken
  );

/**
 * toSavedAccount — Chuyển dữ liệu phiên đang chạy thành bản ghi SavedAccount
 * để persist. Cookie (nếu có) được sao chép ra mảng mới để tránh tham chiếu
 * chia sẻ với state khác.
 * @param {AccountSessionSource} user - Dữ liệu phiên hiện tại
 * @param {number} lastUsedAt - Thời điểm dùng gần nhất (timestamp ms)
 * @param {readonly RiotAuthCookie[]} [authCookies] - Snapshot cookie (tuỳ chọn)
 * @returns {SavedAccount} Bản ghi tài khoản hoàn chỉnh để lưu
 */
export const toSavedAccount = (
  user: AccountSessionSource,
  lastUsedAt: number,
  authCookies?: readonly RiotAuthCookie[]
): SavedAccount => ({
  id: user.id,
  name: user.name,
  tagLine: user.TagLine,
  region: user.region,
  accessToken: user.accessToken,
  idToken: user.idToken,
  entitlementsToken: user.entitlementsToken,
  ...(authCookies ? { authCookies: [...authCookies] } : {}),
  lastUsedAt,
});

/**
 * authCookiesEqual — So sánh 2 snapshot cookie theo từng trường (name, value,
 * path, domain, version, expires, secure, httpOnly, sameSite).
 * @param {readonly RiotAuthCookie[]} [left] - Snapshot thứ nhất
 * @param {readonly RiotAuthCookie[]} [right] - Snapshot thứ hai
 * @returns {boolean} true nếu 2 snapshot giống hệt nhau
 */
const authCookiesEqual = (
  left?: readonly RiotAuthCookie[],
  right?: readonly RiotAuthCookie[]
) => {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;

  return left.every((cookie, index) => {
    const next = right[index];
    return (
      Boolean(next) &&
      cookie.name === next.name &&
      cookie.value === next.value &&
      cookie.path === next.path &&
      cookie.domain === next.domain &&
      cookie.version === next.version &&
      cookie.expires === next.expires &&
      cookie.secure === next.secure &&
      cookie.httpOnly === next.httpOnly &&
      cookie.sameSite === next.sameSite
    );
  });
};

/**
 * upsertSavedAccount — Chèn mới / cập nhật tài khoản trong danh sách đã lưu
 * (thuần, không đổi mảng gốc). Nếu bản ghi mới trùng bản cũ thì trả về
 * nguyên mảng (tránh re-render thừa trong Zustand). Kết quả luôn sắp xếp
 * theo lastUsedAt giảm dần, cắt còn tối đa maxAccounts (mặc định 6).
 * @param {SavedAccount[]} accounts - Danh sách hiện tại
 * @param {AccountSessionSource} user - Tài khoản cần upsert
 * @param {object} options - Tùy chọn
 * @param {number} options.now - Thời điểm hiện tại (ms)
 * @param {boolean} [options.touch] - true: cập nhật lastUsedAt = now
 * @param {number} [options.maxAccounts] - Giới hạn số tài khoản giữ lại
 * @param {readonly RiotAuthCookie[]} [options.authCookies] - Cookie mới (bỏ qua = giữ cũ)
 * @returns {SavedAccount[]} Danh sách mới sau khi upsert
 */
export const upsertSavedAccount = (
  accounts: SavedAccount[],
  user: AccountSessionSource,
  options: {
    now: number;
    touch?: boolean;
    maxAccounts?: number;
    authCookies?: readonly RiotAuthCookie[];
  }
): SavedAccount[] => {
  if (!isSavableAccount(user)) return accounts;

  const accountId = normalizeAccountId(user.id);
  const existing = accounts.find(
    (account) => normalizeAccountId(account.id) === accountId
  );
  const lastUsedAt = options.touch
    ? options.now
    : existing?.lastUsedAt ?? options.now;
  const authCookies = options.authCookies ?? existing?.authCookies;
  const nextAccount = toSavedAccount(user, lastUsedAt, authCookies);

  if (
    existing &&
    existing.name === nextAccount.name &&
    existing.tagLine === nextAccount.tagLine &&
    existing.region === nextAccount.region &&
    existing.accessToken === nextAccount.accessToken &&
    existing.idToken === nextAccount.idToken &&
    existing.entitlementsToken === nextAccount.entitlementsToken &&
    authCookiesEqual(existing.authCookies, nextAccount.authCookies) &&
    existing.lastUsedAt === nextAccount.lastUsedAt
  ) {
    return accounts;
  }

  const maxAccounts = Math.max(1, options.maxAccounts ?? MAX_SAVED_ACCOUNTS);
  return [
    nextAccount,
    ...accounts.filter(
      (account) => normalizeAccountId(account.id) !== accountId
    ),
  ]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, maxAccounts);
};

/**
 * shouldAcceptSessionUpdate — Chấp nhận cập nhật phiên đến (từ background
 * task, notification...) chỉ khi nó thuộc cùng tài khoản đang đăng nhập
 * (hoặc khi một trong hai chưa biết ID) — tránh dữ liệu tài khoản A ghi đè
 * phiên tài khoản B.
 * @param {string} currentUserId - ID tài khoản hiện tại (có thể rỗng)
 * @param {string} incomingUserId - ID tài khoản của phiên đến (có thể rỗng)
 * @returns {boolean} true nếu nên chấp nhận cập nhật
 */
export const shouldAcceptSessionUpdate = (
  currentUserId: string,
  incomingUserId: string
) =>
  !currentUserId ||
  !incomingUserId ||
  normalizeAccountId(currentUserId) === normalizeAccountId(incomingUserId);
