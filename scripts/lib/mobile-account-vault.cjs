/* eslint-env node */

"use strict";

const MAX_ACCOUNTS = 6;
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TOKEN_LENGTH = 32 * 1024;
const MAX_COOKIES_PER_ACCOUNT = 128;
const MAX_COOKIE_FIELD_LENGTH = 16 * 1024;
const MAX_MATCHES = 200;
const MAX_PROFILE_CACHES = 3;
const MAX_WISHLIST_IDS = 2_000;
const TOKEN_SAFETY_MS = 5 * 60_000;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const REGIONS = new Set(["ap", "eu", "kr", "na", "pbe"]);
const SAME_SITE = new Set(["lax", "strict", "none"]);

class MobileVaultError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "MobileVaultError";
    this.code = code;
    this.status = status;
  }
}

const fail = (code, status) => {
  throw new MobileVaultError(code, status);
};

const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const exactKeys = (value, keys) => {
  if (!isRecord(value)) fail("VAULT_SCHEMA_REJECTED");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("VAULT_SCHEMA_REJECTED");
  }
};

const assertSafeTree = (value, depth = 0) => {
  if (depth > 48) fail("VAULT_SCHEMA_REJECTED");
  if (Array.isArray(value)) {
    for (const entry of value) assertSafeTree(entry, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) fail("VAULT_SCHEMA_REJECTED");
    assertSafeTree(value[key], depth + 1);
  }
};

const stringField = (value, max = 256) => {
  if (typeof value !== "string" || !value || value.length > max) {
    fail("VAULT_SCHEMA_REJECTED");
  }
  return value;
};

const normalizedId = (value) => stringField(value, 128).trim().toLowerCase();

const parseJwt = (value) => {
  const token = stringField(value, MAX_TOKEN_LENGTH);
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) fail("VAULT_ACCOUNT_REJECTED");
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!isRecord(payload) || typeof payload.sub !== "string" ||
        typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      fail("VAULT_ACCOUNT_REJECTED");
    }
    return { sub: normalizedId(payload.sub), expiresAt: payload.exp * 1000 };
  } catch (error) {
    if (error instanceof MobileVaultError) throw error;
    return fail("VAULT_ACCOUNT_REJECTED");
  }
};

const isRiotDomain = (value) => {
  const domain = String(value || "").trim().replace(/^\./, "").toLowerCase();
  return ["riotgames.com", "playvalorant.com"].some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
};

