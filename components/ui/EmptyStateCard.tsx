// ====== EmptyStateCard – Thẻ hiển thị trạng thái rỗng (danh sách trống, chưa có dữ liệu) ======
// Dùng để thông báo cho người dùng biết rằng không có dữ liệu nào được tìm thấy,
// kèm theo tiêu đề, mô tả phụ và biểu tượng tuỳ chọn.

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
 * Định nghĩa props cho EmptyStateCard.
 *
 * @param title    – Tiêu đề chính, bắt buộc (vd: "Chưa có món hàng nào").
 * @param subtitle – (tuỳ chọn) Dòng mô tả phụ bên dưới tiêu đề.
 * @param icon     – (tuỳ chọn) ReactNode dùng làm biểu tượng (icon, hình ảnh…).
 * @param centered – (mặc định false) Nếu true → layout chiếm toàn màn hình và căn giữa,
 *                  nếu false → layout dạng inline như một thẻ nhỏ.
 * @param style    – (tuỳ chọn) Style ghi đè khung ngoài.
 */
interface EmptyStateCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyStateCard Component
 *
 * - Khi `centered = false`: hiển thị thẻ có viền, nền SURFACE, bo góc 28px (dạng inline).
 * - Khi `centered = true`: chiếm toàn bộ không gian (flex: 1), căn giữa cả chiều dọc và ngang,
 *   nền dùng BACKGROUND thay vì SURFACE.
 * - Nếu có `icon`, icon được đặt trong một badge (hình tròn nhờ borderRadius = RADIUS.chip = 999).
 *
 * @param props – Xem interface EmptyStateCardProps.
 * @returns Một View chứa icon (nếu có), title, subtitle (nếu có).
 */
export default function EmptyStateCard({
  title,
  subtitle,
  icon,
  centered = false, // Mặc định là inline
  style,
}: EmptyStateCardProps) {
  return (
    // Chọn container dựa trên prop centered
    <View style={[centered ? styles.centeredContainer : styles.inlineContainer, style]}>
      {/* Nếu có icon, render trong iconBadge (hình tròn) */}
      {icon ? <View style={styles.iconBadge}>{icon}</View> : null}
      {/* Tiêu đề chính */}
      <Text style={styles.title}>{title}</Text>
      {/* Subtitle – chỉ render khi có giá trị */}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * StyleSheet định nghĩa giao diện cho EmptyStateCard.
 *
 * inlineContainer:
 *   - Thẻ nhỏ gọn, padding 24px, bo góc 28px, nền SURFACE, viền 1px BORDER.
 *   - Phù hợp để đặt trong danh sách hoặc section.
 *
 * centeredContainer:
 *   - Chiếm toàn bộ không gian (flex: 1), căn giữa nội dung.
 *   - Nền BACKGROUND (xám nhạt) thay vì SURFACE, padding 28px.
 *   - Phù hợp làm màn hình trống toàn trang.
 *
 * iconBadge:
 *   - Hình tròn (76x76, borderRadius chip = 999), nền SURFACE, viền 1px.
 *   - marginBottom 18px để tách biệt với tiêu đề.
 *
 * title:
 *   - Font 20px, bold 700, màu TEXT_PRIMARY, căn giữa.
 *
 * subtitle:
 *   - MarginTop 8px, căn giữa, màu TEXT_SECONDARY (xám).
 */
const styles = StyleSheet.create({
  inlineContainer: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: COLORS.BACKGROUND,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
});