// ====== TwoColumnGrid – Lưới hai cột linh hoạt ======
// Sắp xếp một mảng items thành các hàng 2 cột, mỗi hàng có 2 item
// (hàng cuối có thể chỉ có 1 item + spacer để giữ bố cục).

import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

/**
 * Định nghĩa props generic cho TwoColumnGrid.
 *
 * @template T – Kiểu dữ liệu của mỗi item trong danh sách.
 *
 * @param items        – Mảng các item cần hiển thị.
 * @param renderItem   – Hàm render một item, nhận (item, index) → ReactNode.
 * @param keyExtractor – Hàm sinh key duy nhất cho mỗi item, nhận (item, index) → string.
 * @param rowStyle     – (tuỳ chọn) Style ghi đè cho mỗi hàng (row).
 * @param spacerStyle  – (tuỳ chọn) Style ghi đè cho spacer (khi hàng lẻ chỉ có 1 item).
 */
interface TwoColumnGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  rowStyle?: StyleProp<ViewStyle>;
  spacerStyle?: StyleProp<ViewStyle>;
}

/**
 * buildTwoColumnRows – Hàm tiện ích chia mảng items thành các hàng 2 cột.
 *
 * @param items – Mảng các phần tử bất kỳ.
 * @returns Mảng các hàng, mỗi hàng là một mảng con có tối đa 2 phần tử.
 *
 * Ví dụ: [A, B, C, D, E] → [[A, B], [C, D], [E]]
 */
export const buildTwoColumnRows = <T,>(items: T[]) => {
  const rows: T[][] = [];

  // Duyệt từng bước 2, slice từng cặp
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }

  return rows;
};

/**
 * TwoColumnGrid Component
 *
 * - Nhận mảng items và tự động chia thành các hàng 2 cột.
 * - Sử dụng `useMemo` để ghi nhớ kết quả `buildTwoColumnRows`, tránh tính toán lại
 *   trừ khi mảng `items` thay đổi.
 * - Mỗi hàng được render trong một View với flexDirection: row.
 * - Nếu hàng cuối chỉ có 1 item, thêm một View spacer (flex: 1) để giữ bố cục.
 *
 * @param props – Xem interface TwoColumnGridProps.
 * @returns Một danh sách các hàng (View), mỗi hàng chứa các item đã render.
 */
export default function TwoColumnGrid<T>({
  items,
  renderItem,
  keyExtractor,
  rowStyle,
  spacerStyle,
}: TwoColumnGridProps<T>) {
  // === useMemo ===
  // `rows`: Kết quả chia items thành các hàng 2 cột.
  // Được memoize lại, chỉ tính lại khi items thay đổi.
  const rows = React.useMemo(() => buildTwoColumnRows(items), [items]);

  return (
    <>
      {rows.map((row, rowIndex) => (
        // Mỗi hàng là một View row
        <View key={`row-${rowIndex}`} style={[styles.row, rowStyle]}>
          {row.map((item, itemIndex) => (
            // Mỗi item được render thông qua renderItem
            <React.Fragment key={keyExtractor(item, rowIndex * 2 + itemIndex)}>
              {renderItem(item, rowIndex * 2 + itemIndex)}
            </React.Fragment>
          ))}
          {/* Nếu hàng chỉ có 1 item, thêm spacer để giữ 2 cột đều nhau */}
          {row.length === 1 ? <View style={[styles.spacer, spacerStyle]} /> : null}
        </View>
      ))}
    </>
  );
}

/**
 * StyleSheet định nghĩa giao diện cho TwoColumnGrid.
 *
 * row:
 *   - flexDirection: row – sắp xếp các item theo chiều ngang
 *   - gap: 12px – khoảng cách giữa 2 item trong cùng hàng
 *   - marginBottom: 12px – khoảng cách giữa các hàng
 *
 * spacer:
 *   - flex: 1 – chiếm không gian tương đương với một item để bố cục không bị lệch
 *     khi hàng cuối chỉ có 1 item
 */
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  spacer: {
    flex: 1,
  },
});