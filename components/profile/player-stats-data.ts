import type { MatchHistoryRecord } from "~/types/match-ui";
import { getMatchHistoryResult } from "~/utils/match-result";
export type TableMode = "agents" | "maps";
export type AggregateRow = {
  adr: number;
  games: number;
  headshotPercent: number;
  id: string;
  imageUrl: string | null;
  kd: number;
  name: string;
  winPercent: number;
};

// ActivityCell: Một ô trong heatmap hoạt động 12 tuần
export type ActivityCell = {
  count: number;
  date: Date;
  dateKey: string;
  future: boolean;
  level: 0 | 1 | 2 | 3 | 4 | 5;
};

export const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * aggregateMatches – Tổng hợp trận theo agent hoặc map để vẽ bảng top 6.
 * Gom: số game, số thắng, kills/deaths, tổng ADR, trung bình HS% (bỏ trận
 * null). K/D tính kills/deaths (không deaths → kills). Sort theo số game
 * giảm dần rồi K/D, lấy 6 dòng đầu.
 * (export cho PlayerInfoView tái sử dụng cùng công thức tổng hợp)
 *
 * @param matches – Danh sách trận (bỏ qua trận thiếu stats).
 * @param mode – "agents" gom theo agent, "maps" gom theo map.
 * @returns Mảng tối đa 6 AggregateRow đã sắp xếp.
 */
export const aggregateMatches = (
  matches: MatchHistoryRecord[],
  mode: TableMode
): AggregateRow[] => {
  const groups = new Map<
    string,
    {
      adrTotal: number;
      deaths: number;
      games: number;
      hsCount: number;
      hsTotal: number;
      id: string;
      imageUrl: string | null;
      kills: number;
      name: string;
      wins: number;
    }
  >();

  matches.forEach((match) => {
    const stats = match.stats;
    if (!stats) return;
    const result = getMatchHistoryResult(stats);
    if (result === "cancelled" || result === "unknown") return;

    const id =
      mode === "agents"
        ? stats.agentId || stats.agentName
        : stats.mapId || stats.mapName;
    const name = mode === "agents" ? stats.agentName : stats.mapName;
    if (!id || !name) return;

    const current = groups.get(id) ?? {
      adrTotal: 0,
      deaths: 0,
      games: 0,
      hsCount: 0,
      hsTotal: 0,
      id,
      imageUrl:
        mode === "agents"
          ? stats.agentIcon || stats.agentPortrait
          : stats.mapImage,
      kills: 0,
      name,
      wins: 0,
    };

    groups.set(id, {
      ...current,
      games: current.games + 1,
      wins: current.wins + (result === "win" ? 1 : 0),
      kills: current.kills + stats.kills,
      deaths: current.deaths + stats.deaths,
      adrTotal: current.adrTotal + stats.adr,
      hsTotal: current.hsTotal + (stats.headshotPercent ?? 0),
      hsCount: current.hsCount + (stats.headshotPercent === null ? 0 : 1),
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      adr: group.games > 0 ? group.adrTotal / group.games : 0,
      games: group.games,
      headshotPercent:
        group.hsCount > 0 ? group.hsTotal / group.hsCount : 0,
      id: group.id,
      imageUrl: group.imageUrl,
      kd: group.deaths > 0 ? group.kills / group.deaths : group.kills,
      name: group.name,
      winPercent: group.games > 0 ? (group.wins / group.games) * 100 : 0,
    }))
    .sort((left, right) => right.games - left.games || right.kd - left.kd)
    .slice(0, 6);
};

/**
 * buildActivityWeeks – Dựng dữ liệu heatmap hoạt động 12 tuần (84 ô).
 * Tuần đầu bắt đầu từ Thứ 2 của tuần cách nay 11 tuần; mỗi ô đếm số trận
 * trong ngày, đánh dấu tương lai (future) và mức cường độ level 0-5.
 *
 * @param matches – Danh sách trận (dùng GameStartTime đếm theo ngày).
 * @returns Mảng 12 tuần, mỗi tuần là mảng 7 ActivityCell.
 */
export const buildActivityWeeks = (matches: MatchHistoryRecord[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(thisMonday);
  start.setDate(thisMonday.getDate() - 11 * 7);

  const counts = new Map<string, number>();
  matches.forEach((match) => {
    if (!match.GameStartTime) return;
    const date = new Date(match.GameStartTime);
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from({ length: 12 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex): ActivityCell => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const key = dayKey(date);
      const count = counts.get(key) ?? 0;
      return {
        count,
        date,
        dateKey: key,
        future: date.getTime() > today.getTime(),
        level: Math.min(5, count) as ActivityCell["level"],
      };
    })
  );
};
