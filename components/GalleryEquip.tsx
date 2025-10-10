import React from "react";
import { Text, StyleSheet } from "react-native";
import { Card, useTheme } from "react-native-paper";
import { getEquipmentImage } from "./popups/equipHelpers";

const GalleryEquipComponent = ({ data, screenshotModeEnabled }) => {
  const { colors } = useTheme();

  const imageSource = React.useMemo(() => {
    const icon = getEquipmentImage(data);

    if (icon && !screenshotModeEnabled) {
      return { uri: icon };
    }

    return require("~/assets/images/noimage.png");
  }, [data, screenshotModeEnabled]);

  return (
    <Card
      style={[styles.card, { backgroundColor: colors.surface }]}
      accessible
      accessibilityLabel={data.displayName}
    >
      <Card.Cover source={imageSource} style={styles.cover} resizeMode="contain" />
      <Card.Content style={styles.content}>
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {data.displayName}
        </Text>
        {data.subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
            numberOfLines={2}
          >
            {data.subtitle}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  cover: {
    height: 140,
    backgroundColor: "transparent",
  },
  content: {
    paddingTop: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
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