/** Detached, bounded diagnostics. Never keep a registry of observed credentials. */
export const REDACTED = "[REDACTED]";
const MAX_TEXT = 8000;
const MAX_DEPTH = 6;
const sensitiveKey = /token|password|passwd|authorization|cookie|secret|credential|securestorage|encrypted|apikey|session|nonce|^state$|^pass$|^ssid$|^tdid$|^clid$|^sub$|puuid|userid|accountid|matchid|partyid/i;
const idParents = new Set([
  "players", "player", "users", "accounts", "matches", "parties", "sessions",
  "storefront", "wallet", "history", "entitlements", "contracts", "item-upgrades", "invitecode",
]);
const uuid = /[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/gi;

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "");
}

/** Queries, fragments and URL credentials are never useful persistent log data. */
export function sanitizeUrlForLog(value: string): string {
  if (value.length > MAX_TEXT) return REDACTED;
  try {
    const relative = value.startsWith("/") && !value.startsWith("//");
    const url = new URL(value, relative ? "https://relative.invalid" : undefined);
    if (!/^https?:$/.test(url.protocol)) return REDACTED;
    const segments = url.pathname.split("/");
    const path = segments.map((segment, index) => {
      const parent = decodeURIComponent(segments[index - 1] ?? "").toLowerCase();
      if (idParents.has(parent) || sensitiveKey.test(normalizeKey(parent))) return REDACTED;
      return segment.replace(uuid, REDACTED);
    }).join("/");
    return `${relative ? "" : url.origin}${path}`;
  } catch {
    return REDACTED;
  }
}

function redactText(value: string, depth: number, seen: WeakSet<object>): string {
  if (value.length > MAX_TEXT || depth > MAX_DEPTH) return REDACTED;
  const trimmed = value.trim();
  // Preserve encoded path segment boundaries until their IDs have been removed.
  if (/^(?:https?:\/\/|\/)/i.test(trimmed)) return sanitizeUrlForLog(trimmed);
  const protectedUrls = value.replace(/https?:\/\/[^\s<>"']+/gi, (url) => sanitizeUrlForLog(url));
  if (protectedUrls !== value) return redactText(protectedUrls, depth + 1, seen);
  if (/%[0-9a-f]{2}/i.test(trimmed)) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded !== trimmed) return redactText(decoded, depth + 1, seen);
    } catch { return REDACTED; }
  }
  if (/^[{[\"]/.test(trimmed)) {
    try { return JSON.stringify(redactValue(JSON.parse(trimmed), depth + 1, seen)); }
    catch { return REDACTED; }
  }
  return value
    .replace(/https?:\/\/[^\s<>"']+/gi, (url) => sanitizeUrlForLog(url))
    .replace(/(?:set-cookie|cookie|authorization)\s*:[^\r\n]*/gi, REDACTED)
    .replace(/\b(?:Bearer|Basic)\s+[a-z\d+/_=.-]+/gi, REDACTED)
    .replace(/\beyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+/gi, REDACTED)
    .replace(/(\b(?!https?\b)[\w.-]+\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}&]+)/g, `$1${REDACTED}`)
    .replace(uuid, REDACTED);
}

function ownValue(value: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

export type SanitizedLogError = { name: string; message: string; code?: string; status?: number };

/** Arbitrary upstream messages/stacks/configs can contain unlabelled secrets. */
export function sanitizeErrorForLog(error: unknown): SanitizedLogError {
  const result: SanitizedLogError = { name: "Error", message: "Operation failed" };
  if (!error || typeof error !== "object") return result;
  try {
    const code = ownValue(error, "code");
    const response = ownValue(error, "response");
    const status = response && typeof response === "object"
      ? ownValue(response, "status") : ownValue(error, "status");
    const safeCodes = ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED", "ERR_BAD_REQUEST", "ERR_BAD_RESPONSE"];
    return {
      ...result,
      ...(typeof code === "string" && safeCodes.includes(code) ? { code } : {}),
      ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    };
  } catch { return result; }
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth > MAX_DEPTH) return REDACTED;
  if (typeof value === "string") return redactText(value, depth, seen);
  if (typeof value !== "object") return "[Omitted]";
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  try {
    if (value instanceof Error) return sanitizeErrorForLog(value);
    if (typeof Headers !== "undefined" && value instanceof Headers) {
      const entries: [string, unknown][] = [];
      value.forEach((entry, key) => entries.push([key, entry]));
      return redactValue(Object.fromEntries(entries), depth + 1, seen);
    }
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === "string" && sensitiveKey.test(normalizeKey(value[0]))) {
        return [redactText(value[0], depth + 1, seen), REDACTED];
      }
      return value.slice(0, 40).map((entry) => redactValue(entry, depth + 1, seen));
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const namedValue = "name" in descriptors && "value" in descriptors;
    return Object.fromEntries(Object.entries(descriptors).slice(0, 60).map(([key, descriptor]) => [
      redactText(key, depth + 1, seen),
      sensitiveKey.test(normalizeKey(key)) || (namedValue && key === "value") || !("value" in descriptor)
        ? REDACTED : redactValue(descriptor.value, depth + 1, seen),
    ]));
  } finally { seen.delete(value); }
}

/** Fail closed for hostile objects/proxies rather than logging the original. */
export function redactLogValue(value: unknown): unknown {
  try { return redactValue(value, 0, new WeakSet()); }
  catch { return REDACTED; }
}
