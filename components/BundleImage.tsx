// 📦 BundleImage.tsx – Bundle detail card nền trắng theo layout tham chiếu Champions:
// hero artwork (tỉ lệ 2.40, ưu tiên displayIcon2) → title + giá thật (base bị
// gạch khi giảm) → đồng hồ đếm ngược TRƯỚC prefix "Ends in" + số item →
// carousel item compact ba cell đầy + cell kế lộ một phần.
// Không còn onPress/modal; toàn bộ item hiển thị inline nên card tự chứa
// toàn bộ thông tin bundle. isOwned(item) mặc định false để card dùng được
// nơi không có dữ liệu ownership.

import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import Countdown from "./Countdown";
import BundleItem from "./BundleItem";
import CurrencyIcon from "./CurrencyIcon";
import AppIcon from "~/components/ui/AppIcon";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { BUNDLE_SURFACE_BORDER, COLORS, RADIUS, SHADOWS, SPACING } from "~/constants/DesignSystem";
import type { BundleOwnershipMatcher } from "~/utils/bundle-ownership";
import {
  BUNDLE_CAROUSEL_CONTENT_PADDING,
  BUNDLE_CAROUSEL_GAP,
  formatVp,
  getBundleItemMaxPriceTextLength,
  getBundleItemWidth,
  hasBundleDiscount,
} from "~/utils/bundle-display";

interface BundleImageProps {
  bundle: BundleShopItem;
  remainingSecs: number;
  /** Callback ownership của tài khoản hiện tại; mặc định luôn false. */
  isOwned?: BundleOwnershipMatcher;
}

/** Mặc định an toàn: không có dữ liệu ownership thì không tile nào có badge. */
const NOT_OWNED: BundleOwnershipMatcher = () => false;

/** Hero aspect ratio theo tham chiếu (ảnh ngang rộng). */
const HERO_ASPECT_RATIO = 2.4;

/**
 * Separator cố định giữa các cell — tham chiếu module-level để FlatList
 * không tạo lại element.
 */
function CarouselSeparator() {
  return <View style={{ width: BUNDLE_CAROUSEL_GAP }} />;
}

/**
 * BundleImage – Card chi tiết bundle inline (nền trắng/sáng).
 * @param bundle – Đối tượng BundleShopItem (displayName, displayIcon, items, price, originalPrice…).
 * @param remainingSecs – Số giây còn lại trước khi bundle hết hạn.
 * @param isOwned – Callback kiểm item đã sở hữu (mặc định luôn false).
 */
