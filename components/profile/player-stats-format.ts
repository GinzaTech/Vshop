import type { ViewStyle } from "react-native";
import { STATS_COLORS } from "./player-stats-styles";
export type DashboardTone = "positive" | "negative" | "neutral";
export const compactNumber = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : Math.round(value).toLocaleString();

/**
 * oneDecimal – Format số với 1 chữ số thập phân; không hợp lệ trả "--".
 * @param value – Số cần format.
 * @returns Chuỗi "x.y" hoặc "--".
 */
export const oneDecimal = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : value.toFixed(1);

/**
 * percentage – Format số thành phần trăm làm tròn; không hợp lệ trả "--".
 * @param value – Số cần format (0-100).
 * @returns Chuỗi "x%" hoặc "--".
 */
export const percentage = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : `${Math.round(value)}%`;

/**
 * toneColor – Đổi tông ngữ nghĩa thành mã màu của dashboard.
 * @param tone – Tông cần lấy màu.
 * @returns Mã màu positive/negative/neutral.
 */
export const toneColor = (tone: DashboardTone) => {
  if (tone === "positive") return STATS_COLORS.positive;
  if (tone === "negative") return STATS_COLORS.negative;
  return STATS_COLORS.neutral;
};

/**
 * toneForKd – Tông màu theo K/D: >= 1 xanh, < 1 đỏ, không hợp lệ neutral.
 * @param value – Giá trị K/D.
 * @returns DashboardTone tương ứng.
 */
export const toneForKd = (value: number | null | undefined): DashboardTone =>
  value === null || value === undefined
    ? "neutral"
    : value >= 1
      ? "positive"
      : "negative";

/**
 * toneForWinRate – Tông màu theo tỉ lệ thắng: >= 50% xanh, < 50% đỏ.
 * @param value – Tỉ lệ thắng (0-100).
 * @returns DashboardTone tương ứng.
 */
export const toneForWinRate = (value: number | null | undefined): DashboardTone =>
  value === null || value === undefined
    ? "neutral"
    : value >= 50
      ? "positive"
      : "negative";

export const lineStyle = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ViewStyle => {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    position: "absolute",
    left: (x1 + x2 - distance) / 2,
    top: (y1 + y2) / 2 - 1,
    width: distance,
    height: 2,
    borderRadius: 2,
    backgroundColor: STATS_COLORS.accent,
    transform: [{ rotate: `${angle}deg` }],
  };
};
