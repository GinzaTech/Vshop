/**
 * LoadingScreen — Màn hình loading có animation khi app đang fetch data.
 * Hiển thị: logo + spinner + text trạng thái.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS } from "~/constants/DesignSystem";

type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      rotation.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(0, { duration: 800 }), -1, true);
    rotation.value = withRepeat(withTiming(360, { duration: 1200 }), -1);
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(rotation);
    };
  }, [pulse, reduceMotion, rotation]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 0.94 + pulse.value * 0.06 }],
  }));
  const spinnerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + pulse.value * 0.35,
  }));

  return (
    <View style={styles.container}>
      {/* Pulsing logo */}
      <Animated.View
        style={[styles.logoWrap, logoAnimatedStyle]}
      >
        <Icon name="shield-star-outline" size={48} color={COLORS.ACCENT} />
      </Animated.View>

      {/* Spinning ring */}
      <Animated.View
        style={[styles.spinnerRing, spinnerAnimatedStyle]}
      />

      {/* Loading text */}
      <Animated.View style={textAnimatedStyle}>
        <LoadingText text={message} />
      </Animated.View>
    </View>
  );
}

function LoadingText({ text }: { text: string }) {
  return <StyledText>{text}</StyledText>;
}

function StyledText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  spinnerRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.08)",
    borderTopColor: COLORS.ACCENT,
    top: "46%",
  },
  text: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 16,
  },
});
