// ====== GlassCard – Shared tonal surface ======
// Tên component được giữ để tương thích; nền dùng surface tĩnh thay vì blur
// nhằm giảm overdraw và giữ độ tương phản ổn định trên Android.

import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from "react-native";
import Animated, {
    FadeInDown,
    ReduceMotion,
} from "react-native-reanimated";
import { GLOBAL_STYLES, RADIUS, SHADOWS } from "~/constants/DesignSystem";

/**
 * Định nghĩa props cho component GlassCard.
 *
 * @extends ViewProps – Kế thừa tất cả props mặc định của View React Native.
 *
 * @param style – (tuỳ chọn) Style ghi đè lên khung ngoài của thẻ.
 * @param contentStyle – (tuỳ chọn) Style ghi đè lên vùng chứa nội dung bên trong.
 * @param children – Nội dung ReactNode được render bên trong thẻ.
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
 *
 * @param props – Xem interface GlassCardProps ở trên.
 * @returns Một tonal surface chứa nội dung con.
 */
export default function GlassCard({
    style,
    contentStyle,
    children,
    animated = false,
    ...props
}: GlassCardProps) {
    if (animated) {
        return (
            <Animated.View
                entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}
                style={[styles.container, style]}
                {...props}
            >
                <View style={[styles.content, contentStyle]}>{children}</View>
            </Animated.View>
        );
    }
    return (
        <View style={[styles.container, style]} {...props}>
            <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
    );
}

/**
 * StyleSheet định nghĩa giao diện cho GlassCard.
 *
 * container:
 *   - Kế thừa GLOBAL_STYLES.glassContainer (nền trắng, viền, overflow hidden)
 *   - borderRadius = RADIUS.card (24) – bo góc mềm mại
 *   - Dùng shadow cấp `xs` để tránh quầng xám quanh card
 *   - flexShrink: 1 – cho phép co lại khi không đủ không gian
 *
 * content:
 *   - padding 16px tạo khoảng cách giữa nội dung và viền
 *   - flexShrink: 1 – co lại khi cần
 */
const styles = StyleSheet.create({
    container: {
        ...GLOBAL_STYLES.glassContainer,
        borderRadius: RADIUS.card,
        ...SHADOWS.xs,
        flexShrink: 1,
    },
    content: {
        padding: 16,
        flexShrink: 1,
    },
});
