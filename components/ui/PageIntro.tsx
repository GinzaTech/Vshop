// ====== PageIntro – Phần giới thiệu đầu trang (tiêu đề + mô tả + tuỳ chọn) ======
// Thường dùng ở đầu mỗi màn hình / section để hiển thị tiêu đề chính,
// mô tả phụ và một thành phần phụ (nút hành động, icon, v.v.) bên phải.

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
 * Định nghĩa props cho PageIntro.
 *
 * @param title        – Tiêu đề chính của trang, bắt buộc.
 * @param subtitle     – (tuỳ chọn) Mô tả phụ bên dưới tiêu đề.
 * @param accessory    – (tuỳ chọn) ReactNode hiển thị bên phải (nút, icon...).
 * @param style        – (tuỳ chọn) Style ghi đè khung ngoài container.
 * @param contentStyle – (tuỳ chọn) Style ghi đè vùng chứa title + subtitle.
 */
interface PageIntroProps {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * PageIntro Component
 *
 * Layout: [title + subtitle] (bên trái) | [accessory] (bên phải)
 * - `accessory` nằm ngoài content, được đặt bên phải nhờ flexDirection: row + justifyContent: space-between.
 * - `subtitle` chỉ hiển thị khi có giá trị.
 *
 * @param props – Xem interface PageIntroProps.
 * @returns Một View dạng hàng ngang chứa nội dung giới thiệu và accessory.
 */
export default function PageIntro({
  title,
  subtitle,
  accessory,
  style,
  contentStyle,
}: PageIntroProps) {
  return (
    // Container chính: dạng hàng ngang, căn giữa, space-between
    <View style={[styles.container, style]}>
      {/* Vùng bên trái: title + subtitle */}
      <View style={[styles.content, contentStyle]}>
        <Text style={styles.title}>{title}</Text>
        {/* Chỉ render subtitle khi có giá trị */}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {/* Vùng bên phải: accessory (nút, icon, v.v.) */}
      {accessory}
    </View>
  );
}

/**
 * StyleSheet định nghĩa giao diện cho PageIntro.
 *
 * container:
 *   - flexDirection: row – sắp xếp ngang (title + subtitle bên trái, accessory bên phải)
 *   - justifyContent: space-between – đẩy accessory sang mép phải
 *   - alignItems: center – căn giữa theo chiều dọc
 *   - gap: 16px – khoảng cách giữa content và accessory
 *
 * content:
 *   - flex: 1 – chiếm phần lớn không gian, để accessory co giãn tự nhiên
 *
 * title:
 *   - fontSize 28px, fontWeight 700, màu TEXT_PRIMARY – tiêu đề lớn, đậm
 *
 * subtitle:
 *   - marginTop 6px, fontSize 15px, lineHeight 22, màu TEXT_SECONDARY
 *   - Văn bản nhỏ hơn, màu xám nhạt hơn
 */
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
});