function BundleImage({ bundle, remainingSecs, isOwned = NOT_OWNED }: BundleImageProps) {
  const { t } = useTranslation();
  const { width: windowWidth, fontScale } = useAppWindowDimensions();
  const screenshotModeEnabled = useFeatureStore(
    (state) => state.screenshotModeEnabled
  );

  // Giữ mốc hết hạn tuyệt đối ổn định khi parent re-render vì balance/store đổi.
  const timestamp = React.useMemo(
    () => Date.now() + remainingSecs * 1000,
    [remainingSecs]
  );
  const discounted = hasBundleDiscount(bundle.originalPrice, bundle.price);
  const stackedHeader = windowWidth < 360 || fontScale >= 1.4 || formatVp(bundle.price).length > 7;

  /** Độ dài chuỗi giá dài nhất trong bundle — nới cell để giữ trọn chữ số. */
  const maxPriceLength = React.useMemo(
    () => getBundleItemMaxPriceTextLength(bundle.items),
    [bundle.items]
  );

  /** Chiều rộng item cell ổn định theo viewport/font scale, clamp compact/tablet. */
  const itemWidth = getBundleItemWidth(windowWidth, {
    fontScale,
    maxPriceLength,
  });

  /**
   * heroSource – Ảnh hero của bundle: displayIcon2 → displayIcon →
   * verticalPromoImage. Cache key kèm biến thể nguồn để không tái dùng
   * bitmap của nguồn khác khi dữ liệu đổi. Chế độ screenshot hoặc thiếu
   * ảnh → dùng asset fallback noimage.
   */
  const heroSource = React.useMemo(() => {
    const uri =
      bundle.displayIcon2 || bundle.displayIcon || bundle.verticalPromoImage;
    const variant = bundle.displayIcon2
      ? "displayIcon2"
      : bundle.displayIcon
        ? "displayIcon"
        : bundle.verticalPromoImage
          ? "verticalPromoImage"
          : "fallback";

    if (uri && !screenshotModeEnabled) {
      return { source: { uri }, variant };
    }

    return { source: require("~/assets/images/noimage.png"), variant };
  }, [
    bundle.displayIcon,
    bundle.displayIcon2,
    bundle.verticalPromoImage,
    screenshotModeEnabled,
  ]);

  /** renderItem ổn định theo itemWidth/isOwned — tránh re-mount cell khi countdown tick. */
  const renderItem = React.useCallback(
    ({ item }: { item: SkinShopItem | AccessoryShopItem }) => (
      <BundleItem item={item} width={itemWidth} owned={isOwned(item)} />
    ),
    [itemWidth, isOwned]
  );

  const keyExtractor = React.useCallback(
    (item: SkinShopItem | AccessoryShopItem) => item.uuid,
    []
  );

  /** getItemLayout cho cell độ rộng cố định + gap để scroll ngang mượt. */
  const getItemLayout = React.useCallback(
    (_data: ArrayLike<SkinShopItem | AccessoryShopItem> | null | undefined, index: number) => ({
      length: itemWidth + BUNDLE_CAROUSEL_GAP,
      offset: (itemWidth + BUNDLE_CAROUSEL_GAP) * index,
      index,
    }),
    [itemWidth]
  );

  return (
    <View testID="bundle-card" style={[styles.card, styles.glassCard, SHADOWS.xs]}>
      <LiquidGlassDecoration radius={RADIUS.card} tone="light" />
      {/* Hero artwork: khung cố định, artwork upstream tự tối — nền khung vẫn sáng */}
      <View
        style={styles.imageFrame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          cacheId={`bundle:${bundle.uuid}:hero:${heroSource.variant}`}
          source={heroSource.source}
          style={styles.heroImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={140}
          recyclingKey={bundle.uuid}
        />
      </View>

      <View style={styles.content}>
        {/* Title + cột giá cố định bên phải; title co lại để bảo vệ chữ số giá */}
        <View style={[styles.titleRow, stackedHeader && styles.stackedHeader]}>
          <View style={[styles.headerInfo, stackedHeader && styles.stackedHeaderInfo]}>
          <Text style={styles.title} numberOfLines={2}>
            {bundle.displayName}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaTimeGroup}>
              <AppIcon name="timer" size={13} color={COLORS.TEXT_SECONDARY} decorative />
              {remainingSecs > 0 ? (
                <Text style={styles.metaText}>{t("bundles_page.ends_in")}</Text>
              ) : null}
              <Countdown timestamp={timestamp} format="bundle" endedLabel={t("bundles_page.ended")}
                color={COLORS.TEXT_SECONDARY} showIcon={false} textStyle={styles.metaText} />
            </View>
            <View style={styles.metaCountGroup}>
              <Text style={styles.metaDivider}>·</Text>
              <Text style={styles.metaText}>
                {t("bundles_page.items_count", { count: bundle.items.length })}
              </Text>
            </View>
          </View>
          </View>
          <View style={[styles.priceBlock, stackedHeader && styles.stackedPriceBlock]}>
            {discounted && bundle.originalPrice !== undefined ? (
              <View style={styles.priceValue}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <CurrencyIcon icon="vp" style={[styles.currencyIcon, styles.oldCurrencyIcon]} />
                </View>
              <Text style={styles.oldPrice} numberOfLines={1}>
                {formatVp(bundle.originalPrice)}
              </Text>
              </View>
            ) : null}
            <View
              style={styles.priceValue}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${formatVp(bundle.price)} VP`}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <CurrencyIcon icon="vp" style={styles.currencyIcon} />
              </View>
              <Text style={styles.priceText} numberOfLines={1}>
                {formatVp(bundle.price)}
              </Text>
            </View>
          </View>
        </View>

      </View>

      {/* Carousel item ngang, không wrap, không nút mũi tên */}
      <FlatList
        testID="bundle-item-carousel"
        accessible={false}
        horizontal
        data={bundle.items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={CarouselSeparator}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.carouselContent}
        style={styles.carousel}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – toàn bộ dùng token sáng (SURFACE/BACKGROUND/SURFACE_MUTED)
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  glassCard: {
    borderColor: BUNDLE_SURFACE_BORDER.color,
    borderWidth: BUNDLE_SURFACE_BORDER.width,
  },
  // card – card chính: nền trắng, viền mờ, bo góc card, overflow giữ carousel
  card: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    overflow: "hidden",
  },
  // imageFrame – khung hero (tỉ lệ 2.40:1), nền xám nhạt giữ chỗ khi thiếu ảnh
  imageFrame: {
    aspectRatio: HERO_ASPECT_RATIO,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderBottomColor: COLORS.BORDER,
    borderBottomWidth: 1,
  },
  // heroImage – ảnh hero full khung
  heroImage: {
    width: "100%",
    height: "100%",
  },
  // content – vùng thông tin dưới hero
  content: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  // titleRow – tên bundle + cột giá
  titleRow: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  stackedHeader: { flexDirection: "column" },
  headerInfo: { flex: 1, minWidth: 0 },
  stackedHeaderInfo: { flex: 0, width: "100%" },
  // title – tên bundle, co lại khi dài để không đè cột giá
  title: {
    color: COLORS.TEXT_PRIMARY,
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
  },
  // priceBlock – cột giá bên phải: giá gốc bị gạch (nếu giảm) trên giá hiện tại
  priceBlock: {
    alignItems: "flex-end",
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  stackedPriceBlock: { alignSelf: "flex-end" },
  // oldPrice – giá base bị gạch ngang, chỉ render khi > giá hiện tại
  oldPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    marginBottom: 2,
    textDecorationLine: "line-through",
  },
  // priceValue – chip giá hiện tại
  priceValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencyIcon: {
    width: 13,
    height: 13,
    marginRight: 4,
    tintColor: COLORS.TEXT_PRIMARY,
  },
  oldCurrencyIcon: { tintColor: COLORS.TEXT_SECONDARY },
  // priceText – giá VP hiện tại
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "900",
  },
  // metaRow – đồng hồ + prefix + số item, wrap an toàn ở vùng hẹp
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  metaTimeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xxs,
  },
  // metaCountGroup – dấu · nhóm cùng số item để không wrap rời rạc
  metaCountGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
  },
  // metaText – chữ meta phụ
  metaText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
  },
  // metaDivider – dấu phân cách meta
  metaDivider: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: "600",
  },
  // carousel – danh sách item ngang full-bleed trong card
  carousel: {
    flexGrow: 0,
  },
  // carouselContent – padding ngang để cell cuối không dính mép card
  carouselContent: {
    paddingHorizontal: BUNDLE_CAROUSEL_CONTENT_PADDING,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
});

export default BundleImage;
