// ====== InfoPill – Viên thông tin dạng "pill" (chip) hiển thị nội dung linh hoạt ======
// Dùng để hiển thị một nhóm text / component dạng hàng ngang với kiểu dáng bo tròn,
// thường dùng làm tag, nhãn thông tin hoặc summary nhỏ.

import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

/**
 * Định nghĩa props cho InfoPill.
 *
 * @param children – Nội dung bên trong pill: có thể là string, number hoặc ReactNode.
 * @param style    – (tuỳ chọn) Style ghi đè khung ngoài.
 */
interface InfoPillProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * InfoPill Component
 *
 * - Nhận `children` là hỗn hợp string / number / ReactNode linh hoạt.
 * - `normalizedChildren` thực hiện:
 *    1. Chuyển children thành mảng bằng `React.Children.toArray`.
 *    2. Lọc bỏ các giá trị null / undefined.
 *    3. Lọc bỏ các chuỗi chỉ chứa khoảng trắng.
 *    4. Với string / number → bọc trong `<Text>` với style inlineText.
 *       Với ReactNode khác → giữ nguyên.
 * - Kết quả: các phần tử được render theo chiều ngang trong một View dạng pill.
 *
 * @param props – Xem interface InfoPillProps.
 * @returns Một View dạng pill chứa các thành phần con đã được chuẩn hoá.
 */
export default function InfoPill({ children, style }: InfoPillProps) {
  // Biến `normalizedChildren`: Xử lý children để đảm bảo tất cả đều render được.
  const normalizedChildren = React.Children.toArray(children) // Chuyển children → mảng
    .filter((child) => child != null)                         // Bỏ null / undefined
    .filter(                                                   // Bỏ chuỗi rỗng hoặc chỉ whitespace
      (child) =>
        !(typeof child === "string" && child.trim().length === 0)
    )
    .map((child, index) =>                                     // Bọc string/number trong <Text>
      typeof child === "string" || typeof child === "number" ? (
        <Text key={`pill-text-${index}`} style={styles.inlineText}>
          {child}
        </Text>
      ) : (
        child                                                 // Giữ nguyên fragment, icon, v.v.
      )
    );

  return <View style={[styles.pill, style]}>{normalizedChildren}</View>;
}

/**
 * StyleSheet định nghĩa giao diện cho InfoPill.
 *
 * pill:
 *   - flexDirection: row – sắp xếp ngang
 *   - alignItems / justifyContent: center – căn giữa cả hai chiều
 *   - minHeight: 50 – đảm bảo chiều cao tối thiểu
 *   - borderRadius: RADIUS.chip (999) – bo tròn hoàn toàn (dạng viên thuốc)
 *   - backgroundColor: SURFACE, borderWidth 1px BORDER
 *   - paddingHorizontal: 16, gap: 8px giữa các phần tử con
 *
 * inlineText:
 *   - Màu TEXT_PRIMARY, fontSize 13, fontWeight 600
 *   - Dành cho các đoạn text đơn giản bên trong pill
 */
const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 16,
    gap: 8,
  },
  inlineText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
});