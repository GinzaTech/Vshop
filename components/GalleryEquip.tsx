import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { getEquipmentImage } from "./popups/equipHelpers";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { Image } from "expo-image";

const GalleryEquipComponent = ({ data, screenshotModeEnabled }: { data: any, screenshotModeEnabled: boolean }) => {
  const imageSource = React.useMemo(() => {
    const icon = getEquipmentImage(data);

    if (icon && !screenshotModeEnabled) {
      return { uri: icon };
    }

    return require("~/assets/images/noimage.png");
  }, [data, screenshotModeEnabled]);

  return (
    <View style={styles.container}>
      <GlassCard
        style={styles.card}
        accessible
        accessibilityLabel={data.displayName}
      >
        <Image source={imageSource} style={styles.cover} contentFit="contain" />
        <View style={styles.content}>
          <Text
            style={styles.title}
            numberOfLines={1}
          >
            {data.displayName}
          </Text>
          {data.subtitle ? (
            <Text
              style={styles.subtitle}
              numberOfLines={2}
            >
              {data.subtitle}
            </Text>
          ) : null}
        </View>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
  },
  card: {
    padding: 0, // GlassCard has internal padding, maybe adjust
    // Resetting GlassCard internal View padding if needed via child
  },
  cover: {
    height: 100,
    width: "100%",
    marginBottom: 8,
  },
  content: {
    // padding: 12, // GlassCard adds padding to content container
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.TEXT_SECONDARY,
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
