import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getEquipmentImage } from "./popups/equipHelpers";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { Image } from "expo-image";

const SECTION_VISUALS = {
  buddies: {
    label: "Gun Buddy",
    cardBackground: "#e8eef6",
    borderColor: "rgba(90, 112, 138, 0.18)",
    visualBackground: "#d4dfea",
  },
  sprays: {
    label: "Spray",
    cardBackground: "#edf0f5",
    borderColor: "rgba(95, 106, 120, 0.18)",
    visualBackground: "#d9e0e8",
  },
  cards: {
    label: "Player Card",
    cardBackground: "#eef1e8",
    borderColor: "rgba(110, 120, 98, 0.18)",
    visualBackground: "#dbe3d2",
  },
  titles: {
    label: "Title",
    cardBackground: "#ece8f0",
    borderColor: "rgba(108, 102, 122, 0.18)",
    visualBackground: "#ddd6e5",
  },
} as const;

const GalleryEquipComponent = ({
  data,
  screenshotModeEnabled,
}: {
  data: any;
  screenshotModeEnabled: boolean;
}) => {
  const visual =
    SECTION_VISUALS[data.section as keyof typeof SECTION_VISUALS] ||
    SECTION_VISUALS.buddies;
  const imageSource = React.useMemo(() => {
    const icon = getEquipmentImage(data);

    if (icon && !screenshotModeEnabled) {
      return { uri: icon };
    }

    return require("~/assets/images/noimage.png");
  }, [data, screenshotModeEnabled]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: visual.cardBackground,
            borderColor: visual.borderColor,
          },
        ]}
        accessible
        accessibilityLabel={data.displayName}
      >
        <Text style={styles.eyebrow} numberOfLines={1}>
          {visual.label}
        </Text>

        <View
          style={[
            styles.visualFrame,
            { backgroundColor: visual.visualBackground, borderColor: visual.borderColor },
          ]}
        >
          <Image
            source={imageSource}
            style={styles.cover}
            contentFit={data.section === "cards" ? "cover" : "contain"}
            cachePolicy="memory-disk"
            transition={120}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {data.displayName}
          </Text>
          {data.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {data.subtitle}
            </Text>
          ) : (
            <Text style={styles.placeholderText} numberOfLines={1}>
              Collection item
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
  },
  card: {
    minHeight: 238,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  content: {
    marginTop: 12,
    minHeight: 58,
  },
  eyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  visualFrame: {
    width: "100%",
    height: 118,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
  },
  placeholderText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 6,
  },
});

const GalleryEquip = React.memo(
  GalleryEquipComponent,
  (prevProps, nextProps) => {
    if (prevProps.screenshotModeEnabled !== nextProps.screenshotModeEnabled) {
      return false;
    }

    const prevData = prevProps.data;
    const nextData = nextProps.data;

    return (
      prevData.id === nextData.id &&
      prevData.displayName === nextData.displayName &&
      prevData.subtitle === nextData.subtitle
    );
  }
);

export default GalleryEquip;
