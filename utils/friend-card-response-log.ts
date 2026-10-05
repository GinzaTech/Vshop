import { Buffer } from "buffer";

const secretKey = /token|password|passwd|cookie|authorization|credential|secret|apikey|ticket|nonce|^(?:ssid|sessionid)$/i;
const scrubText = (text: string) => text
  .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[REDACTED]")
  .replace(/\b(?:Bearer|Basic)\s+[\w+\/=.-]+/gi, "[REDACTED]")
  .replace(/\b((?:access[_-]?|id[_-]?|entitlements[_-]?)?token|password|cookie|authorization|secret|api[_-]?key)\s*=\s*(["'])[\s\S]*?\2/gi, "$1=$2[REDACTED]$2");

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 20) return "[OMITTED: depth limit]";
  if (typeof value === "string") {
    if (/^\s*[\[{]/.test(value)) {
      try { return JSON.stringify(safeValue(JSON.parse(value), depth + 1)); } catch { /* Ordinary XML/text remains useful. */ }
    }
    return scrubText(value);
  }
  if (Array.isArray(value)) return value.map((item) => safeValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, secretKey.test(key.replace(/[^a-z0-9]/gi, "")) ? "[REDACTED]" : safeValue(item, depth + 1)]));
}

/** User-authorized local card capture, distinct from production log redaction. */
export function captureFriendCardResponse(kind: "roster" | "presence", value: unknown) {
  const decoded: { tag: string; value: unknown }[] = [];
  let sanitized = safeValue(value);
  if (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)) {
    const record = sanitized as Record<string, unknown>;
    if (typeof record.raw === "string") {
      const raw = record.raw.replace(/(<(?:[\w.-]+:)?(p|private)\b[^>]*>)([\s\S]*?)(<\/(?:[\w.-]+:)?\2\s*>)/gi,
        (_whole, open: string, tag: string, payload: string, close: string) => {
          const unescaped = payload.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          try {
            const text = unescaped.trim().startsWith("{") ? unescaped : Buffer.from(unescaped.trim(), "base64").toString("utf8");
            const parsed: unknown = JSON.parse(text);
            const safe = safeValue(parsed);
            decoded.push({ tag, value: safe });
            return `${open}${JSON.stringify(safe)}${close}`;
          } catch {
            return `${open}[UNDECODED PAYLOAD]${close}`;
          }
        });
      const withoutSecrets = raw.replace(/<((?:[\w.-]+:)?[\w.-]*(?:token|password|passwd|cookie|authorization|credential|secret|apikey|ticket|nonce|ssid|sessionid)[\w.-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        (_element, tag: string) => `<${tag}>[REDACTED]</${tag}>`);
      sanitized = { ...record, raw: scrubText(withoutSecrets) };
    }
  }
  return { kind, capturedAt: new Date().toISOString(), data: sanitized, decoded };
}
