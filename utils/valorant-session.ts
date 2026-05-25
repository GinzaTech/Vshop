type TranslateFn = (key: string) => string;

const HUMAN_LABELS: Record<string, string> = {
  bombgamemode: "Standard",
  unrated: "Standard",
  competitive: "Competitive",
  ranked: "Competitive",
  swiftplay: "Swiftplay",
  spikerush: "Spike Rush",
  escalation: "Escalation",
  teamdeathmatch: "Team Deathmatch",
  deathmatch: "Deathmatch",
  customgame: "Custom",
  custom: "Custom",
};

const normalizeQueueToken = (value?: string | null) =>
  value
    ?.toLowerCase()
    .replace(/[^a-z]/g, "") || "";

const toHumanToken = (value?: string | null) => {
  if (!value) return "";

  const finalSegment = value.split("/").filter(Boolean).pop() || value;
  const cleaned = finalSegment
    .replace(/_c$/i, "")
    .replace(/\.[^.]+$/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
};

const getQueueKey = (raw?: string | null) => {
  const normalized = normalizeQueueToken(raw);

  if (!normalized) return null;

  if (normalized.includes("teamdeathmatch")) return "team_deathmatch";
  if (normalized.includes("deathmatch")) return "deathmatch";
  if (normalized.includes("competitive") || normalized.includes("ranked")) {
    return "competitive";
  }
  if (normalized.includes("swiftplay")) return "swiftplay";
  if (normalized.includes("spikerush")) return "spike_rush";
  if (normalized.includes("escalation")) return "escalation";
  if (normalized.includes("bombgamemode") || normalized.includes("unrated")) {
    return "standard";
  }
  if (normalized.includes("custom")) return "custom";

  return null;
};

export const formatSessionQueueLabel = (
  raw: string | null | undefined,
  t: TranslateFn,
  fallbackKey = "combat_session_page.unknown_queue"
) => {
  const queueKey = getQueueKey(raw);
  if (queueKey) {
    return t(`session_labels.queue.${queueKey}`);
  }

  const humanToken = toHumanToken(raw);
  if (humanToken) {
    const normalized = normalizeQueueToken(raw);
    const alias = HUMAN_LABELS[normalized];
    return alias || humanToken;
  }

  return t(fallbackKey);
};

export const formatPartyAccessLabel = (
  raw: string | null | undefined,
  t: TranslateFn
) => {
  const normalized = (raw || "").trim().toUpperCase();

  if (normalized === "OPEN") return t("session_labels.access.open");
  if (normalized === "CLOSED") return t("session_labels.access.closed");

  return t("combat_session_page.unavailable");
};

export const getSessionPartyCapacity = ({
  queueId,
  customMode,
  customPartySize,
}: {
  queueId?: string | null;
  customMode?: string | null;
  customPartySize?: number | null;
}) => {
  const normalized = normalizeQueueToken(queueId || customMode);

  if (normalized.includes("custom")) {
    return customPartySize && customPartySize > 0 ? customPartySize : 5;
  }

  if (
    normalized.includes("bombgamemode") ||
    normalized.includes("competitive") ||
    normalized.includes("ranked") ||
    normalized.includes("swiftplay") ||
    normalized.includes("spikerush") ||
    normalized.includes("escalation") ||
    normalized.includes("teamdeathmatch") ||
    normalized.includes("unrated")
  ) {
    return 5;
  }

  if (normalized.includes("deathmatch")) {
    return 1;
  }

  return customPartySize && customPartySize > 0 ? customPartySize : 5;
};
