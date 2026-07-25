// 📦 BundleImage.tsx – Component hiển thị một bundle (gói skin) trong cửa hàng
// Gồm ảnh hero, badge "BUNDLE", đếm ngược, tên, số lượng item, giá VP,
// và nút xem chi tiết

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import Countdown from "./Countdown";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface BundleImageProps {
  bundle: BundleShopItem;
  remainingSecs: number;
  onPress: () => void;
}

/**
 * BundleImage – Component card hiển thị thông tin một bundle
 * @param bundle – Đối tượng BundleShopItem (displayName, displayIcon, items, price, ...)
 * @param remainingSecs – Số giây còn lại trước khi bundle hết hạn
 * @param onPress – Callback khi bấm vào bundle
 */
export default function BundleImage({
  bundle,
  remainingSecs,
  onPress,
}: BundleImageProps) {
  const { t } = useTranslation();
  // Timestamp hết hạn bundle
  const timestamp = new Date().getTime() + remainingSecs * 1000;
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);
  /**
   * heroSource – Nguồn ảnh hero cho bundle
   * Dùng displayIcon, displayIcon2 hoặc verticalPromoImage.
   * Nếu screenshotModeEnabled thì dùng ảnh fallback (noimage)
   */
  const heroSource = React.useMemo(() => {
    const uri = bundle.displayIcon || bundle.displayIcon2 || bundle.verticalPromoImage;

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [bundle.displayIcon, bundle.displayIcon2, bundle.verticalPromoImage, screenshotModeEnabled]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={bundle.displayName}
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.touchable}
    >
      <View style={styles.card}>
        {/* Khung ảnh hero */}
        <View style={styles.imageFrame}>
          {/* Badge "BUNDLE" phía trên bên trái */}
          <View style={styles.topBadge}>
            <Icon
              name="package-variant-closed"
              size={12}
              color={COLORS.PURE_WHITE}
            />
            <Text style={styles.topBadgeText} numberOfLines={1}>
              {t("bundles_page.hero_badge")}
            </Text>
          </View>

          {/* Badge đếm ngược phía trên bên phải */}
          <View style={styles.timerBadge}>
            <Countdown
              timestamp={timestamp}
              color={COLORS.PURE_WHITE}
              compact
              showIcon={false}
              textStyle={styles.timerText}
            />
          </View>

          {/* Ảnh hero bundle */}
          <Image
            cacheId={`bundle:${bundle.uuid}:hero`}
            source={heroSource}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={140}
            recyclingKey={bundle.uuid}
          />
        </View>

        {/* Nội dung phía dưới */}
        <View style={styles.content}>
          {/* Số lượng item trong bundle */}
          <Text style={styles.eyebrow} numberOfLines={1}>
            {t("bundles_page.items_count", { count: bundle.items.length })}
          </Text>
          {/* Tên bundle */}
          <Text style={styles.title} numberOfLines={2}>
            {bundle.displayName}
          </Text>

          {/* Footer: giá + nút xem chi tiết */}
          <View style={styles.footerRow}>
            <View style={styles.priceBadge}>
              <CurrencyIcon icon="vp" style={styles.currency} />
              <Text style={styles.priceText}>{bundle.price}</Text>
            </View>

            <View style={styles.action}>
              <Icon
                name="view-grid-outline"
                size={16}
                color={COLORS.TEXT_PRIMARY}
              />
              <Text style={styles.actionText} numberOfLines={1}>
                {t("bundles_page.view_items", {
                  defaultValue: "Xem skin trong bộ",
                })}
              </Text>
              <Icon
                name="chevron-right"
                size={18}
                color={COLORS.TEXT_PRIMARY}
              />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho BundleImage
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // touchable – TouchableOpacity wrapper có margin bottom
  touchable: {
    marginBottom: 20,
  },
  // card – Card chính của bundle
  card: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  // imageFrame – Khung ảnh hero (tỉ lệ 1.65:1)
  imageFrame: {
    aspectRatio: 1.65,
    backgroundColor: COLORS.WARNING_SURFACE,
    borderBottomColor: COLORS.BORDER,
    borderBottomWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  // heroImage – Ảnh hero full khung
  heroImage: {
    width: "100%",
    height: "100%",
  },
  // content – Vùng nội dung phía dưới ảnh
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  // topBadge – Badge "BUNDLE" góc trên bên trái
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PURE_BLACK,
    borderRadius: 4,
    left: 8,
    maxWidth: "58%",
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: "absolute",
    top: 8,
    zIndex: 1,
  },
  // topBadgeText – Text trong badge
  topBadgeText: {
    marginLeft: 5,
    color: COLORS.PURE_WHITE,
    fontWeight: "900",
    fontSize: 9,
  },
  // timerBadge – Badge đếm ngược góc trên bên phải
  timerBadge: {
    backgroundColor: COLORS.PURE_BLACK,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 1,
  },
  // timerText – Text đếm ngược
  timerText: {
    color: COLORS.PURE_WHITE,
    fontSize: 10,
    fontWeight: "900",
  },
  // eyebrow – "X items" phía trên tên bundle
  eyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
  },
  // title – Tên bundle
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 23,
    marginBottom: 12,
  },
  // footerRow – Hàng footer (giá + nút xem)
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  // priceBadge – Badge hiển thị giá VP
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.WARNING_SURFACE,
    borderColor: COLORS.WARNING_BORDER,
    borderWidth: 1,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  // action – Nút "Xem skin trong bộ"
  action: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  // priceText – Giá VP
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "900",
  },
  // actionText – Text "Xem skin trong bộ"
  actionText: {
    flexShrink: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "800",
  },
  // currency – Icon VP
  currency: {
    width: 13,
    height: 13,
    marginRight: 4,
    tintColor: COLORS.TEXT_PRIMARY,
  },
});
