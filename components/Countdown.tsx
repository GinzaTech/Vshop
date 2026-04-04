import { StyleProp, TextStyle, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { COLORS } from "~/constants/DesignSystem";

interface props {
  timestamp: number;
  color?: string;
  compact?: boolean;
  showIcon?: boolean;
  iconSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function formatCountdown(
  timestamp: number,
  now = new Date().getTime(),
  compact = false
) {
  const diff = Math.max(0, timestamp - now);
  const days = Math.floor(diff / 1000 / 60 / 60 / 24);
  const hours = Math.floor(
    (diff - days * 1000 * 60 * 60 * 24) / 1000 / 60 / 60
  );
  const minutes = Math.floor(
    (diff - days * 1000 * 60 * 60 * 24 - hours * 1000 * 60 * 60) / 1000 / 60
  );
  const seconds = Math.floor(
    (diff -
      days * 1000 * 60 * 60 * 24 -
      hours * 1000 * 60 * 60 -
      minutes * 1000 * 60) /
      1000
  );

  if (compact && days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`;
  }

  return days > 0
    ? `${days}:${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function Countdown({
  timestamp,
  color = COLORS.TEXT_PRIMARY,
  compact = false,
  showIcon = true,
  iconSize = 15,
  containerStyle,
  textStyle,
}: props) {
  const [diff, setDiff] = useState(Math.max(0, timestamp - new Date().getTime()));

  useEffect(() => {
    setDiff(Math.max(0, timestamp - new Date().getTime()));

    const interval = setInterval(() => {
      setDiff(Math.max(0, timestamp - new Date().getTime()));
    }, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <View
      style={[
        {
        flexDirection: "row",
        alignItems: "center",
        },
        containerStyle,
      ]}
    >
      {showIcon ? (
        <Icon
          name="timer"
          size={iconSize}
          color={color}
          style={{ marginRight: 3 }}
        />
      ) : null}
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
