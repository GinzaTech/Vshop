// Shared optical glass with the original View/content/entrance contract.
// Repeated cards use static frost and specular light, without native blur.

import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from "react-native";
import Animated, {
    FadeInDown,
    ReduceMotion,
} from "react-native-reanimated";
import { COLORS, GLASS_MATERIAL, RADIUS } from "~/constants/DesignSystem";
import { LIQUID_GLASS_CARD_STYLE, LiquidGlassDecoration } from "./LiquidGlassSurface";
import { MOTION_DURATION } from "~/constants/Motion";

// CARD_ENTRANCE: Animation entrance FadeInDown dùng khi animated=true;
// tuân theo Reduce Motion của hệ thống (ReduceMotion.System)
const CARD_ENTRANCE = FadeInDown.duration(MOTION_DURATION.standard).reduceMotion(ReduceMotion.System);

/**
 * Định nghĩa props cho component GlassCard.
 *
 * @extends ViewProps – Kế thừa tất cả props mặc định của View React Native.
 *
 * @param style – (tuỳ chọn) Style ghi đè lên khung ngoài của thẻ.
 * @param contentStyle – (tuỳ chọn) Style ghi đè lên vùng chứa nội dung bên trong.
 * @param children – Nội dung ReactNode được render bên trong thẻ.
 * @param animated – (mặc định false) Nếu true, card xuất hiện với animation
 *                    FadeInDown (tôn trọng Reduce Motion).
 */
interface GlassCardProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    animated?: boolean;
}

/**
 * GlassCard Component
 *
 * - Bọc nội dung trong surface có border và shadow cấp `xs`.
 * - `contentStyle` cho phép tuỳ chỉnh padding / layout riêng của phần nội dung.
 * - `animated` = true thì render bằng Animated.View với CARD_ENTRANCE,
 *   ngược lại render View tĩnh (tránh chi phí animation không cần thiết).
 *
 * @param props – Xem interface GlassCardProps ở trên.
 * @returns Một optical surface chứa nội dung con.
 */
export default function GlassCard({
    style,
    contentStyle,
    children,
    animated = false,
    ...props
}: GlassCardProps) {
    const outer = StyleSheet.flatten(style);
    const inner = StyleSheet.flatten(contentStyle);
    const tone = outer?.backgroundColor === COLORS.ACCENT_DEEP ||
        outer?.backgroundColor === COLORS.PURE_BLACK ||
        outer?.backgroundColor === COLORS.VALORANT_DARK_BLUE ? "dark" : "light";
    const isLegacyLight = (color: ViewStyle["backgroundColor"]) =>
        color === COLORS.SURFACE || color === COLORS.BACKGROUND || color === COLORS.SURFACE_MUTED;
    const surfaceStyle = [styles.container, style,
        isLegacyLight(outer?.backgroundColor) && { backgroundColor: GLASS_MATERIAL.surface }];
    const childrenContent = <>
        <LiquidGlassDecoration radius={typeof outer?.borderRadius === "number" ? outer.borderRadius : RADIUS.card} tone={tone} />
        <View style={[styles.content, contentStyle,
            isLegacyLight(inner?.backgroundColor) && { backgroundColor: GLASS_MATERIAL.clear }]}>{children}</View>
    </>;
    if (animated) {
        return (
            <Animated.View
                entering={CARD_ENTRANCE}
                style={surfaceStyle}
                {...props}
            >
                {childrenContent}
            </Animated.View>
        );
    }
    return (
        <View style={surfaceStyle} {...props}>
            {childrenContent}
        </View>
    );
}

/**
 * StyleSheet định nghĩa giao diện cho GlassCard.
 *
 * container:
 *   - Material, viền và shadow lấy từ primitive kính dùng chung
 *   - borderRadius = RADIUS.card
 *   - Dùng shadow cấp `xs` để tránh quầng xám quanh card
 *   - flexShrink: 1 – cho phép co lại khi không đủ không gian
 *
 * content:
 *   - padding 16px tạo khoảng cách giữa nội dung và viền
 *   - flexShrink: 1 – co lại khi cần
 */
const styles = StyleSheet.create({
    container: {
        ...LIQUID_GLASS_CARD_STYLE,
        overflow: "hidden",
        borderRadius: RADIUS.card,
        flexShrink: 1,
    },
    content: {
        padding: 16,
        flexShrink: 1,
    },
});
