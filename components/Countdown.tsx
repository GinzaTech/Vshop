// ===== Countdown.tsx =====
// Component hiển thị đồng hồ đếm ngược (countdown timer) từ một timestamp đến hiện tại.
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { COLORS } from "~/constants/DesignSystem";

// Interface định nghĩa props cho Countdown component
// timestamp: mốc thời gian đích (ms) để đếm ngược đến
// color: màu chữ, mặc định COLORS.TEXT_PRIMARY
// compact: chế độ hiển thị rút gọn (chỉ ngày + giờ) nếu true
// showIcon: có hiển thị icon đồng hồ hay không, mặc định true
// iconSize: kích thước icon, mặc định 15
// containerStyle: style tùy chỉnh cho container
// textStyle: style tùy chỉnh cho text
interface props {
  timestamp: number;
  color?: string;
  compact?: boolean;
  showIcon?: boolean;
  iconSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// formatCountdown: Hàm thuần túy tính toán và format thời gian đếm ngược
// timestamp: mốc thời gian đích (ms)
// now: thời gian hiện tại (ms), mặc định là Date.now()
// compact: nếu true và còn > 0 ngày, hiển thị dạng "Xd YYh" thay vì đầy đủ
// Trả về: chuỗi định dạng "d:hh:mm:ss" hoặc "hh:mm:ss" hoặc "Xd YYh" (compact)
export function formatCountdown(
  timestamp: number,
  now = new Date().getTime(),
  compact = false
) {
  // diff: khoảng cách thời gian còn lại (ms), không âm
  const diff = Math.max(0, timestamp - now);
  // days: số ngày còn lại
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);
  // hours: số giờ còn lại (sau khi trừ ngày)
  const hours = Math.floor(
    (diff - days * 1000 * 60 * 60 * 24) / 1000 / 60 / 60
  );
  // minutes: số phút còn lại (sau khi trừ ngày và giờ)
  const minutes = Math.floor(
    (diff - days * 1000 * 60 * 60 * 24 - hours * 1000 * 60 * 60) / 1000 / 60
  );
  // seconds: số giây còn lại (sau khi trừ ngày, giờ, phút)
  const seconds = Math.floor(
    (diff -
      days * 1000 * 60 * 60 * 24 -
      hours * 1000 * 60 * 60 -
      minutes * 1000 * 60) /
      1000
  );

  // Nếu ở chế độ compact và còn ngày, hiển thị "Xd YYh"
  if (compact && days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`;
  }

  // Nếu còn ngày: định dạng "d:hh:mm:ss"
  // Nếu không còn ngày: định dạng "hh:mm:ss"
  return days > 0
    ? `${days}:${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Countdown: Component chính, hiển thị đồng hồ đếm ngược tự động cập nhật mỗi giây
// Sử dụng state diff để lưu khoảng cách thời gian, và setInterval để cập nhật
export default function Countdown({
  timestamp,
  color = COLORS.TEXT_PRIMARY,
  compact = false,
  showIcon = true,
  iconSize = 15,
  containerStyle,
  textStyle,
}: props) {
  // diff: state lưu khoảng thời gian còn lại (ms), khởi tạo = max(0, timestamp - now)
  const [diff, setDiff] = useState(Math.max(0, timestamp - new Date().getTime()));

  // useEffect: Cập nhật diff ban đầu và thiết lập interval 1 giây để cập nhật
  // Dependencies: [timestamp] - chỉ chạy lại khi timestamp thay đổi
  // Cleanup: clearInterval khi component unmount hoặc timestamp thay đổi
  useEffect(() => {
    setDiff(Math.max(0, timestamp - new Date().getTime()));

    const interval = setInterval(() => {
      setDiff(Math.max(0, timestamp - new Date().getTime()));
    }, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    // Container: flex row, căn giữa theo chiều dọc
    <View
      style={[
        {
        flexDirection: "row",
        alignItems: "center",
        },
        containerStyle,
      ]}
    >
      {/* Icon đồng hồ, chỉ hiển thị nếu showIcon = true */}
      {showIcon ? (
        <Icon
          name="timer"
          size={iconSize}
          color={color}
          style={{ marginRight: 3 }}
        />
      ) : null}
      {/* Text hiển thị thời gian đếm ngược đã format */}
      <Text
        style={[
          {
            fontSize: compact ? 11 : 13,
            color,
          },
          textStyle,
        ]}
      >
        {formatCountdown(new Date().getTime() + diff, new Date().getTime(), compact)}
      </Text>
    </View>
  );
}
