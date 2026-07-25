import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

// ─── Props ─────────────────────────────────────────────────────────────────────
//   - item: đối tượng AccessoryShopItem chứa thông tin phụ kiện (uuid, price,
//           displayName, ...)

interface Props {
  item: AccessoryShopItem;
}

// ─── ShopAccessoryItem ─────────────────────────────────────────────────────────
// Component hiển thị một thẻ (card) phụ kiện trong shop.
// Bao gồm: hình ảnh, badge loại, tên, giá tiền.
//
// State & Hook:
//   - t (từ useTranslation): hàm dịch đa ngôn ngữ
//   - screenshotModeEnabled (từ useFeatureStore): bool cho biết chế độ chụp
//     màn hình có đang bật không -> nếu bật thì không load ảnh thật

// useMemo: imageSource
//   - Tính toán URI nguồn ảnh dựa trên item và screenshotModeEnabled
//   - Nếu có URI hợp lệ và không ở chế độ screenshot => trả về object { uri }
//   - Ngược lại => trả về ảnh mặc định "noimage.png"
//   - Phụ thuộc: [item, screenshotModeEnabled]

export default function ShopAccessoryItem({ item }: Props) {
  const { t } = useTranslation();
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);

  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/*
        ── visualFrame ──────────────────────────────────────────────────────────
        Khung hình phía trên card: chứa typeBadge (nhãn "ACCESSORY") và ảnh
        */}
      <View style={styles.visualFrame}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText} numberOfLines={1}>
            {t("shop_cards.accessory").toUpperCase()}
          </Text>
        </View>
        <Image
          cacheId={`accessory:${item.uuid}:display`}
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
          transition={120}
          recyclingKey={item.uuid}
        />
      </View>

      {/*
        ── content ──────────────────────────────────────────────────────────────
        Phần nội dung phía dưới: danh mục, tên sản phẩm, giá
        */}
      <View style={styles.content}>
        <Text style={styles.categoryText} numberOfLines={1}>
          {t("accessories_page.card_subtitle")}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.displayName}
        </Text>

        <View style={styles.priceRow}>
          <View style={styles.priceBadge}>
            <CurrencyIcon icon="kc" style={styles.currencyIcon} />
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // card: thẻ chính, border warning, nền SURFACE, bo góc 8, overflow hidden
  card: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.WARNING_BORDER,
  },
  // cardPressed: hiệu ứng khi nhấn - giảm độ mờ
  cardPressed: {
    opacity: 0.86,
  },
  // content: padding ngang/dọc cho phần nội dung
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  // categoryText: text danh mục (secondary, cỡ 10, bold 600)
  categoryText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
  },
  // visualFrame: khung ảnh tỷ lệ 1.45, nền warning, border dưới, padding 12
  visualFrame: {
    aspectRatio: 1.45,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.WARNING_BORDER,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.WARNING_SURFACE,
    position: "relative",
  },
  // image: ảnh chiếm toàn bộ khung
  image: {
    width: "100%",
    height: "100%",
  },
  // title: tên sản phẩm, primary, size 13, bold 800, lineHeight 17, minHeight 34
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,
    marginBottom: 8,
  },
  // priceRow: hàng ngang chứa giá, flex row, space-between
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  // priceBadge: badge giá với border warning, nền warning, bo góc chip, padding
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.WARNING_BORDER,
    backgroundColor: COLORS.WARNING_SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  // priceText: text giá, primary, size 14, bold 900
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "900",
  },
  // currencyIcon: icon tiền tệ (KC), 13x13, tint primary
  currencyIcon: {
    width: 13,
    height: 13,
    marginRight: 4,
    tintColor: COLORS.TEXT_PRIMARY,
  },
  // typeBadge: badge "ACCESSORY" góc trên trái, absolute, nền đỏ nhạt 12%
  typeBadge: {
    backgroundColor: "rgba(229, 72, 77, 0.12)",
    borderRadius: 4,
    left: 8,
    maxWidth: "56%",
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
    zIndex: 1,
  },
  // typeBadgeText: text trong badge, primary, size 9, bold 900
  typeBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 9,
    fontWeight: "900",
  },
});
