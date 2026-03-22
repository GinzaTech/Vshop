import { Platform, StyleSheet } from "react-native";

export const COLORS = {
  ACCENT: "#7b838f",
  ACCENT_DEEP: "#2f343b",
  BACKGROUND: "#dce1e8",
  SURFACE: "#f1f4f8",
  SURFACE_MUTED: "#c6ced8",
  TEXT_PRIMARY: "#171a1f",
  TEXT_SECONDARY: "#4f5a67",
  BORDER: "rgba(23, 26, 31, 0.14)",
  OVERLAY: "rgba(23, 26, 31, 0.44)",
  PURE_WHITE: "#fcfdff",
  PURE_BLACK: "#171a1f",
  SUCCESS: "#5f7a6b",
  WARNING: "#6e7884",
  WARNING_SURFACE: "#e6ebf1",
  WARNING_BORDER: "#bcc5d0",
  VALORANT_RED: "#7b838f",
  VALORANT_VIOLET: "#9aa2ad",
  VALORANT_BLACK: "#2f343b",
  VALORANT_DARK_BLUE: "#4c5560",
  GLASS_WHITE: "rgba(241, 244, 248, 0.94)",
  GLASS_WHITE_DIM: "rgba(23, 26, 31, 0.58)",
  GLASS_BORDER: "rgba(23, 26, 31, 0.14)",
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
        boxShadow: "0px 18px 30px rgba(23, 26, 31, 0.16)",
      } as any)
    : {
        shadowColor: "#171a1f",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
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
