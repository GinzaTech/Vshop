// Public match transformation and formatting API. Keep consumers independent of module layout.
import { numberOrZero } from "./match-transform/common";

export { createMatchAssetCatalog } from "./match-transform/assets";
export { buildMatchDetailViewModel } from "./match-transform/detail";
export { buildMatchHistoryRecord, enrichMatchHistoryAssets, toMatchHistoryItem, buildMatchHistoryGroups, compactRankUpdate, getRankedRatingChange } from "./match-transform/history";
export { getMatchHistoryResult, resolveMatchOutcome } from "./match-result";

export function formatMatchRelativeTime(
  startedAt: string,
  locale: string,
  now = Date.now()
): string {
  const elapsedMinutes = Math.max(
    1,
    Math.floor((now - new Date(startedAt).getTime()) / 60_000)
  );
  const vietnamese = (locale || "en").toLowerCase().startsWith("vi");
  if (elapsedMinutes < 60) {
    return vietnamese ? `${elapsedMinutes}ph truoc` : `${elapsedMinutes}m ago`;
  }
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return vietnamese ? `${hours}g truoc` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return vietnamese ? `${days}ng truoc` : `${days}d ago`;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(numberOrZero(totalSeconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}min ${seconds}s`;
}

export function formatMetric(
  value: number | null | undefined,
  digits = 0
): string {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "--";
}

export function formatPercent(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : "--";
}

export function formatSigned(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "--";
  const number = Number(value);
  return number > 0 ? `+${Math.round(number)}` : `${Math.round(number)}`;
}

export function formatOrdinal(value: number): string {
  const integer = Math.max(1, Math.round(value));
  const mod100 = integer % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${integer}th`;
  const suffix = integer % 10 === 1 ? "st" : integer % 10 === 2 ? "nd" : integer % 10 === 3 ? "rd" : "th";
  return `${integer}${suffix}`;
}

export function humanizeMatchMode(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "Standard";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
