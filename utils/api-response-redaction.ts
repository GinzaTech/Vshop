import { REDACTED, sanitizeUrlForLog } from "./log-redaction";
import { isKnownApiResponseEnum, isKnownApiResponseField } from "./api-response-fields";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type SanitizedApiBody = {
  body: Json;
  schema?: Json;
  truncated: boolean;
  omissions: string[];
};
export const RESPONSE_BODY_LIMITS = { maxBytes: 2 * 1024 * 1024, maxDepth: 24, maxNodes: 100_000 } as const;
const OMITTED = "[OMITTED]";
const credentials = /token|password|passwd|authorization|cookie|secret|credential|apikey|nonce|^state$|^pass$|^otp$|^pin$|^ssid$|^tdid$|^clid$|capability|^headers$|securestorage|encrypted|connectiondetails|gameclienthash|playerkey|invitecode|roomcode|joincode|privatekey|signingkey|accesskey|^code$/i;
const privateIds = /subject|puuid|userid|accountid|session|playerid|matchid|partyid|^sub$|email|gamename|tagline|^username$|^phone$/i;
const assetId = /^(uuid|itemids?|skinids?|skinlevelids?|skinleveluuid|chromaid|chromauuid|weaponid|weaponuuid|agentid|characterid|mapid|modeid|seasonid|actid|currencyid|buddyid|sprayid|cardid|titleid|offerid|singleitemoffers|bundleid|itemtypeid|relationuuid|themeid|contenttieruuid)$/i;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const textFields = /^(displayname|displaynamefallback|categorytext|description)$/i;
const enumFields = /^(errorcode|code|type|category|rarity|tiername|categoryname|queu[e]?id|gamemode|teamid|relationtype|version|clientversion|locale|language|platformtype|platformos|state)$/i;
const assetUrlFields = /^(displayicon2?|fullicon|bustportrait|fullportrait|fullportraitv2|killfeedportrait|background|chromapath|swatch|assetpath|streamedvideo)$/i;
const normalize = (key: string) => key.replace(/[^a-z\d]/gi, "");
const credentialText = /\b(?:Bearer|Basic)\s|eyJ[\w-]*\.[\w-]+\.[\w-]+|(?:token|password|cookie|authorization|secret)\s*[:=]/i;
const gameStates = new Set([
  "DEFAULT", "MATCHMAKING", "MATCHMAKING_REQUESTED", "CUSTOM_GAME_SETUP",
  "CUSTOM_GAME_STARTING", "CUSTOM_GAME_PLAYING", "MATCHMADE_GAME_STARTING",
  "MATCHMADE_GAME_PLAYING", "PREGAME", "IN_GAME", "IN_PROGRESS", "POSTGAME",
  "character_select_active", "provisioned",
]);
const schemaFields = new Set([
  "token", "accesstoken", "idtoken", "entitlementstoken", "refreshtoken", "expiresin",
  "nonce", "state", "type", "response", "parameters", "uri", "error", "errorcode",
  "message", "data", "scope", "account", "accounts", "session", "subject", "sub", "nested", "count",
]);

/** UTF-8 size without depending on TextEncoder/Buffer availability in Hermes. */
export function apiResponseUtf8Bytes(value: string): number {
  let size = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    size += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return size;
}

export function sanitizeApiResponseUrl(value: string): string {
  if (value.length > 8000) return REDACTED;
  try {
    const relative = value.startsWith("/") && !value.startsWith("//");
    const parsed = new URL(value, relative ? "https://relative.invalid" : undefined);
    const segments = parsed.pathname.split("/");
    // Decode only for comparison; an encoded slash stays inside its segment.
    const names = segments.map((segment) => decodeURIComponent(segment).toLowerCase());
    const masked = segments.map((segment, index) => {
      const parent = names[index - 1];
      return parent === "joinbycode" || parent === "members" ||
        (parent === "name" && names[index - 2] === "invites") ||
        (parent === "tag" && names[index - 4] === "invites") ? REDACTED : segment;
    });
    return sanitizeUrlForLog(`${relative ? "" : parsed.origin}${masked.join("/")}`);
  } catch { return REDACTED; }
}

function isCredentialEndpoint(url: string): boolean {
  if (url.length > 8000) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = decodeURIComponent(parsed.pathname).toLowerCase().replace(/\/+$/, "");
    return host === "auth.riotgames.com" || host === "entitlements.auth.riotgames.com" ||
      path.endsWith("/pas/v1/service/chat") || path.endsWith("/muctoken") || /\/token(?:\/|$)/.test(path);
  } catch { return true; }
}

function isGameResponse(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /^glz-[a-z\d-]+\.[a-z\d-]+\.a\.pvp\.net$/i.test(parsed.hostname) &&
      /^\/(?:parties|pregame|core-game)\//i.test(parsed.pathname);
  } catch { return false; }
}

