import type { RiotAuthCookie } from "./cookies";

export const MAX_SAVED_ACCOUNTS = 6;

/** Missing expiry denotes a session cookie; native storage decides its validity. */
export const hasUnexpiredAuthCookies = (cookies: readonly RiotAuthCookie[], now = Date.now()) =>
  cookies.some((cookie) => {
      // Anti-bot/tracking cookies can outlive the Riot login session.
      if (cookie.name !== "ssid" || !cookie.value) return false;
    const expiresAt = cookie.expires ? Date.parse(cookie.expires) : NaN;
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });

export type AccountSessionSource = {
  id: string;
  name: string;
  TagLine: string;
  region: string;
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
};

export type AccountIdentitySource = Pick<AccountSessionSource, "id" | "region">;

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

export const normalizeAccountId = (accountId: string) =>
  accountId.trim().toLowerCase();

export const getAccountSessionKey = (account: AccountIdentitySource) => {
  const accountId = normalizeAccountId(account.id);
  const region = account.region.trim().toLowerCase();
  return accountId && region ? `${region}|${accountId}` : "guest";
};

export const isSameAccountSessionKey = (
  currentKey: string,
  expectedKey: string
) => currentKey === expectedKey;

export const isSavableAccount = (
  user: AccountSessionSource
): boolean =>
  Boolean(
    normalizeAccountId(user.id) &&
      user.region &&
      user.accessToken &&
      user.entitlementsToken
  );

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

export const shouldAcceptSessionUpdate = (
  currentUserId: string,
  incomingUserId: string
) =>
  !currentUserId ||
  !incomingUserId ||
  normalizeAccountId(currentUserId) === normalizeAccountId(incomingUserId);
