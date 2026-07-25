// ===== NightMarketItem.tsx =====
// Component hiển thị một item trong Night Market (chợ đêm) - nơi bán skin giảm giá.
// Hiển thị: ảnh, tên, loại vũ khí, badge tier, % giảm giá, giá gốc và giá đã giảm.
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getContentTierVisual } from "~/utils/content-tier";
import { getDisplayIconUri } from "~/utils/misc";

// Props cho NightMarketItem
// item: đối tượng NightMarketItem (chứa thông tin skin, giá, discount)
// width: chiều rộng cố định của card (được tính từ bên ngoài)
interface NightMarketItemProps {
  item: NightMarketItem;
  width: number;
}

export default function NightMarketItem({ item, width }: NightMarketItemProps) {
  // Hook dịch thuật i18n
  const { t } = useTranslation();
  // showMediaPopup: hàm từ MediaPopup store để mở popup xem media
  const showMediaPopup = useMediaPopupStore((state) => state.showMediaPopup);
  // screenshotModeEnabled: flag chế độ screenshot từ FeatureStore
  const screenshotModeEnabled = useFeatureStore(
    (state) => state.screenshotModeEnabled
  );
  // tier: thông tin visual của content tier (màu sắc, nhãn)
  const tier = getContentTierVisual(item.contentTierUuid);

  // imageSource: useMemo tính toán nguồn ảnh skin
  // Dùng getDisplayIconUri, fallback về noimage nếu không có hoặc đang screenshot mode
  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  // mediaEntries: useMemo tính toán danh sách media entries từ levels của item
  // Mỗi level: lấy streamedVideo hoặc displayIcon, lọc bỏ entry rỗng
  // Dùng để mở preview popup khi nhấn vào card
  const mediaEntries = React.useMemo(
    () =>
      item.levels
        .map((level) => ({
          cacheId: `skin-level:${level.uuid}:media`,
          uri: level.streamedVideo || level.displayIcon,
        }))
        .filter(
          (entry): entry is { cacheId: string; uri: string } =>
            Boolean(entry.uri)
        ),
    [item.levels]
  );

  // weaponType: useMemo xác định loại vũ khí dựa vào tên displayName
  // Dùng danh sách weaponTypes để match, sau đó phân loại vào nhóm category
  // Trả về: tên category đã dịch (VD: "Melee Weapons", "Sidearm", "SMG", ...)
  const weaponType = React.useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    const weaponTypes = [
      "Knife",
      "Melee",
      "Classic",
      "Shorty",
      "Frenzy",
      "Ghost",
      "Sheriff",
      "Stinger",
      "Spectre",
      "Bucky",
      "Judge",
      "Bulldog",
      "Guardian",
      "Phantom",
      "Vandal",
      "Marshal",
      "Outlaw",
      "Operator",
      "Ares",
      "Odin",
    ];
    const match = weaponTypes.find((name) =>
      lowerName.includes(name.toLowerCase())
    );

    // Phân loại dựa vào tên vũ khí tìm được
    if (match === "Knife" || match === "Melee") {
      return t("equip_page.categories.Melee Weapons");
    }
    if (["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"].includes(match ?? "")) {
      return t("equip_page.categories.Sidearm");
    }
    if (["Stinger", "Spectre"].includes(match ?? "")) {
      return t("equip_page.categories.SMG");
    }
    if (["Bucky", "Judge"].includes(match ?? "")) {
      return t("equip_page.categories.Shotgun");
    }
    if (["Bulldog", "Guardian", "Phantom", "Vandal"].includes(match ?? "")) {
      return t("equip_page.categories.Rifle");
    }
    if (["Marshal", "Outlaw", "Operator"].includes(match ?? "")) {
      return t("equip_page.categories.Sniper");
    }
    if (["Ares", "Odin"].includes(match ?? "")) {
      return t("equip_page.categories.Heavy");
    }

    return t("equip_page.categories.Other");
  }, [item.displayName, t]);

  // handlePress: Callback mở popup preview media khi nhấn vào card
  // Nếu có mediaEntries, gọi showMediaPopup với danh sách URI, tên item, và cacheId
  const handlePress = React.useCallback(() => {
    if (mediaEntries.length > 0) {
      showMediaPopup(
        mediaEntries.map((entry) => entry.uri),
        item.displayName,
        mediaEntries.map((entry) => entry.cacheId)
      );
    }
  }, [item.displayName, mediaEntries, showMediaPopup]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
      // Disable nếu không có media để preview
      disabled={mediaEntries.length === 0}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: tier.border, width },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Khung ảnh: chứa badge tier, badge giảm giá, và ảnh skin */}
      <View
        style={[
          styles.imageFrame,
          {
            backgroundColor: tier.cardBackground,
            borderBottomColor: tier.border,
          },
        ]}
      >
        {/* Badge tier (VD: "DELUXE", "PREMIUM") ở góc trên bên trái */}
        <View style={[styles.tierBadge, { backgroundColor: tier.badgeBackground }]}>
          <Text style={[styles.tierText, { color: tier.text }]} numberOfLines={1}>
            {tier.label.toUpperCase()}
          </Text>
        </View>
        {/* Badge giảm giá (VD: "-35%") ở góc trên bên phải */}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{item.discountPercent}%</Text>
        </View>
        {/* Ảnh skin */}
        <Image
          cacheId={`skin:${item.uuid}:display`}
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="normal"
          transition={120}
          recyclingKey={item.uuid}
        />
      </View>

      {/* Nội dung: loại vũ khí, tên skin, hàng giá */}
      <View style={styles.content}>
        {/* Loại vũ khí */}
        <Text style={styles.weaponTypeText} numberOfLines={1}>
          {weaponType}
        </Text>
        {/* Tên skin (tối đa 2 dòng) */}
        <Text style={styles.title} numberOfLines={2}>
          {item.displayName}
        </Text>

        {/* Hàng giá: giá đã giảm + icon VP + giá gốc (gạch ngang) */}
        <View style={styles.priceRow}>
          {/* Badge giá sale: icon VP + số tiền giảm */}
          <View
            style={[
              styles.salePriceWrapper,
              {
                backgroundColor: tier.badgeBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <CurrencyIcon
              icon="vp"
              style={[styles.currencyIcon, { tintColor: tier.text }]}
            />
            <Text style={[styles.salePrice, { color: tier.text }]}>
              {item.discountedPrice}
            </Text>
          </View>
          {/* Giá gốc (gạch ngang) */}
          <Text style={styles.originalPrice}>{item.price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// StyleSheet: Định nghĩa các style cho NightMarketItem
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",              // Giữ bo góc cho nội dung bên trong
  },
  cardPressed: {
    opacity: 0.86,                   // Giảm độ mờ khi nhấn
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  currencyIcon: {
    width: 13,
    height: 13,
    marginRight: 4,                  // Khoảng cách giữa icon và giá
  },
  discountBadge: {
    backgroundColor: COLORS.PURE_BLACK, // Nền đen
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",            // Định vị góc trên bên phải
    right: 8,
    top: 8,
    zIndex: 1,                       // Trên layer ảnh
  },
  discountText: {
    color: COLORS.PURE_WHITE,        // Chữ trắng
    fontSize: 10,
    fontWeight: "900",
  },
  image: {
    width: "100%",
    height: "100%",                  // Fill khung imageFrame
  },
  imageFrame: {
    aspectRatio: 1.45,               // Tỷ lệ khung ảnh
    borderBottomWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",            // Để badge absolute định vị
  },
  originalPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "600",
    textDecorationLine: "line-through", // Gạch ngang giá gốc
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Giá sale trái, giá gốc phải
    gap: 6,
  },
  salePrice: {
    fontSize: 14,
    fontWeight: "900",               // Siêu đậm cho giá khuyến mãi
  },
  salePriceWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tierBadge: {
    borderRadius: 4,
    left: 8,                         // Góc trên bên trái
    maxWidth: "56%",
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
    zIndex: 1,
  },
  tierText: {
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,                   // Tối thiểu 2 dòng
    marginBottom: 8,
  },
  weaponTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 3,
  },
});
