import { Platform, StyleSheet } from "react-native";

export const COLORS = {
  ACCENT: "#ff6b57",
  ACCENT_DEEP: "#201f1d",
  BACKGROUND: "#f3f0ea",
  SURFACE: "#ffffff",
  SURFACE_MUTED: "#ece8e1",
  TEXT_PRIMARY: "#181717",
  TEXT_SECONDARY: "#7e7a74",
  BORDER: "rgba(24, 23, 23, 0.08)",
  OVERLAY: "rgba(24, 23, 23, 0.42)",
  PURE_WHITE: "#ffffff",
  PURE_BLACK: "#111111",
  SUCCESS: "#3f8f74",
  WARNING: "#d77b43",
  WARNING_SURFACE: "#fff3dd",
  WARNING_BORDER: "#f2d8a6",
  VALORANT_RED: "#ff6b57",
  VALORANT_VIOLET: "#d97561",
  VALORANT_BLACK: "#201f1d",
  VALORANT_DARK_BLUE: "#32363b",
  GLASS_WHITE: "rgba(255, 255, 255, 0.92)",
  GLASS_WHITE_DIM: "rgba(24, 23, 23, 0.55)",
  GLASS_BORDER: "rgba(24, 23, 23, 0.08)",
};

export const RADIUS = {
  screen: 32,
  card: 24,
  chip: 999,
  button: 22,
};

const shadowStyle =
  Platform.OS === "web"
    ? ({
        boxShadow: "0px 16px 24px rgba(0, 0, 0, 0.08)",
      } as any)
    : {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 10,
      };

export const GLOBAL_STYLES = StyleSheet.create({
  glassContainer: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderWidth: 1,
    overflow: "hidden",
  },
  shadow: shadowStyle,
});
