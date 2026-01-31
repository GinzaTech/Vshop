import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, StyleProp, ViewStyle, TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "~/constants/DesignSystem";
import { BlurView } from "expo-blur";

interface ValorantButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "glass";
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    icon?: React.ReactNode;
}

export default function ValorantButton({
    title,
    onPress,
    variant = "primary",
    style,
    textStyle,
    icon,
}: ValorantButtonProps) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    const isGlass = variant === "glass";
    const backgroundColor =
        variant === "primary"
            ? COLORS.VALORANT_RED
            : variant === "secondary"
                ? COLORS.VALORANT_BLACK
                : "transparent";

    const borderColor =
        variant === "secondary" ? COLORS.GLASS_BORDER : "transparent";

    const Content = (
        <View style={[styles.contentContainer, { backgroundColor: isGlass ? "rgba(255,70,85, 0.1)" : backgroundColor, borderColor, borderWidth: variant === "secondary" ? 1 : 0 }]}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
                style={[
                    styles.text,
                    {
                        color: variant === "primary" ? COLORS.PURE_WHITE : COLORS.VALORANT_RED,
                    },
                    textStyle,
                ]}
            >
                {title.toUpperCase()}
            </Text>
        </View>
    );

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={[styles.container, style]}
        >
            {isGlass ? (
                <BlurView intensity={20} tint="dark" style={styles.blur}>
                    {Content}
                </BlurView>
            ) : (
                Content
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
        borderRadius: 4,
    },
    blur: {
        borderRadius: 4,
    },
    contentContainer: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        borderRadius: 4,
    },
    text: {
        fontWeight: "bold",
        letterSpacing: 1.5,
        fontSize: 14,
    },
    iconContainer: {
        marginRight: 8,
    },
});