const validateCookie = (value) => {
  if (!isRecord(value)) fail("VAULT_ACCOUNT_REJECTED");
  const allowed = new Set([
    "name", "value", "path", "domain", "version", "expires",
    "secure", "httpOnly", "sameSite",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail("VAULT_ACCOUNT_REJECTED");
  stringField(value.name, 256);
  stringField(value.value, MAX_COOKIE_FIELD_LENGTH);
  if (!isRiotDomain(value.domain)) fail("VAULT_ACCOUNT_REJECTED");
  for (const key of ["path", "version", "expires"]) {
    if (value[key] !== undefined &&
        (typeof value[key] !== "string" || value[key].length > 2_048)) {
      fail("VAULT_ACCOUNT_REJECTED");
    }
  }
  for (const key of ["secure", "httpOnly"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      fail("VAULT_ACCOUNT_REJECTED");
    }
  }
  if (value.sameSite !== undefined && !SAME_SITE.has(value.sameSite)) {
    fail("VAULT_ACCOUNT_REJECTED");
  }
};

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
};

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const validateAccount = (value, now) => {
  exactKeys(value, [
    "id", "name", "tagLine", "region", "lastUsedAt", "accessToken",
    "idToken", "entitlementsToken", "authCookies",
  ]);
  const id = normalizedId(value.id);
  stringField(value.name, 128);
  stringField(value.tagLine, 64);
  if (!REGIONS.has(value.region)) fail("VAULT_ACCOUNT_REJECTED");
  if (typeof value.lastUsedAt !== "number" || !Number.isFinite(value.lastUsedAt) ||
      value.lastUsedAt < 0 || value.lastUsedAt > now + 5 * 60_000) {
    fail("VAULT_ACCOUNT_REJECTED");
  }
  const access = parseJwt(value.accessToken);
  const identity = parseJwt(value.idToken);
  if (access.sub !== id || identity.sub !== id) fail("VAULT_ACCOUNT_REJECTED");
  stringField(value.entitlementsToken, MAX_TOKEN_LENGTH);
  if (!Array.isArray(value.authCookies) || value.authCookies.length > MAX_COOKIES_PER_ACCOUNT) {
    fail("VAULT_ACCOUNT_REJECTED");
  }
  value.authCookies.forEach(validateCookie);
  return {
    id,
    tokenStatus: access.expiresAt > now + TOKEN_SAFETY_MS ? "ready" : "needs_reauth",
  };
};

const validateStateSnapshot = (value, activeAccount) => {
  exactKeys(value, ["activeUser", "matchCache", "profileCaches", "wishlist", "preferences"]);
  if (!isRecord(value.activeUser) || normalizedId(value.activeUser.id) !== activeAccount.id ||
      value.activeUser.region !== activeAccount.region) {
    fail("VAULT_SCHEMA_REJECTED");
  }
  if (["accessToken", "idToken", "entitlementsToken", "authCookies"].some(
    (key) => Object.prototype.hasOwnProperty.call(value.activeUser, key),
  )) fail("VAULT_SCHEMA_REJECTED");
  if (value.matchCache !== null) {
    if (!isRecord(value.matchCache) ||
        value.matchCache.authKey !== `${activeAccount.region}|${activeAccount.id}` ||
        !Array.isArray(value.matchCache.matches) ||
        value.matchCache.matches.length > MAX_MATCHES) {
      fail("VAULT_SCHEMA_REJECTED");
    }
  }
  if (!isRecord(value.profileCaches) || Object.keys(value.profileCaches).length > MAX_PROFILE_CACHES) {
    fail("VAULT_SCHEMA_REJECTED");
  }
  exactKeys(value.wishlist, ["skinIds", "notificationEnabled"]);
  if (!Array.isArray(value.wishlist.skinIds) ||
      value.wishlist.skinIds.length > MAX_WISHLIST_IDS ||
      value.wishlist.skinIds.some((entry) => typeof entry !== "string" || !entry || entry.length > 128) ||
      new Set(value.wishlist.skinIds).size !== value.wishlist.skinIds.length ||
      typeof value.wishlist.notificationEnabled !== "boolean") {
    fail("VAULT_SCHEMA_REJECTED");
  }
  exactKeys(value.preferences, ["screenshotModeEnabled"]);
  if (typeof value.preferences.screenshotModeEnabled !== "boolean") {
    fail("VAULT_SCHEMA_REJECTED");
  }
};

function validateMobileVaultEnvelope(value, {
  maxPayloadBytes = MAX_PAYLOAD_BYTES,
  now = Date.now,
} = {}) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return fail("VAULT_SCHEMA_REJECTED");
  }
  if (typeof serialized !== "string") fail("VAULT_SCHEMA_REJECTED");
  if (Buffer.byteLength(serialized, "utf8") > maxPayloadBytes) fail("VAULT_TOO_LARGE", 413);
  assertSafeTree(value);
  exactKeys(value, [
    "schemaVersion", "capturedAt", "source", "activeAccountId", "accounts", "stateSnapshot",
  ]);
  const current = now();
  if (value.schemaVersion !== 2 || typeof value.capturedAt !== "number" ||
      !Number.isFinite(value.capturedAt) || value.capturedAt < 0 ||
      value.capturedAt > current + 5 * 60_000) fail("VAULT_SCHEMA_REJECTED");
  exactKeys(value.source, ["packageName", "appVersion", "versionCode"]);
  if (value.source.packageName !== "com.android.vshop" ||
      typeof value.source.appVersion !== "string" || !value.source.appVersion ||
      value.source.appVersion.length > 64 || !Number.isInteger(value.source.versionCode) ||
      value.source.versionCode < 1) fail("VAULT_SCHEMA_REJECTED");
  if (!Array.isArray(value.accounts) || value.accounts.length < 1 ||
      value.accounts.length > MAX_ACCOUNTS) fail("VAULT_SCHEMA_REJECTED");
  const statuses = value.accounts.map((entry) => validateAccount(entry, current));
  const ids = statuses.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) fail("VAULT_ACCOUNT_REJECTED");
  const activeId = normalizedId(value.activeAccountId);
  const activeIndex = ids.indexOf(activeId);
  if (activeIndex < 0) fail("VAULT_SCHEMA_REJECTED");
  validateStateSnapshot(value.stateSnapshot, value.accounts[activeIndex]);
  const cloned = jsonClone(value);
  cloned.activeAccountId = activeId;
  cloned.accounts = cloned.accounts.map((entry, index) => ({
    ...entry,
    id: statuses[index].id,
    tokenStatus: statuses[index].tokenStatus,
  }));
  return deepFreeze(cloned);
}

const handleForAccount = (handles, accountId) => {
  const handle = handles.get(accountId);
  if (typeof handle !== "string" || !handle) fail("VAULT_ACCOUNT_REJECTED", 404);
  return handle;
};

function createVaultManifest(vault, handles) {
  const activeHandle = handleForAccount(handles, vault.activeAccountId);
  return deepFreeze({
    schemaVersion: 2,
    capturedAt: vault.capturedAt,
    activeHandle,
    accounts: vault.accounts.map((entry) => ({
      handle: handleForAccount(handles, entry.id),
      name: entry.name,
      tagLine: entry.tagLine,
      region: entry.region,
      lastUsedAt: entry.lastUsedAt,
      tokenStatus: entry.tokenStatus,
    })),
    snapshotManifest: {
      hasMatchCache: vault.stateSnapshot.matchCache !== null,
      profileCacheCount: Object.keys(vault.stateSnapshot.profileCaches).length,
      wishlistCount: vault.stateSnapshot.wishlist.skinIds.length,
    },
  });
}

function projectAccountSession(vault, handle, handles) {
  const selected = vault.accounts.find(
    (entry) => handleForAccount(handles, entry.id) === handle,
  );
  if (!selected) fail("VAULT_ACCOUNT_REJECTED", 404);
  return deepFreeze({
    accountId: selected.id,
    name: selected.name,
    tagLine: selected.tagLine,
    region: selected.region,
    lastUsedAt: selected.lastUsedAt,
    accessToken: selected.accessToken,
    idToken: selected.idToken,
    entitlementsToken: selected.entitlementsToken,
    authCookies: jsonClone(selected.authCookies),
    tokenStatus: selected.tokenStatus,
    stateSnapshot: selected.id === vault.activeAccountId
      ? jsonClone(vault.stateSnapshot)
      : null,
  });
}

module.exports = {
  MAX_ACCOUNTS,
  MAX_PAYLOAD_BYTES,
  MobileVaultError,
  createVaultManifest,
  projectAccountSession,
  validateMobileVaultEnvelope,
};
