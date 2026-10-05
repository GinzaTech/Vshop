import { Buffer } from "buffer";

/** The only decoded presence fields retained in the friend store. */
export type PartyPresence = {
  playerCardId?: string;
  accountLevel?: number;
  sessionLoopState?: string;
  isIdle?: boolean;
};

export function presenceShow(stanza: string, show: string): string {
  return /\btype\s*=\s*['"](?:unavailable|error)['"]/.test(stanza.split(">")[0]) ? "offline" : show;
}

function decodeXmlText(text: string): string {
  return text.replace(/&(?:quot|apos|lt|gt|amp|#\d+|#x[\da-fA-F]+);/g, (entity) => {
    const named: Record<string, string> = { "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&" };
    if (named[entity]) return named[entity];
    const hex = entity.startsWith("&#x");
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  });
}

function objectFields(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function displayFields(data: Record<string, unknown>): PartyPresence {
  const playerCardId = typeof data.playerCardId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(data.playerCardId.trim()) ? data.playerCardId.trim() : undefined;
  const accountLevel = typeof data.accountLevel === "number" && Number.isSafeInteger(data.accountLevel) && data.accountLevel >= 0 ? data.accountLevel : undefined;
  const sessionLoopState = typeof data.sessionLoopState === "string" && /^[A-Z_]{1,40}$/.test(data.sessionLoopState) ? data.sessionLoopState : undefined;
  const isIdle = typeof data.isIdle === "boolean" ? data.isIdle : undefined;
  return { ...(playerCardId ? { playerCardId } : {}), ...(accountLevel !== undefined ? { accountLevel } : {}),
    ...(sessionLoopState ? { sessionLoopState } : {}), ...(isIdle !== undefined ? { isIdle } : {}) };
}

function readMetadata(payload: string, nestedPresence: boolean): PartyPresence | undefined {
  const text = payload.trim();
  if (!text || text.length > 32_768) return undefined;
  try {
    const encoded = text.replace(/\s/g, "");
    const json = text.startsWith("{") ? text :
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)?$/.test(encoded)
        ? Buffer.from(encoded, "base64").toString("utf8") : "";
    const value: unknown = JSON.parse(json);
    const data = objectFields(value);
    if (!data) return undefined;
    const player = nestedPresence ? objectFields(data.playerPresenceData) : undefined;
    const match = nestedPresence ? objectFields(data.matchPresenceData) : undefined;
    // Only the two observed Valorant p paths; valid nested fields override legacy.
    const metadata = {
      ...displayFields(data),
      ...displayFields({ playerCardId: player?.playerCardId, accountLevel: player?.accountLevel, sessionLoopState: match?.sessionLoopState }),
    };
    return Object.keys(metadata).length ? metadata : undefined;
  } catch { return undefined; }
}

type PresenceElement = {
  name: string;
  product?: string;
  text: string;
  hasChildren: boolean;
};
const localName = (name: string) => name.split(":").at(-1);
const isPayload = (name: string) => ["p", "pd"].includes(localName(name) ?? "");

function declaredProduct(attributes: string): string {
  const names = new Set<string>();
  const identities: string[] = [];
  let offset = 0;
  const pattern = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of attributes.matchAll(pattern)) {
    const gap = attributes.slice(offset, match.index);
    if (!/^\s*$/.test(gap) || (offset > 0 && !gap) || names.has(match[1])) return "unknown";
    names.add(match[1]);
    if (match[1] === "name" || match[1] === "id") identities.push(decodeXmlText(match[2] ?? match[3]).toLowerCase());
    offset = match.index + match[0].length;
  }
  return /^\s*$/.test(attributes.slice(offset)) && identities.length > 0 && identities.every((value) => value === identities[0])
    ? identities[0] || "unknown" : "unknown";
}

function productName(name: string, attributes: string, parent?: PresenceElement): string | undefined {
  const local = localName(name);
  if (local === "product") {
    return declaredProduct(attributes);
  }
  if (["valorant", "keystone", "league_of_legends", "league"].includes(local ?? "") ||
    ["games", "products"].includes(localName(parent?.name ?? "") ?? "")) return local;
  return undefined;
}

/**
 * Read only direct p/pd children of a closed Valorant product. The XMPP callback
 * supplies the stanza body, which can contain several unrelated products.
 * A bounded XML scanner keeps self-closing/namespace tags from crossing those
 * boundaries; entities/CDATA are decoded once and no raw payload is retained.
 */
export function parsePartyPresence(xml: string): PartyPresence | undefined {
  if (!xml || xml.length > 262_144) return undefined;
  const elements: PresenceElement[] = [];
  let result: PartyPresence | undefined;
  let candidate: PartyPresence | undefined;
  let offset = 0;
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\/?[A-Za-z_][\w.:-]*(?:\s+[^<>]*?)?\s*\/?>|[^<]+/g;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== offset) return undefined;
    const token = match[0];
    offset += token.length;
    if (token.startsWith("<!--")) continue;
    const parent = elements.at(-1);
    if (!token.startsWith("<") || token.startsWith("<![CDATA[")) {
      if (parent && isPayload(parent.name)) {
        const text = token.startsWith("<![CDATA[") ? token.slice(9, -3) : decodeXmlText(token);
        elements[elements.length - 1] = { ...parent, text: parent.text + text };
      }
      continue;
    }
    const tag = /^<(\/)?([\w.:-]+)([\s\S]*?)\/?\s*>$/.exec(token);
    if (!tag) return undefined;
    const [, closing, name, attributes] = tag;
    if (closing) {
      if (parent?.name !== name) return undefined;
      const element = elements.pop()!;
      const product = elements.at(-1);
      if (isPayload(name) && !element.hasChildren && product?.product === "valorant" &&
        elements.every((ancestor) => !ancestor.product || ancestor.product === "valorant")) {
        const metadata = readMetadata(element.text, localName(name) === "p");
        if (metadata) candidate = { ...candidate, ...metadata };
      }
      if (element.product === "valorant") {
        result ??= candidate;
        candidate = undefined;
      }
      continue;
    }
    if (parent) elements[elements.length - 1] = { ...parent, hasChildren: true };
    if (/\/\s*>$/.test(token)) continue;
    if (elements.length >= 32) return undefined;
    elements.push({ name, product: productName(name, attributes, parent), text: "", hasChildren: false });
  }
  return offset === xml.length && elements.length === 0 ? result : undefined;
}
