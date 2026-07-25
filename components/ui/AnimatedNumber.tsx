import React from "react";
import { Text, TextStyle } from "react-native";
import { MotiView } from "moti";

type AnimatedNumberProps = {
  value: number;
  style?: TextStyle;
};

export default function AnimatedNumber({ value, style }: AnimatedNumberProps) {
  return (
    <MotiView
      key={value}
      from={{ opacity: 0.4, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 18 }}
    >
      <Text style={style}>{value.toLocaleString()}</Text>
    </MotiView>
  );
}
