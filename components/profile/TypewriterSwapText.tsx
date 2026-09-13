// ===== TypewriterSwapText.tsx =====
// Text hiệu ứng "máy đánh chữ": khi prop text đổi, xoá dần chữ cũ rồi gõ
// dần chữ mới, kèm con trỏ nhấp nháy. Tôn trọng Reduce Motion (đổi tức thì).
import React from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";

// TypewriterPhase: 3 pha của hiệu ứng - idle (xong), deleting (xoá), typing (gõ)
type TypewriterPhase = "idle" | "deleting" | "typing";

/**
 * TypewriterSwapTextProps – Props của TypewriterSwapText.
 *
 * @param text – Nội dung chữ đích; đổi giá trị sẽ kích hoạt hiệu ứng xoá/gõ.
 * @param style – (tuỳ chọn) Style cho Animated.Text.
 * @param charactersPerStep – (mặc định 2) Số ký tự xoá/gõ mỗi bước.
 * @param typingSpeed – (mặc định 42ms) Độ trễ giữa các bước gõ.
 * @param deletingSpeed – (mặc định 24ms) Độ trễ giữa các bước xoá.
 * @param initialDelay – (mặc định 70ms) Trễ khi chữ đã xoá hết trước khi gõ.
 * @param showCursor – (mặc định true) Có hiển thị con trỏ nhấp nháy không.
 * @param cursorCharacter – (mặc định "|") Ký tự con trỏ.
 * @param cursorBlinkDuration – (mặc định 360ms) Chu kỳ nhấp nháy con trỏ.
 */
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
 * TypewriterSwapText – Text xoá dần chữ cũ trước khi gõ chữ mới (memo hoá).
 * Máy trạng thái: text đổi → "deleting" (xoá theo bước) → hết chữ → trễ
 * initialDelay → "typing" (gõ theo bước) → đủ độ dài → "idle".
 *
 * @param text – Chữ đích (xem TypewriterSwapTextProps).
 * @param style – Style text.
 * @param charactersPerStep – Số ký tự mỗi bước xoá/gõ.
 * @param typingSpeed – Độ trễ bước gõ (ms).
 * @param deletingSpeed – Độ trễ bước xoá (ms).
 * @param initialDelay – Trễ trước khi bắt đầu gõ (ms).
 * @param showCursor – Hiện con trỏ không.
 * @param cursorCharacter – Ký tự con trỏ.
 * @param cursorBlinkDuration – Chu kỳ nhấp nháy con trỏ (ms).
 * @returns Animated.Text hiển thị displayedText + con trỏ (nếu có).
 *
 * Side effects: setTimeout cho từng bước xoá/gõ (cleanup clearTimeout);
 * animation nhấp nháy con trỏ vớiRepeat (cleanup cancelAnimation).
 * Reduce Motion: bỏ hiệu ứng, hiển thị text đích ngay lập tức.
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
  // displayedText: chữ đang hiển thị; phase: pha hiện tại của hiệu ứng
  const [displayedText, setDisplayedText] = React.useState(text);
  const [phase, setPhase] = React.useState<TypewriterPhase>("idle");
  // targetTextRef/previousTextRef: chữ đích và chữ lần render trước (ref tránh
  // stale closure và so sánh thay đổi)
  const targetTextRef = React.useRef(text);
  const previousTextRef = React.useRef(text);
  // cursorOpacity: shared value opacity con trỏ (nhấp nháy)
  const cursorOpacity = useSharedValue(1);
  const reduceMotionEnabled = useReducedMotion();

  // Effect 1: text (hoặc Reduce Motion) đổi → bắt đầu pha "deleting";
  // Reduce Motion thì hiển thị text đích ngay và về idle.
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

  // Effect 2: máy trạng thái xoá/gõ bằng setTimeout cho từng bước;
  // cleanup: clearTimeout mỗi khi pha/displayedText đổi hoặc unmount.
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

  // cursorVisible: con trỏ chỉ hiện khi không Reduce Motion, được bật và
  // hiệu ứng đang chạy (không idle)
  const cursorVisible =
    !reduceMotionEnabled && showCursor && phase !== "idle";

  // Effect 3: nhấp nháy con trỏ bằng withRepeat yoyo;
  // cleanup: cancelAnimation khi unmount/dependency đổi.
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

  // cursorAnimatedStyle: gắn opacity con trỏ vào Animated.Text lồng nhau
  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    // accessible=false: đọc cả chuỗi, tránh tách con trỏ thành node riêng
    <Animated.Text accessible={false} numberOfLines={1} style={style}>
      {displayedText}
      {cursorVisible ? (
        // Con trỏ: nbsp + ký tự, opacity điều khiển bởi animation
        <Animated.Text style={cursorAnimatedStyle}>
          {"\u00A0"}
          {cursorCharacter}
        </Animated.Text>
      ) : null}
    </Animated.Text>
  );
}

export default React.memo(TypewriterSwapText);
