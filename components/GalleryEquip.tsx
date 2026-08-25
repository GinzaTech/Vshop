// ===== GalleryEquip.tsx =====
// Component hiển thị một item trong thư viện equipment (phụ kiện).
// Hỗ trợ 4 loại: buddies (vật phẩm treo vũ khí), sprays (hình xăm), cards (thẻ người chơi), titles (danh hiệu).
import React, { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useReducedMotion } from "react-native-reanimated";

import {
  buildEquipDisplayList,
  getEquipmentImage,
} from "./popups/equipHelpers";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { CachedImage as Image } from "~/components/CachedImage";
import { MOTION_DURATION } from "~/constants/Motion";
import { useTranslation } from "react-i18next";

type EquipmentDisplayItem = ReturnType<
  typeof buildEquipDisplayList
>[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const SECTION_VISUALS: Record<
  string,
  {
    labelKey: string;
    icon: ComponentProps<typeof Icon>["name"];
  }
> = {
  buddies: {
    labelKey: "equip_gallery.labels.buddies",
    icon: "link-variant",
  },
  sprays: {
    labelKey: "equip_gallery.labels.sprays",
    icon: "spray",
  },
  cards: {
    labelKey: "equip_gallery.labels.cards",
    icon: "card-account-details-outline",
  },
  titles: {
    labelKey: "equip_gallery.labels.titles",
    icon: "format-title",
  },
};

// GalleryEquipComponent: Component nội bộ hiển thị một card equipment
// data: dữ liệu item (chứa section, id, displayName, ...)
// screenshotModeEnabled: flag chế độ screenshot (nếu true thì dùng ảnh fallback)
const GalleryEquipComponent = ({
  data,
  screenshotModeEnabled,
}: {
  data: EquipmentDisplayItem;
  screenshotModeEnabled: boolean;
}) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const visual =
    SECTION_VISUALS[data.section] ||
    SECTION_VISUALS.buddies;
  const categoryLabel = t(visual.labelKey);
  const rawDisplayName =
    typeof data.displayName === "string" ? data.displayName.trim() : "";
  const displayName =
    rawDisplayName && !UUID_PATTERN.test(rawDisplayName)
      ? rawDisplayName
      : categoryLabel;
  const rawSubtitle =
    typeof data.subtitle === "string" ? data.subtitle.trim() : "";
  const subtitle = /::|_/.test(rawSubtitle) ? "" : rawSubtitle;
  const isTitle = data.section === "titles";

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
        style={styles.card}
        accessible
        accessibilityLabel={`${categoryLabel}: ${displayName}`}
      >
        <View
          style={[
            styles.visualFrame,
            data.section === "cards" && styles.cardVisualFrame,
            isTitle && styles.titleVisualFrame,
          ]}
        >
          {isTitle ? (
            <Text style={styles.titleArtwork} numberOfLines={3}>
              {subtitle || displayName}
            </Text>
          ) : (
            <Image
              cacheId={`equipment:${data.section}:${data.id}:display`}
              source={imageSource}
              style={styles.cover}
              contentFit={data.section === "cards" ? "cover" : "contain"}
              cachePolicy="memory-disk"
              priority="low"
              transition={reduceMotion ? 0 : MOTION_DURATION.fast}
              recyclingKey={data.id}
            />
          )}

          <View style={styles.categoryChip}>
            <Icon name={visual.icon} size={13} color={COLORS.PURE_WHITE} />
            <Text
              style={[
                styles.categoryLabel,
                data.section === "cards" && styles.categoryLabelCompact,
              ]}
              numberOfLines={1}
            >
              {categoryLabel}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {displayName}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// StyleSheet: Định nghĩa các style cho GalleryEquip
const styles = StyleSheet.create({
  container: {
    flex: 1,          // Chiếm không gian có sẵn
    margin: 6,        // Khoảng cách giữa các card
  },
  card: {
    minHeight: 220,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 10,
    backgroundColor: COLORS.SURFACE,
    overflow: "hidden",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  visualFrame: {
    width: "100%",
    height: 128,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    overflow: "hidden",
  },
  cardVisualFrame: {
    padding: 0,
  },
  titleVisualFrame: {
    backgroundColor: COLORS.ACCENT_DEEP,
    paddingHorizontal: 18,
    paddingTop: 38,
  },
  titleArtwork: {
    color: COLORS.PURE_WHITE,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
  },
  categoryChip: {
    position: "absolute",
    left: 10,
    top: 10,
    maxWidth: "82%",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.PURE_BLACK,
  },
  categoryLabel: {
    flexShrink: 1,
    color: COLORS.PURE_WHITE,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  categoryLabelCompact: {
    fontSize: 10,
    letterSpacing: 0,
  },
  content: {
    minHeight: 70,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  title: {
    minHeight: 38,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
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
      prevData.section === nextData.section &&
      prevData.displayName === nextData.displayName &&
      prevData.subtitle === nextData.subtitle
    );
  }
);

export default GalleryEquip;
