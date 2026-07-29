import React from "react";
import { StyleProp, TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type TypewriterPhase = "idle" | "deleting" | "typing";

type TypewriterSwapTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  typingSpeed?: number;
  deletingSpeed?: number;
  initialDelay?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
};

/**
 * React Native equivalent of a type/delete text transition.
 * When `text` changes, the current value is erased from right to left before
 * the next value is typed from left to right.
 */
function TypewriterSwapText({
  text,
  style,
  typingSpeed = 42,
  deletingSpeed = 24,
  initialDelay = 70,
  showCursor = true,
  cursorCharacter = "|",
  cursorBlinkDuration = 360,
}: TypewriterSwapTextProps) {
  const [displayedText, setDisplayedText] = React.useState(text);
  const [phase, setPhase] = React.useState<TypewriterPhase>("idle");
  const targetTextRef = React.useRef(text);
  const previousTextRef = React.useRef(text);
  const cursorOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (previousTextRef.current === text) return;

    previousTextRef.current = text;
    targetTextRef.current = text;
    setPhase("deleting");
  }, [text]);

  React.useEffect(() => {
    if (phase === "idle") return;

    let timer: ReturnType<typeof setTimeout>;

    if (phase === "deleting") {
      if (displayedText.length === 0) {
        timer = setTimeout(() => setPhase("typing"), initialDelay);
      } else {
        timer = setTimeout(() => {
          setDisplayedText((currentText) => currentText.slice(0, -1));
        }, deletingSpeed);
      }
    } else {
      const targetText = targetTextRef.current;
      if (displayedText.length >= targetText.length) {
        setPhase("idle");
        return;
      }

      timer = setTimeout(() => {
        setDisplayedText((currentText) => {
          const currentTarget = targetTextRef.current;
          return currentText + currentTarget.charAt(currentText.length);
        });
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [deletingSpeed, displayedText, initialDelay, phase, typingSpeed]);

  React.useEffect(() => {
    cursorOpacity.value = 1;
    cursorOpacity.value = withRepeat(
      withTiming(0, { duration: cursorBlinkDuration }),
      -1,
      true
    );

    return () => cancelAnimation(cursorOpacity);
  }, [cursorBlinkDuration, cursorOpacity]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));
  const cursorVisible = showCursor && phase !== "idle";

  return (
    <Animated.Text
      accessible={false}
      numberOfLines={1}
      style={style}
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
