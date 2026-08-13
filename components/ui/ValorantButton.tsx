// ====== ValorantButton – Nút bấm phong cách Valorant ======
// Hỗ trợ 3 biến thể: primary (đen full), secondary (viền + nền xám), glass (mờ kính).
// Tích hợp haptic feedback và flow tracking.

import React from "react";
import { Pressable, Text, StyleSheet, View, StyleProp, ViewStyle, TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";                       // Thư viện rung haptic (cảm ứng vật lý)
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { MOTION_SPRING } from "~/constants/Motion";
import { BlurView } from "expo-blur";                           // Hiệu ứng mờ glassmorphism
import { flowTracer } from "~/utils/flow-tracer";              // Công cụ theo dõi luồng sự kiện

/**
 * Định nghĩa props cho ValorantButton.
 *
 * @param title     – Chữ hiển thị trên nút.
 * @param onPress   – Hàm callback khi người dùng nhấn nút.
 * @param variant   – (mặc định "primary") "primary" | "secondary" | "glass".
 *                     - primary: nền đen, chữ trắng.
 *                     - secondary: nền SURFACE_MUTED, viền BORDER.
 *                     - glass: nền trong suốt với BlurView mờ.
 * @param style     – (tuỳ chọn) Style ghi đè khung ngoài (TouchableOpacity).
 * @param textStyle – (tuỳ chọn) Style ghi đè chữ.
 * @param icon      – (tuỳ chọn) ReactNode hiển thị bên trái chữ.
 */
interface ValorantButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "glass";
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    icon?: React.ReactNode;
}

/**
 * ValorantButton Component
 *
 * - Xử lý 3 biến thể với màu nền và viền khác nhau.
 * - Khi variant = "glass", bọc nội dung trong BlurView với độ mờ 20, tint dark.
 * - `handlePress`: track sự kiện qua flowTracer + kích hoạt haptic Light trước khi gọi onPress.
 * - `isGlass` là biến flag kiểm tra variant glass.
 *
 * @param props – Xem interface ValorantButtonProps.
 * @returns TouchableOpacity chứa nội dung nút (có thể bọc BlurView nếu glass).
 */
export default function ValorantButton({
    title,
    onPress,
    variant = "primary", // Mặc định là primary
    style,
    textStyle,
    icon,
}: ValorantButtonProps) {
    /**
     * handlePress – Xử lý sự kiện nhấn nút.
     * 1. Track sự kiện UI_EVENT qua flowTracer (tên nút, biến thể, source file).
     * 2. Rung haptic nhẹ (ImpactFeedbackStyle.Light).
     * 3. Gọi hàm onPress do người dùng truyền vào.
     */
    const handlePress = () => {
        flowTracer.track({
            type: "UI_EVENT",
            label: `Button pressed: ${title}`,
            source: {
                file: "components/ui/ValorantButton.tsx",
                componentName: "ValorantButton",
                functionName: "handlePress",
            },
            input: {
                title,
                variant,
            },
            tool: "Manual",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    // === Biến trạng thái (tính từ props) ===
    // `isGlass`: boolean – xác định có dùng BlurView hay không.
    const isGlass = variant === "glass";

    // `backgroundColor`: màu nền theo variant.
    //   primary  → COLORS.PURE_BLACK (đen)
    //   secondary → COLORS.SURFACE_MUTED (xám nhạt)
    //   glass    → "transparent" (trong suốt – BlurView sẽ đè lên)
    const backgroundColor =
        variant === "primary"
            ? COLORS.PURE_BLACK
            : variant === "secondary"
                ? COLORS.SURFACE_MUTED
                : "transparent";

    // `borderColor`: viền chỉ áp dụng cho secondary (COLORS.BORDER).
    const borderColor =
        variant === "secondary" ? COLORS.BORDER : "transparent";

    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // === Content (thành phần nội dung bên trong nút) ===
    const Content = (
        <View style={[styles.contentContainer, { backgroundColor: isGlass ? "rgba(255,70,85, 0.1)" : backgroundColor, borderColor, borderWidth: variant === "secondary" ? 1 : 0 }]}>
            {/* Icon bên trái (nếu có) */}
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            {/* Chữ trên nút – màu phụ thuộc variant */}
            <Text
                style={[
                    styles.text,
                    {
                        color:
                            variant === "primary"
                                ? COLORS.PURE_WHITE       // primary → chữ trắng
                                : variant === "secondary"
                                    ? COLORS.TEXT_PRIMARY   // secondary → chữ đen
                                    : COLORS.PURE_BLACK,    // glass → chữ đen
                    },
                    textStyle,
                ]}
            >
                {title}
            </Text>
        </View>
    );

    return (
        <Animated.View style={animatedStyle}>
            <Pressable
                onPress={handlePress}
                onPressIn={() => {
                    scale.value = withSpring(0.96, MOTION_SPRING.press);
                }}
                onPressOut={() => {
                    scale.value = withSpring(1, MOTION_SPRING.settle);
                }}
                style={[styles.container, style]}
            >
                {isGlass ? (
                    <BlurView intensity={20} tint="dark" style={styles.blur}>
                        {Content}
                    </BlurView>
                ) : (
                    Content
                )}
            </Pressable>
        </Animated.View>
    );
}

/**
 * StyleSheet định nghĩa giao diện cho ValorantButton.
 *
 * container:
 *   - overflow: hidden – đảm bảo bo góc không bị tràn
 *   - borderRadius: RADIUS.button (22)
 *
 * blur:
 *   - borderRadius: RADIUS.button – giữ bo góc cho BlurView
 *
 * contentContainer:
 *   - paddingVertical 14, paddingHorizontal 20
 *   - alignItems + justifyContent: center, flexDirection: row
 *   - borderRadius: RADIUS.button
 *
 * text:
 *   - fontWeight 700, fontSize 14
 *
 * iconContainer:
 *   - marginRight: 8px – tách icon khỏi chữ
 */
const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
        borderRadius: RADIUS.button,
    },
    blur: {
        borderRadius: RADIUS.button,
    },
    contentContainer: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        borderRadius: RADIUS.button,
    },
    text: {
        fontWeight: "700",
        fontSize: 14,
    },
    iconContainer: {
        marginRight: 8,
    },
});
