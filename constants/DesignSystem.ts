import { Platform, StyleSheet } from "react-native";

export const COLORS = {
  ACCENT: "#687076",
  ACCENT_DEEP: "#1c2024",
  BACKGROUND: "#f4f6f9",
  SURFACE: "#ffffff",
  SURFACE_MUTED: "#eceef0",
  TEXT_PRIMARY: "#11181c",
  TEXT_SECONDARY: "#687076",
  BORDER: "rgba(0, 0, 0, 0.06)",
  OVERLAY: "rgba(17, 24, 28, 0.4)",
  PURE_WHITE: "#ffffff",
  PURE_BLACK: "#11181c",
  SUCCESS: "#30a46c",
  WARNING: "#e5484d",
  WARNING_SURFACE: "#fdf7f7",
  WARNING_BORDER: "#f3aeaf",
  VALORANT_RED: "#ff4655",
  VALORANT_VIOLET: "#7c3aed",
  VALORANT_BLACK: "#11181c",
  VALORANT_DARK_BLUE: "#1f2937",
  GLASS_WHITE: "rgba(255, 255, 255, 0.85)",
  GLASS_WHITE_DIM: "rgba(17, 24, 28, 0.08)",
  GLASS_BORDER: "rgba(0, 0, 0, 0.06)",
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
