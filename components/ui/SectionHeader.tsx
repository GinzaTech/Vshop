// ====== SectionHeader – Tiêu đề cho một section / khu vực trong trang ======
// Dùng để phân cách các phần nội dung, hiển thị tên section
// và metadata tuỳ chọn (vd: số lượng, trạng thái…).

import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "~/constants/DesignSystem";

/**
 * Định nghĩa props cho SectionHeader.
 *
 * @param title – Tên của section, bắt buộc (vd: "Súng ngắn", "Vũ khí hạng nặng").
 * @param meta  – (tuỳ chọn) Thông tin phụ hiển thị bên phải (vd: "5 món").
 * @param style – (tuỳ chọn) Style ghi đè khung ngoài container.
 */
interface SectionHeaderProps {
  title: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * SectionHeader Component
 *
 * Layout: [title bên trái] | [meta bên phải]
 * - Dạng hàng ngang, space-between để đẩy meta sang phải.
 * - meta chỉ render khi có giá trị.
 *
 * @param props – Xem interface SectionHeaderProps.
 * @returns Một View hàng ngang chứa title và meta.
 */
export default function SectionHeader({
  title,
  meta,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Tiêu đề section */}
      <Text style={styles.title}>{title}</Text>
      {/* Metadata (chỉ hiển thị khi có giá trị) */}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

/**
 * StyleSheet định nghĩa giao diện cho SectionHeader.
 *
 * container:
 *   - flexDirection: row – title và meta nằm trên cùng một hàng
 *   - justifyContent: space-between – đẩy meta sang phải
 *   - alignItems: center – căn giữa theo chiều dọc
 *   - marginBottom: 12px – tạo khoảng cách với nội dung bên dưới
 *
 * title:
 *   - fontSize 20px, fontWeight 700, màu TEXT_PRIMARY
 *
 * meta:
 *   - fontSize 14px, màu TEXT_SECONDARY (xám nhạt)
 */
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  meta: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
});