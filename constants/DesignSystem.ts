import { StyleSheet } from "react-native";

export const COLORS = {
    VALORANT_RED: "#ff4655",
    VALORANT_VIOLET: "#bd3944",
    VALORANT_BLACK: "#0f1923",
    VALORANT_DARK_BLUE: "#1f2326",
    GLASS_WHITE: "rgba(255, 255, 255, 0.9)",
    GLASS_WHITE_DIM: "rgba(255, 255, 255, 0.6)",
    GLASS_BORDER: "rgba(255, 255, 255, 0.1)",
    PURE_WHITE: "#ffffff",
};

export const GLOBAL_STYLES = StyleSheet.create({
    glassContainer: {
        backgroundColor: "rgba(15, 25, 35, 0.6)", // Semi-transparent black for fallback
        borderColor: COLORS.GLASS_BORDER,
        borderWidth: 1,
        overflow: "hidden",
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
});
