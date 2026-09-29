// ===== BundleItem.tsx =====
// Item compact (không tương tác) bên trong carousel ngang của bundle card:
// khung ảnh vuông contain + tên + giá VP hiện tại (kèm giá base bị gạch khi giảm).
// Toàn bộ dùng token sáng — không nền tối, không badge ownership.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";

import CurrencyIcon from "./CurrencyIcon";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { formatVp, hasBundleDiscount } from "~/utils/bundle-display";

// Interface định nghĩa props cho BundleItem
// item: SkinShopItem (skin vũ khí) hoặc AccessoryShopItem (phụ kiện)
// width: độ rộng cố định của cell do carousel cấp (getItemLayout ổn định)
interface BundleItemProps {
  item: SkinShopItem | AccessoryShopItem;
  width: number;
}

// BundleItem: memo hoá vì carousel render lại khi count-down tick mỗi giây;
// item reference chỉ đổi khi storefront refresh.
const BundleItem = React.memo(function BundleItem({
  item,
  width,
}: BundleItemProps) {
  const discounted = hasBundleDiscount(item.originalPrice, item.price);

  return (
    <View
      testID="bundle-item-cell"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${item.displayName}, ${formatVp(item.price)} VP`}
      style={[styles.card, { width }]}
    >
      {/* Khung ảnh vuông: giữ chỗ cố định (aspectRatio 1) dù ảnh thiếu */}
      <View style={styles.visualFrame}>
        <Image
          cacheId={`bundle-item:${item.uuid}:display`}
          style={styles.image}
          source={
            item.displayIcon
              ? { uri: item.displayIcon }
              : require("~/assets/images/noimage.png")
          }
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
          recyclingKey={item.uuid}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {item.displayName}
        </Text>
        <View style={styles.priceRow}>
          {discounted && item.originalPrice !== undefined ? (
            <Text style={styles.oldPrice} numberOfLines={1}>
              {formatVp(item.originalPrice)}
            </Text>
          ) : null}
          <View style={styles.priceValue}>
            {/* Icon VP trang trí: ẩn khỏi screen reader để tên item được đọc 1 lần */}
            <View
              style={styles.currencyWrapper}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <CurrencyIcon icon="vp" style={styles.currencyIcon} />
            </View>
            <Text style={styles.priceText} numberOfLines={1}>
              {formatVp(item.price)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

// StyleSheet: định nghĩa các style cho BundleItem (chỉ token sáng)
const styles = StyleSheet.create({
  // card – cell item nền xám rất nhạt, viền mờ, bo góc nhỏ
  card: {
    backgroundColor: COLORS.SURFACE_MUTED,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  // visualFrame – khung ảnh vuông nền trắng, giữ chỗ bằng aspectRatio
  visualFrame: {
    aspectRatio: 1,
    backgroundColor: COLORS.SURFACE,
    borderBottomColor: COLORS.BORDER,
    borderBottomWidth: 1,
    padding: 6,
  },
  // image – ảnh contain (vũ khí/melee lẫn phụ kiện) chiếm toàn khung
  image: {
    width: "100%",
    height: "100%",
  },
  // content – vùng tên + giá
  content: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  // title – tên item 1 dòng
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    marginBottom: 6,
  },
  // priceRow – giá base bị gạch (nếu có) + giá hiện tại
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  // oldPrice – giá base bị gạch ngang, chỉ hiện khi > giá hiện tại
  oldPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "600",
    textDecorationLine: "line-through",
    flexShrink: 1,
  },
  // priceValue – chip giá hiện tại
  priceValue: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  currencyWrapper: {
    marginRight: 3,
  },
  currencyIcon: {
    width: 11,
    height: 11,
    tintColor: COLORS.TEXT_PRIMARY,
  },
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "900",
  },
});

export default BundleItem;
