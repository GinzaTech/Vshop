// ===== BundleItem.tsx =====
// Item compact (không tương tác) bên trong carousel ngang của bundle card,
// theo geometry tham chiếu: tile sáng thống nhất (SURFACE, không divider
// ngăn ảnh), artwork band contain, tên căn giữa 1 dòng, giá base bị gạch
// nằm TRÊN giá hiện tại (icon VP trang trí ở cả hai hàng).
// Tile đã sở hữu: phủ overlay sáng mờ (pointerEvents none) lên vùng
// artwork + tên kèm check tròn xanh ở góc trên trái; giá vẫn nguyên vẹn.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import AppIcon from "~/components/ui/AppIcon";
import CurrencyIcon from "./CurrencyIcon";
import { COLORS, RADIUS, SHADOWS, SPACING } from "~/constants/DesignSystem";
import { formatVp, hasBundleDiscount } from "~/utils/bundle-display";

// Interface định nghĩa props cho BundleItem
// item: SkinShopItem (skin vũ khí) hoặc AccessoryShopItem (phụ kiện)
// width: độ rộng cố định của cell do carousel cấp (getItemLayout ổn định)
// owned: mặc định false — card không có ownership callback thì không badge
interface BundleItemProps {
  item: SkinShopItem | AccessoryShopItem;
  width: number;
  owned?: boolean;
}

/** Tỉ lệ artwork band (ngang:dọc) — band ≈ 45% chiều cao tile. */
const BUNDLE_ITEM_ART_ASPECT_RATIO = 1.55;

// BundleItem: memo hoá vì carousel render lại khi countdown tick mỗi giây;
// item reference chỉ đổi khi storefront refresh, owned là boolean.
const BundleItem = React.memo(function BundleItem({
  item,
  width,
  owned = false,
}: BundleItemProps) {
  const { t } = useTranslation();
  const discounted = hasBundleDiscount(item.originalPrice, item.price);

  // Tóm tắt screen reader: tên + giá hiện tại, trạng thái purchased một lần.
  const accessibilitySummary = `${item.displayName}, ${formatVp(item.price)} VP${
    owned ? `, ${t("bundles_page.purchased")}` : ""
  }`;

  return (
    <View
      testID="bundle-item-cell"
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilitySummary}
      style={[styles.card, SHADOWS.xs, { width }]}
    >
      {/* Vùng artwork + tên: overlay "đã sở hữu" phủ đến đây, không chạm giá */}
      <View style={styles.topBlock}>
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
        <Text style={styles.title} numberOfLines={1}>
          {item.displayName}
        </Text>

        {owned ? (
          <View
            testID="bundle-item-owned-overlay"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.ownedOverlay}
          />
        ) : null}
        {owned ? (
          <View
            testID="bundle-item-owned-check"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.ownedCheck}
          >
            <AppIcon name="check" size={11} color={COLORS.PURE_WHITE} decorative />
          </View>
        ) : null}
      </View>

      <View style={styles.priceStack}>
        {discounted && item.originalPrice !== undefined ? (
          <View style={styles.priceRow}>
            {/* Icon VP trang trí: ẩn khỏi screen reader để tên item đọc 1 lần */}
            <View
              style={styles.currencyWrapper}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <CurrencyIcon icon="vp" style={styles.currencyIconOld} />
            </View>
            {/* Không numberOfLines: chữ số giá không được cắt/ellipsis */}
            <Text style={styles.oldPrice}>{formatVp(item.originalPrice)}</Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <View
            style={styles.currencyWrapper}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <CurrencyIcon icon="vp" style={styles.currencyIcon} />
          </View>
          <Text style={styles.priceText}>{formatVp(item.price)}</Text>
        </View>
      </View>
    </View>
  );
});

// StyleSheet: định nghĩa các style cho BundleItem (chỉ token sáng, unified)
const styles = StyleSheet.create({
  // card – tile item nền trắng đục thống nhất, viền mờ, bo góc RADIUS.md.
  // Không dùng lớp kính mờ phủ: artwork phải sắc nét, hết cảm giác "milk wash".
  card: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  // topBlock – vùng artwork + tên; overlay ownership phủ trọn vùng này
  topBlock: {},
  // visualFrame – artwork band contain, trong suốt để join nền tile
  visualFrame: {
    aspectRatio: BUNDLE_ITEM_ART_ASPECT_RATIO,
    backgroundColor: "transparent",
    padding: SPACING.xxs,
  },
  // image – ảnh contain (vũ khí/melee lẫn phụ kiện) chiếm toàn band
  image: {
    width: "100%",
    height: "100%",
  },
  // title – tên item 1 dòng, căn giữa theo tham chiếu
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
    marginTop: SPACING.xxs,
    marginBottom: SPACING.xxs,
    paddingHorizontal: SPACING.xxs,
  },
  // priceStack – giá base (gạch) nằm trên giá hiện tại, căn giữa
  priceStack: {
    alignItems: "center",
    gap: SPACING.xxs,
    paddingBottom: SPACING.xs,
  },
  // priceRow – một hàng giá: icon VP trang trí + số VP
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  // oldPrice – giá base bị gạch ngang, chỉ hiện khi > giá hiện tại
  oldPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textDecorationLine: "line-through",
  },
  currencyWrapper: {},
  currencyIcon: {
    width: 11,
    height: 11,
    tintColor: COLORS.TEXT_PRIMARY,
  },
  currencyIconOld: {
    width: 10,
    height: 10,
    tintColor: COLORS.TEXT_SECONDARY,
  },
  // priceText – giá VP hiện tại, nổi bật hơn giá base
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
  },
  // ownedOverlay – lớp phủ sáng mờ lên artwork + tên; không chặn cử chỉ
  ownedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.SURFACE,
    opacity: 0.55,
  },
  // ownedCheck – check tròn xanh góc trên trái, viền trắng mảnh
  ownedCheck: {
    position: "absolute",
    top: SPACING.xxs,
    left: SPACING.xxs,
    width: 20,
    height: 20,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SUCCESS,
    borderColor: COLORS.PURE_WHITE,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export default BundleItem;
