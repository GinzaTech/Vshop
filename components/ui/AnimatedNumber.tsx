import React from "react";
import { Text, TextStyle } from "react-native";
import Animated, {
  FadeIn,
  ReduceMotion,
} from "react-native-reanimated";

type AnimatedNumberProps = {
  value: number;
  style?: TextStyle;
};

export default function AnimatedNumber({ value, style }: AnimatedNumberProps) {
  return (
    <Animated.View
      key={value}
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
    >
      <Text style={style}>{value.toLocaleString()}</Text>
    </Animated.View>
  );
}
