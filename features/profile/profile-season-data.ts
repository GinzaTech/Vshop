import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import {
  getRecordedSeasonStartTime,
  type MatchRecordingBaseline,
} from "~/services/matches/match-recording-core";

export type ProfileSeasonUpdate = {
  MatchID: string;
  SeasonID: string;
  MatchStartTime: string | number;
};

export type ProfileSeasonPageInspection<T extends ProfileSeasonUpdate> = {
  targetUpdates: T[];
  hasSeenTarget: boolean;
  shouldStop: boolean;
};

export type ProfileSeasonTimeWindow = {
  endTimeMs: number;
  startTimeMs: number;
};

const normalizeSeasonId = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase("en-US") ?? "";

/** Chỉ coi request của đúng account hiện tại là loading cho UI account đó. */
export function hasPendingProfileSeasonRequest(
  requestKeys: Iterable<string>,
  authKey: string
) {
  const accountPrefix = `${authKey}|`;
  for (const requestKey of requestKeys) {
    if (requestKey.startsWith(accountPrefix)) return true;
  }
  return false;
}

/** Chọn Act được yêu cầu; ID sai hoặc rỗng sẽ quay về Act đang hoạt động. */
export function resolveProfileSeason(
  seasons: readonly LeaderboardSeasonOption[],
  requestedSeasonId: string | null | undefined
): LeaderboardSeasonOption | null {
  const requestedId = normalizeSeasonId(requestedSeasonId);
  const requested = seasons.find(
    (season) => normalizeSeasonId(season.id) === requestedId
  );

  return requested ?? seasons.find((season) => season.isActive) ?? seasons[0] ?? null;
}

/**
 * Suy ra khoảng thời gian của Act từ danh sách mới → cũ. Mốc bắt đầu Act mới
 * hơn chính là mốc kết thúc độc quyền của Act đang chọn.
 */
export function resolveProfileSeasonTimeWindow(
  seasons: readonly LeaderboardSeasonOption[],
  selectedSeasonId: string,
  baseline?: MatchRecordingBaseline | null
): ProfileSeasonTimeWindow | null {
  const selectedIndex = seasons.findIndex(
    (season) => normalizeSeasonId(season.id) === normalizeSeasonId(selectedSeasonId)
  );
  if (selectedIndex < 0) return null;

  const startTimeMs = baseline
    ? getRecordedSeasonStartTime(seasons[selectedIndex], baseline)
    : Date.parse(seasons[selectedIndex].startTime);
  if (!Number.isFinite(startTimeMs)) return null;
  const newerSeason = selectedIndex > 0 ? seasons[selectedIndex - 1] : null;
  const parsedEndTimeMs = newerSeason ? Date.parse(newerSeason.startTime) : Infinity;

  return {
    endTimeMs: Number.isFinite(parsedEndTimeMs) ? parsedEndTimeMs : Infinity,
    startTimeMs,
  };
}

/** Chuẩn hóa timestamp Riot; một số response cũ dùng giây thay vì mili-giây. */
export function normalizeProfileMatchStartTime(value: string | number) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue > 0 && numericValue < 1_000_000_000_000
      ? numericValue * 1_000
      : numericValue;
  }
  const parsedValue = Date.parse(String(value));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

/**
 * Đọc một trang competitive updates (mới → cũ), lấy đúng trận của Act đích
 * và cho caller biết khi luồng đã đi qua Act đó để dừng phân trang sớm.
 */
export function inspectSeasonUpdatePage<T extends ProfileSeasonUpdate>(
  updates: readonly T[],
  targetSeasonId: string,
  targetSeenBeforePage: boolean
): ProfileSeasonPageInspection<T> {
  const normalizedTargetId = normalizeSeasonId(targetSeasonId);
  const isTarget = (update: T) =>
    normalizeSeasonId(update.SeasonID) === normalizedTargetId;
  const targetUpdates = updates.filter(isTarget);
  const hasSeenTarget = targetSeenBeforePage || targetUpdates.length > 0;

  if (updates.length === 0) {
    return { targetUpdates, hasSeenTarget, shouldStop: true };
  }

  if (!hasSeenTarget) {
    return { targetUpdates, hasSeenTarget, shouldStop: false };
  }

  const lastTargetIndex = updates.findLastIndex(isTarget);
  const shouldStop =
    lastTargetIndex < 0 ||
    updates
      .slice(lastTargetIndex + 1)
      .some((update) => normalizeSeasonId(update.SeasonID) !== normalizedTargetId);

  return { targetUpdates, hasSeenTarget, shouldStop };
}
