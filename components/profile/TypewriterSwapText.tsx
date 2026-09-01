import React from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type TypewriterPhase = "idle" | "deleting" | "typing";

type TypewriterSwapTextProps = {
  text: string;
  style?: React.ComponentProps<typeof Animated.Text>["style"];
  charactersPerStep?: number;
  typingSpeed?: number;
  deletingSpeed?: number;
  initialDelay?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
};

/**
 * Erases the current text before typing the next value.
 */
function TypewriterSwapText({
  text,
  style,
  charactersPerStep = 2,
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
  const reduceMotionEnabled = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotionEnabled) {
      previousTextRef.current = text;
      targetTextRef.current = text;
      setDisplayedText(text);
      setPhase("idle");
      return;
    }

    if (previousTextRef.current === text) return;

    previousTextRef.current = text;
    targetTextRef.current = text;
    setPhase("deleting");
  }, [reduceMotionEnabled, text]);

  React.useEffect(() => {
    if (phase === "idle") return;

    let timer: ReturnType<typeof setTimeout>;

    if (phase === "deleting") {
      if (displayedText.length === 0) {
        timer = setTimeout(() => setPhase("typing"), initialDelay);
      } else {
        timer = setTimeout(() => {
          setDisplayedText((currentText) =>
            currentText.slice(0, -charactersPerStep)
          );
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
          return currentTarget.slice(
            0,
            currentText.length + charactersPerStep
          );
        });
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [
    charactersPerStep,
    deletingSpeed,
    displayedText,
    initialDelay,
    phase,
    typingSpeed,
  ]);

  const cursorVisible =
    !reduceMotionEnabled && showCursor && phase !== "idle";

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

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <Animated.Text accessible={false} numberOfLines={1} style={style}>
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
