import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, GLOBAL_STYLES } from "~/constants/DesignSystem";

interface GlassCardProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    intensity?: number;
    tint?: "light" | "dark" | "default";
}

export default function GlassCard({
    style,
    children,
    intensity = 20,
    tint = "dark",
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
        borderRadius: 16,
        ...GLOBAL_STYLES.shadow,
        // Ensure the container can grow
        flexShrink: 1,
    },
    content: {
        padding: 16,
        // Content determines the size
    },
});
