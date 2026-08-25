export const MAX_SAVED_ACCOUNTS = 6;

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
  lastUsedAt: number
): SavedAccount => ({
  id: user.id,
  name: user.name,
  tagLine: user.TagLine,
  region: user.region,
  accessToken: user.accessToken,
  idToken: user.idToken,
  entitlementsToken: user.entitlementsToken,
  lastUsedAt,
});

export const upsertSavedAccount = (
  accounts: SavedAccount[],
  user: AccountSessionSource,
  options: {
    now: number;
    touch?: boolean;
    maxAccounts?: number;
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
  const nextAccount = toSavedAccount(user, lastUsedAt);

  if (
    existing &&
    existing.name === nextAccount.name &&
    existing.tagLine === nextAccount.tagLine &&
    existing.region === nextAccount.region &&
    existing.accessToken === nextAccount.accessToken &&
    existing.idToken === nextAccount.idToken &&
    existing.entitlementsToken === nextAccount.entitlementsToken &&
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
