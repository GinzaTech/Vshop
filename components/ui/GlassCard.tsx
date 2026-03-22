import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";

interface GlassCardProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    intensity?: number;
    tint?: "light" | "dark" | "default";
}

export default function GlassCard({
    style,
    children,
    intensity = 18,
    tint = "light",
    ...props
}: GlassCardProps) {
    return (
        <View style={[styles.container, style]} {...props}>
            <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...GLOBAL_STYLES.glassContainer,
        borderRadius: RADIUS.card,
        ...GLOBAL_STYLES.shadow,
        flexShrink: 1,
    },
    content: {
        padding: 16,
    },
});
