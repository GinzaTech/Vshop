// ====== GlassCard – Thẻ kính với hiệu ứng mờ (blur) dạng glassmorphism ======
// Hiển thị một khối nội dung có nền trong suốt kết hợp hiệu ứng làm mờ phía sau,
// tạo cảm giác "kính mờ" giống giao diện Valorant / hiện đại.

import { MotiView } from "moti";
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";

/**
 * Định nghĩa props cho component GlassCard.
 *
 * @extends ViewProps – Kế thừa tất cả props mặc định của View React Native.
 *
 * @param style – (tuỳ chọn) Style ghi đè lên khung ngoài của thẻ.
 * @param contentStyle – (tuỳ chọn) Style ghi đè lên vùng chứa nội dung bên trong.
 * @param children – Nội dung ReactNode được render bên trong thẻ.
 * @param intensity – (mặc định 18) Mức độ làm mờ của BlurView (0–100).
 * @param tint    – (mặc định "light") Màu sắc của hiệu ứng mờ: "light" | "dark" | "default".
 */
interface GlassCardProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    intensity?: number;
    tint?: "light" | "dark" | "default";
    animated?: boolean;
}

/**
 * GlassCard Component
 *
 * - Bọc nội dung bên trong một `View` (container) và một `BlurView` trải đều toàn bộ.
 * - `BlurView` tạo hiệu ứng kính mờ với intensity và tint do người dùng chỉ định.
 * - `contentStyle` cho phép tuỳ chỉnh padding / layout riêng của phần nội dung.
 *
 * @param props – Xem interface GlassCardProps ở trên.
 * @returns Một View chứa BlurView + nội dung con.
 */
export default function GlassCard({
    style,
    contentStyle,
    children,
    intensity = 18,
    tint = "light",
    animated = false,
    ...props
}: GlassCardProps) {
    if (animated) {
        return (
            <MotiView
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 120 }}
                style={[styles.container, style]}
                {...props}
            >
                <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
                <View style={[styles.content, contentStyle]}>{children}</View>
            </MotiView>
        );
    }
    return (
        <View style={[styles.container, style]} {...props}>
            <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
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
 *   - Kế thừa GLOBAL_STYLES.shadow – đổ bóng (dùng boxShadow trên web, shadow RN trên mobile)
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
        ...GLOBAL_STYLES.shadow,
        flexShrink: 1,
    },
    content: {
        padding: 16,
        flexShrink: 1,
    },
});