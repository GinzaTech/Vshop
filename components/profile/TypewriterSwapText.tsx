// ===== TypewriterSwapText.tsx =====
// Text chuyển nội dung bằng một lần cập nhật React; fade/translate và con trỏ
// chạy trên UI thread để không tạo chuỗi render theo từng ký tự.
import React from "react";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";

type TypewriterSwapTextProps = {
  text: string;
  style?: React.ComponentProps<typeof Animated.Text>["style"];
  animate?: boolean;
  charactersPerStep?: number;
  typingSpeed?: number;
  deletingSpeed?: number;
  initialDelay?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
};

/**
 * Keeps the legacy call surface but replaces character-by-character JS work
 * with a single text swap and a short UI-thread reveal.
 */
function TypewriterSwapText({
  text,
  style,
  animate = true,
  typingSpeed = 42,
  deletingSpeed = 24,
  initialDelay = 70,
  showCursor = true,
  cursorCharacter = "|",
  cursorBlinkDuration = 360,
}: TypewriterSwapTextProps) {
  const [displayedText, setDisplayedText] = React.useState(text);
  const [transitioning, setTransitioning] = React.useState(false);
  const previousTextRef = React.useRef(text);
  const revealProgress = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);
  const reduceMotionEnabled = useReducedMotion();
  const revealDuration = Math.min(
    220,
    Math.max(120, typingSpeed * 2 + deletingSpeed * 2 + initialDelay / 2)
  );

  React.useEffect(() => {
    if (previousTextRef.current === text) return;

    previousTextRef.current = text;
    cancelAnimation(revealProgress);
    setDisplayedText(text);

    if (!animate || reduceMotionEnabled) {
      revealProgress.value = 1;
      setTransitioning(false);
      return;
    }

    revealProgress.value = 0;
    setTransitioning(true);
    revealProgress.value = withTiming(
      1,
      { duration: revealDuration },
      (finished) => {
        if (finished) scheduleOnRN(setTransitioning, false);
      }
    );

    return () => cancelAnimation(revealProgress);
  }, [animate, reduceMotionEnabled, revealDuration, revealProgress, text]);

  const cursorVisible = !reduceMotionEnabled && showCursor && transitioning;

  React.useEffect(() => {
    cancelAnimation(cursorOpacity);
    cursorOpacity.value = 1;

    if (cursorVisible) {
      cursorOpacity.value = withRepeat(
        withTiming(0, { duration: cursorBlinkDuration }),
        -1,
        true
      );
    }

    return () => cancelAnimation(cursorOpacity);
  }, [cursorBlinkDuration, cursorOpacity, cursorVisible]);

  const revealAnimatedStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [
      {
        translateY: interpolate(revealProgress.value, [0, 1], [3, 0]),
      },
    ],
  }));
  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Animated.Text
      accessible={false}
      numberOfLines={1}
      style={[style, revealAnimatedStyle]}
    >
      {displayedText}
      {cursorVisible ? (
        <Animated.Text style={cursorAnimatedStyle}>
          {"\u00A0"}
          {cursorCharacter}
        </Animated.Text>
      ) : null}
    </Animated.Text>
  );
}

export default React.memo(TypewriterSwapText);
