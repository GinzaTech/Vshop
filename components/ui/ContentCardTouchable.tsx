import React from "react";
import { StyleSheet, TouchableOpacity, View, type TouchableOpacityProps } from "react-native";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";

/** Content-only feedback: native touch semantics, no media/text fading or scaling. */
const ContentCardTouchable = React.forwardRef<React.ElementRef<typeof TouchableOpacity>, TouchableOpacityProps>(
  function ContentCardTouchable({ children, style, disabled, onPress, onLongPress, onPressIn, onPressOut, ...props }, ref) {
    const [pressed, setPressed] = React.useState(false);
    React.useEffect(() => { if (disabled) setPressed(false); }, [disabled]);
    const outer = StyleSheet.flatten(style);
    const radius = typeof outer?.borderRadius === "number" ? outer.borderRadius : RADIUS.card;
    return (
      <TouchableOpacity {...props} ref={ref} style={style} disabled={disabled} activeOpacity={1}
        onPress={onPress ? event => { setPressed(false); if (!disabled) return onPress(event); } : undefined}
        onLongPress={onLongPress ? event => { setPressed(false); if (!disabled) return onLongPress(event); } : undefined}
        onPressIn={event => {
          if (disabled) return;
          setPressed(true);
          onPressIn?.(event);
        }}
        onPressOut={event => {
          setPressed(false);
          onPressOut?.(event);
        }}>
        {children}
        <View testID="content-card-press-outline" pointerEvents="none" accessible={false}
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.outline, { borderRadius: Math.max(0, radius - SPACING.xxs), opacity: pressed && !disabled ? 1 : 0 }]} />
      </TouchableOpacity>
    );
  },
);

const styles = StyleSheet.create({
  outline: { ...StyleSheet.absoluteFill, margin: SPACING.xxs, borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.BORDER_STRONG },
});

export default ContentCardTouchable;
