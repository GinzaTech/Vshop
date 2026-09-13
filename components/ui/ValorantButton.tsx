// ====== ValorantButton – Nút bấm phong cách Valorant ======
// Hỗ trợ 3 biến thể: primary, secondary và glass dạng tonal surface.
// Tích hợp haptic feedback và flow tracking.

import React from "react";
import { ActivityIndicator, Pressable, Text, StyleSheet, View, StyleProp, ViewStyle, TextStyle } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import * as Haptics from "expo-haptics";                       // Thư viện rung haptic (cảm ứng vật lý)
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { MOTION_SPRING } from "~/constants/Motion";
import { flowTracer } from "~/utils/flow-tracer";              // Công cụ theo dõi luồng sự kiện

/**
 * Định nghĩa props cho ValorantButton.
 *
 * @param title     – Chữ hiển thị trên nút.
 * @param onPress   – Hàm callback khi người dùng nhấn nút.
 * @param variant   – (mặc định "primary") "primary" | "secondary" | "glass".
 *                     - primary: nền đen, chữ trắng.
 *                     - secondary: nền SURFACE_MUTED, viền BORDER.
 *                     - glass: nền tonal bán trong suốt.
 * @param style     – (tuỳ chọn) Style ghi đè khung ngoài (TouchableOpacity).
 * @param textStyle – (tuỳ chọn) Style ghi đè chữ.
 * @param icon      – (tuỳ chọn) ReactNode hiển thị bên trái chữ.
 * @param disabled  – (mặc định false) Khoá nút (opacity 0.5, không nhấn được).
 * @param loading   – (mặc định false) Trạng thái loading: thay icon bằng
 *                    ActivityIndicator, khoá nút và chặn onDismiss behaviour.
 */
interface ValorantButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "glass";
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    icon?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
}

/**
 * ValorantButton Component
 *
 * - Xử lý 3 biến thể với màu nền và viền khác nhau.
 * - Variant "glass" dùng tonal surface để tránh blur/overdraw trên Android.
 * - `handlePress`: track sự kiện qua flowTracer + kích hoạt haptic Light trước khi gọi onPress.
 * - `isGlass` là biến flag kiểm tra variant glass.
 *
 * @param props – Xem interface ValorantButtonProps.
 * @returns Nút có phản hồi scale/haptic thống nhất.
 */
export default function ValorantButton({
    title,
    onPress,
    variant = "primary", // Mặc định là primary
    style,
    textStyle,
    icon,
    disabled = false,
    loading = false,
}: ValorantButtonProps) {
    // reduceMotion: tôn trọng Reduce Motion của hệ điều hành
    const reduceMotion = useMotionPreference();
    // unavailable: nút không tương tác được khi disabled hoặc đang loading
    const unavailable = disabled || loading;
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
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
    };

    // === Biến trạng thái (tính từ props) ===
    // `isGlass`: boolean – xác định biến thể tonal glass.
    const isGlass = variant === "glass";

    // `backgroundColor`: màu nền theo variant.
    //   primary  → COLORS.PURE_BLACK (đen)
    //   secondary → COLORS.SURFACE_MUTED (xám nhạt)
    //   glass    → "transparent" (content dùng tonal surface riêng)
    const backgroundColor =
        variant === "primary"
            ? COLORS.PURE_BLACK
            : variant === "secondary"
                ? COLORS.SURFACE_MUTED
                : "transparent";

    // `borderColor`: viền chỉ áp dụng cho secondary (COLORS.BORDER).
    const borderColor =
        variant === "secondary" ? COLORS.BORDER : "transparent";

    // scale: shared value hiệu ứng nhấn giữ (thu 0.96 → nở về 1)
    const scale = useSharedValue(1);
    // Effect: khi nút bị khoá (disabled/loading) hoặc Reduce Motion bật,
    // đưa scale về 1; cleanup luôn hủy animation đang chạy.
    React.useEffect(() => {
        if (unavailable || reduceMotion) {
            cancelAnimation(scale);
            scale.value = 1;
        }
        return () => cancelAnimation(scale);
    }, [reduceMotion, scale, unavailable]);
    // animatedStyle: gắn scale vào transform của Animated.View bọc nội dung
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // === Content (thành phần nội dung bên trong nút) ===
    // glass → nền đỏ mờ rgba(255,70,85,0.1); secondary → viền 1px
    const Content = (
        <View style={[styles.contentContainer, { backgroundColor: isGlass ? "rgba(255,70,85, 0.1)" : backgroundColor, borderColor, borderWidth: variant === "secondary" ? 1 : 0 }]}>
            {/* Icon bên trái (nếu có) */}
            {(loading || icon) && <View style={styles.iconContainer}>{loading ? <ActivityIndicator color={variant === "primary" ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY} /> : icon}</View>}
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
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: unavailable, busy: loading }}
                disabled={unavailable}
                onPress={handlePress}
                onPressIn={() => {
                    scale.value = reduceMotion ? 1 : withSpring(0.96, MOTION_SPRING.press);
                }}
                onPressOut={() => {
                    scale.value = withSpring(1, MOTION_SPRING.settle);
                }}
                style={[styles.container, style, unavailable && { opacity: 0.5 }]}
            >
              <Animated.View style={animatedStyle}>
                {Content}
              </Animated.View>
            </Pressable>
    );
}

/**
 * StyleSheet định nghĩa giao diện cho ValorantButton.
 *
 * container:
 *   - overflow: hidden – đảm bảo bo góc không bị tràn
 *   - borderRadius: RADIUS.button (22)
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