type Budget = { bytes: number; nodes: number; halted: boolean; gameResponse: boolean; publicAssets: boolean; reasons: Set<string>; seen: WeakSet<object> };
function omit(budget: Budget, reason: string): string {
  budget.reasons.add(reason);
  return reason.endsWith("-limit") ? OMITTED : REDACTED;
}

function charge(budget: Budget, bytes: number): boolean {
  budget.bytes += bytes;
  if (budget.bytes > RESPONSE_BODY_LIMITS.maxBytes - 1024) {
    budget.halted = true;
    omit(budget, "byte-limit");
    return false;
  }
  return true;
}

function safeKey(key: string): string | null {
  return key.length <= 100 && (/^[a-z][a-z\d_]*$/i.test(key) || uuid.test(key)) &&
    !/^(?:__proto__|constructor|prototype)$/i.test(key) && !/eyJ[\w-]*\.[\w-]+\.[\w-]+/.test(key) ? key : null;
}

function sanitizeText(value: string, key: string, budget: Budget): string {
  const normalized = normalize(key);
  if (value.length > 8192) return omit(budget, "text-limit");
  if (assetUrlFields.test(normalized)) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" && parsed.hostname === "media.valorant-api.com" &&
        /^\/[a-z\d-]+\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}(?:\/[a-z\d_.-]+)*$/i.test(parsed.pathname) && !credentialText.test(parsed.pathname)) {
        parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = "";
        return parsed.toString();
      }
    } catch { /* A path or unexpected host is not approved text. */ }
  }
  if (credentialText.test(value)) return omit(budget, "credential-text");
  if (assetId.test(normalized) && uuid.test(value)) return value;
  if (/^(?:accessibility|privacy)$/i.test(normalized) && /^(?:OPEN|CLOSED)$/.test(value)) return value;
  if (/^gamepodid$/i.test(normalized) && /^aresriot\.[a-z\d.-]{1,120}$/i.test(value)) return value;
  if (/(?:date|time|timestamp|expiration|expires|expiry)/i.test(normalized) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))) return value;
  if (/^(?:mapid|modeid|gamemode|assetpath)$/i.test(normalized) &&
    /^\/Game\/(?:[a-z\d_-]+\/)*[a-z\d_.-]+$/i.test(value) && !value.split("/").some((segment) => segment === "." || segment === "..")) return value;
  if (enumFields.test(normalized) && isKnownApiResponseEnum(normalized, value)) return value;
  if (budget.publicAssets && textFields.test(normalized) && !/[<>{}\[\]]|https?:\/\/|%[a-f\d]{2}/i.test(value) && ![...value].some((character) => character.charCodeAt(0) < 32)) return value;
  return omit(budget, "unapproved-text");
}

function walk(value: unknown, key: string, depth: number, budget: Budget, schema: boolean): Json {
  if (++budget.nodes > RESPONSE_BODY_LIMITS.maxNodes) {
    budget.halted = true;
    return omit(budget, "node-limit");
  }
  if (depth > RESPONSE_BODY_LIMITS.maxDepth) return omit(budget, "depth-limit");
  if (!charge(budget, 4)) return OMITTED;
  if (value === null) return schema ? "null" : null;
  if (schema && typeof value !== "object") return typeof value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const safe = sanitizeText(value, key, budget);
    return charge(budget, apiResponseUtf8Bytes(JSON.stringify(safe))) ? safe : OMITTED;
  }
  if (!value || typeof value !== "object") return omit(budget, "unsupported-value");
  if (budget.seen.has(value)) return omit(budget, "circular");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) return omit(budget, "non-json-body");
  budget.seen.add(value);
  try {
    return array ? walkArray(value as unknown[], key, depth, budget, schema) : walkObject(value, key, depth, budget, schema);
  } finally { budget.seen.delete(value); }
}

function walkArray(value: unknown[], key: string, depth: number, budget: Budget, schema: boolean): Json[] {
  const result: Json[] = [];
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value as number;
  const label = Object.getOwnPropertyDescriptor(value, "0")?.value;
  if (!schema && length === 2 && typeof label === "string" && (credentials.test(normalize(label)) || privateIds.test(normalize(label)))) {
    omit(budget, "credential-field");
    return [REDACTED, REDACTED];
  }
  for (let index = 0; index < length; index++) {
    if (budget.halted) { result.push(OMITTED); break; }
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    result.push(!descriptor ? null : !("value" in descriptor) ? omit(budget, "accessor") : walk(descriptor.value, key, depth + 1, budget, schema));
  }
  return result;
}

