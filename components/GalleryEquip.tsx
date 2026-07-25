// ===== GalleryEquip.tsx =====
// Component hiển thị một item trong thư viện equipment (phụ kiện).
// Hỗ trợ 4 loại: buddies (vật phẩm treo vũ khí), sprays (hình xăm), cards (thẻ người chơi), titles (danh hiệu).
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getEquipmentImage } from "./popups/equipHelpers";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

// SECTION_VISUALS: Cấu hình màu sắc và nhãn cho từng loại equipment
// Mỗi section có: labelKey (key dịch), cardBackground (nền card),
//   borderColor (màu viền), visualBackground (nền khung ảnh)
const SECTION_VISUALS = {
  buddies: {
    labelKey: "equip_gallery.labels.buddies",
    cardBackground: "#e8eef6",
    borderColor: "rgba(90, 112, 138, 0.18)",
    visualBackground: "#d4dfea",
  },
  sprays: {
    labelKey: "equip_gallery.labels.sprays",
    cardBackground: "#edf0f5",
    borderColor: "rgba(95, 106, 120, 0.18)",
    visualBackground: "#d9e0e8",
  },
  cards: {
    labelKey: "equip_gallery.labels.cards",
    cardBackground: "#eef1e8",
    borderColor: "rgba(110, 120, 98, 0.18)",
    visualBackground: "#dbe3d2",
  },
  titles: {
    labelKey: "equip_gallery.labels.titles",
    cardBackground: "#ece8f0",
    borderColor: "rgba(108, 102, 122, 0.18)",
    visualBackground: "#ddd6e5",
  },
} as const;

// GalleryEquipComponent: Component nội bộ hiển thị một card equipment
// data: dữ liệu item (chứa section, id, displayName, ...)
// screenshotModeEnabled: flag chế độ screenshot (nếu true thì dùng ảnh fallback)
const GalleryEquipComponent = ({
  data,
  screenshotModeEnabled,
}: {
  data: any;
  screenshotModeEnabled: boolean;
}) => {
  // Hook dịch thuật i18n
  const { t } = useTranslation();

  // visual: lấy cấu hình màu sắc dựa vào data.section
  // Nếu section không hợp lệ, mặc định dùng buddies
  const visual =
    SECTION_VISUALS[data.section as keyof typeof SECTION_VISUALS] ||
    SECTION_VISUALS.buddies;

  // imageSource: useMemo tính toán nguồn ảnh
  // Dùng getEquipmentImage(data) để lấy URL, nếu không có hoặc screenshotMode thì dùng noimage.png
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
        {/* Eyebrow: nhãn loại equipment (VD: "BUDDIES", "SPRAYS") */}
        <Text style={styles.eyebrow} numberOfLines={1}>
          {t(visual.labelKey)}
        </Text>

        {/* visualFrame: khung chứa ảnh */}
        <View
          style={[
            styles.visualFrame,
            { backgroundColor: visual.visualBackground, borderColor: visual.borderColor },
          ]}
        >
          <Image
            cacheId={`equipment:${data.section}:${data.id}:display`}
            source={imageSource}
            style={styles.cover}
            // Cards dùng "cover" (fill khung), các loại khác dùng "contain" (giữ tỷ lệ)
            contentFit={data.section === "cards" ? "cover" : "contain"}
            cachePolicy="memory-disk"
            priority="low"
            transition={120}
            recyclingKey={data.id}
          />
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
    minHeight: 180,                    // Chiều cao tối thiểu
    borderRadius: RADIUS.card,         // Bo góc card
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",                // Ẩn nội dung tràn
  },
  cover: {
    width: "100%",
    height: "100%",                    // Ảnh fill khung visualFrame
  },
  eyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,                  // Khoảng cách với visualFrame
  },
  visualFrame: {
    width: "100%",
    height: 118,                       // Chiều cao cố định cho khung ảnh
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",              // Căn giữa ảnh
    justifyContent: "center",
    padding: 10,                       // Padding để ảnh không sát viền
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