function walkObject(value: object, parentKey: string, depth: number, budget: Budget, schema: boolean): { [key: string]: Json } {
  const result: { [key: string]: Json } = {};
  let hiddenKeyCount = 0;
  const namedValue = Object.getOwnPropertyDescriptor(value, "name") && Object.getOwnPropertyDescriptor(value, "value");
  // Descriptor reads never invoke getters, toJSON or caller methods.
  for (const key of Object.keys(value)) {
    if (budget.halted) break;
    let safe = safeKey(key);
    if (!safe) { omit(budget, "unsafe-key"); continue; }
    const normalized = normalize(key);
    const unknownField = !uuid.test(key) && !isKnownApiResponseField(normalized) &&
      !assetId.test(normalized) && !assetUrlFields.test(normalized) && !textFields.test(normalized) && !enumFields.test(normalized);
    if (!schema && unknownField) {
      safe = `redacted_${++hiddenKeyCount}`;
      omit(budget, "unapproved-field");
    }
    if (uuid.test(key)) {
      const parent = normalize(parentKey);
      const privateMap = /players?|sessions?|presences?|members?|accounts?|parties|matches/i.test(parent);
      const approvedMap = /^(?:balances|cost|discountcosts|totalbasecost|totaldiscountedcost|currencylimits|currencies|catalog|assets|items)$/i.test(parent);
      if (privateMap || (!budget.publicAssets && !approvedMap)) {
        safe = `redacted_${++hiddenKeyCount}`;
        omit(budget, "private-map-key");
      }
    }
    if (schema && !schemaFields.has(normalize(key).toLowerCase())) { omit(budget, "unapproved-schema-field"); continue; }
    if (!charge(budget, apiResponseUtf8Bytes(JSON.stringify(safe)) + 2)) break;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) { result[safe] = omit(budget, "accessor"); continue; }
    if (!schema && budget.gameResponse && /^(?:state|previousstate|pregamestate)$/i.test(normalized)) {
      result[safe] = typeof descriptor.value === "string" && gameStates.has(descriptor.value)
        ? descriptor.value : omit(budget, "unapproved-game-state");
    }
    else if (!schema && (credentials.test(normalized) || (namedValue && key === "value"))) result[safe] = omit(budget, "credential-field");
    else if (!schema && privateIds.test(normalized)) result[safe] = omit(budget, "private-field");
    else if (!schema && unknownField) result[safe] = REDACTED;
    else if (!schema && descriptor.value !== null && typeof descriptor.value !== "string" &&
      (textFields.test(normalized) || assetUrlFields.test(normalized) || enumFields.test(normalized)) &&
      !(normalized.toLowerCase() === "version" && Number.isSafeInteger(descriptor.value) && (descriptor.value as number) >= 0)) {
      result[safe] = omit(budget, "invalid-field-type");
    }
    else result[safe] = walk(descriptor.value, key, depth + 1, budget, schema);
  }
  return result;
}

/** An endpoint producing credentials is recorded as structure/types only. */
export function sanitizeApiResponseBody(value: unknown, url: string, contentType?: string): SanitizedApiBody {
  const budget: Budget = { bytes: 0, nodes: 0, halted: false, gameResponse: isGameResponse(url),
    publicAssets: /^https:\/\/valorant-api\.com\/v1\//i.test(url), reasons: new Set(), seen: new WeakSet() };
  const schema = isCredentialEndpoint(url);
  try {
    // Axios can parse Riot JSON even when upstream advertises text/plain.
    // Structured values still pass all traversal/prototype guards below;
    // primitive non-JSON bodies never enter the raw-string parsing path.
    const structured = value !== null && typeof value === "object";
    if (!schema && !structured && contentType && !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
      return { body: null, truncated: false, omissions: ["non-json-body"] };
    }
    if (typeof value === "string" && !schema && /^[\s]*[\[{]/.test(value)) {
      if (apiResponseUtf8Bytes(value) > RESPONSE_BODY_LIMITS.maxBytes) return { body: null, truncated: true, omissions: ["byte-limit"] };
      value = JSON.parse(value) as unknown;
    }
    const result = walk(value, "", 0, budget, schema);
    if (schema) budget.reasons.add("credential-endpoint");
    const bounded = apiResponseUtf8Bytes(JSON.stringify(result)) <= RESPONSE_BODY_LIMITS.maxBytes;
    if (!bounded) budget.reasons.add("byte-limit");
    return {
      body: schema || !bounded ? null : result,
      ...(schema ? { schema: bounded ? result : null } : {}),
      truncated: [...budget.reasons].some((reason) => reason.endsWith("-limit")),
      omissions: [...budget.reasons],
    };
  } catch { return { body: null, truncated: false, omissions: ["invalid-body"] }; }
}
