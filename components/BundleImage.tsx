// 📦 BundleImage.tsx – Wide Bundle preview on a crisp native light surface:
// hero artwork (tỉ lệ 3.20, ưu tiên displayIcon2) → title + giá thật (base bị
// gạch khi giảm) → đồng hồ đếm ngược TRƯỚC prefix "Ends in" + số item →
// disclosure mặc định đóng, mở carousel compact bên dưới summary khi nhấn.
// isOwned(item) mặc định false khi không có dữ liệu ownership.

import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "~/hooks/useAppTranslation";

import Countdown from "./Countdown";
import BundleItem from "./BundleItem";
import CurrencyIcon from "./CurrencyIcon";
import AppIcon from "~/components/ui/AppIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { BUNDLE_SURFACE_BORDER, COLORS, RADIUS, SPACING, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { FLAT_CARD_STYLE } from "~/components/ui/LiquidGlassSurface";
import { MOTION_TIMING } from "~/constants/Motion";
import { useMotionPreference } from "~/hooks/useMotionPreference";
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
const HERO_ASPECT_RATIO = 3.2;

/**
 * Separator cố định giữa các cell — tham chiếu module-level để FlatList
 * không tạo lại element.
 */
function CarouselSeparator() {
  return <View style={{ width: BUNDLE_CAROUSEL_GAP }} />;
}

/** Keyed by bundle identity; retain list/item owners across open/close and refresh. */
function BundleDisclosure({ bundle, itemWidth, isOwned }: {
  bundle: BundleShopItem;
  itemWidth: number;
  isOwned: BundleOwnershipMatcher;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const reducedMotion = useMotionPreference();
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  React.useEffect(() => {
    cancelAnimation(progress);
    progress.value = reducedMotion
      ? Number(expanded)
      : withTiming(Number(expanded), MOTION_TIMING.standard);
    return () => cancelAnimation(progress);
  }, [expanded, reducedMotion, progress]);

  const revealHeight = useDerivedValue(() => contentHeight.value * progress.value);
  const revealStyle = useAnimatedStyle(() => ({
    height: revealHeight.value,
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -SPACING.sm * (1 - progress.value) }],
  }));
  const measureContent = React.useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    if (nativeEvent.layout.height > 0) contentHeight.value = nativeEvent.layout.height;
  }, [contentHeight]);
  const measureCarousel = React.useCallback((_width: number, height: number) => {
    // Scroll content reports its natural height even if the closed viewport measures zero.
    if (height > 0) contentHeight.value = height;
  }, [contentHeight]);

  const renderItem = React.useCallback(
    ({ item }: { item: SkinShopItem | AccessoryShopItem }) => (
      <BundleItem item={item} width={itemWidth} owned={isOwned(item)} />
    ), [itemWidth, isOwned]
  );
  const keyExtractor = React.useCallback(
    (item: SkinShopItem | AccessoryShopItem) => item.uuid, []
  );
  const getItemLayout = React.useCallback(
    (_data: ArrayLike<SkinShopItem | AccessoryShopItem> | null | undefined, index: number) => ({
      length: itemWidth + BUNDLE_CAROUSEL_GAP,
      offset: (itemWidth + BUNDLE_CAROUSEL_GAP) * index,
      index,
    }), [itemWidth]
  );
  const itemCount = t("bundles_page.items_count", { count: bundle.items.length });

  return (
    <>
      <Pressable
        testID="bundle-item-toggle"
        accessibilityRole="button"
        accessibilityLabel={`${bundle.displayName}, ${itemCount}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.disclosureButton}
      >
        <Text style={styles.metaText}>{itemCount}</Text>
        <AppIcon name={expanded ? "chevronUp" : "chevronDown"} size={18} color={COLORS.TEXT_PRIMARY} decorative />
      </Pressable>
      <Animated.View
        testID="bundle-item-disclosure"
        pointerEvents={expanded ? "auto" : "none"}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        style={[styles.disclosureClip, revealStyle]}
      >
        {/* Absolute content measures its natural height even when the clip is closed. */}
        <Animated.View testID="bundle-item-measure" onLayout={measureContent} style={[styles.disclosureContent, slideStyle]}>
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
            onContentSizeChange={measureCarousel}
            contentContainerStyle={styles.carouselContent}
            style={styles.carousel}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
}

/**
 * BundleImage – Summary visible, compact item carousel disclosed on tap.
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
  const summaryPriceLength = Math.max(
    formatVp(bundle.price).length,
    bundle.originalPrice === undefined ? 0 : formatVp(bundle.originalPrice).length,
  );
  const stackedHeader = windowWidth < 360 || fontScale >= 1.4 || summaryPriceLength > 7;

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

  return (
    <View testID="bundle-card" style={styles.card}>
      <View testID="bundle-summary" style={styles.summary}>
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
          </View>
          <View style={[styles.priceBlock, stackedHeader && styles.stackedPriceBlock]}>
            {discounted && bundle.originalPrice !== undefined ? (
              <View style={styles.priceValue}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <CurrencyIcon icon="vp" style={[styles.currencyIcon, styles.oldCurrencyIcon]} />
                </View>
              <Text style={styles.oldPrice}>
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
              <Text style={styles.priceText}>
                {formatVp(bundle.price)}
              </Text>
            </View>
          </View>
        </View>
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

      </View>
      <BundleDisclosure key={bundle.uuid} bundle={bundle} itemWidth={itemWidth} isOwned={isOwned} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – toàn bộ dùng token sáng (SURFACE/BACKGROUND/SURFACE_MUTED)
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // Native card retains compact geometry and a single crisp outline.
  card: {
    ...FLAT_CARD_STYLE,
    borderColor: BUNDLE_SURFACE_BORDER.color,
    borderWidth: BUNDLE_SURFACE_BORDER.width,
    borderRadius: MORE_GLASS_MATERIAL.radius,
    marginBottom: SPACING.lg,
    overflow: "hidden",
  },
  summary: { flexDirection: "column", gap: SPACING.xs, padding: SPACING.xs, alignItems: "flex-start" },
  // Compact fixed hero band with a light placeholder when artwork is missing.
  imageFrame: {
    width: "100%",
    aspectRatio: HERO_ASPECT_RATIO,
    borderRadius: RADIUS.md,
    overflow: "hidden",
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
    width: "100%",
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 0,
    paddingTop: 0,
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
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  // priceBlock – cột giá bên phải: giá gốc bị gạch (nếu giảm) trên giá hiện tại
  priceBlock: {
    alignItems: "flex-end",
    alignSelf: "flex-start",
    flexShrink: 0,
    maxWidth: "100%",
  },
  stackedPriceBlock: { alignSelf: "flex-end" },
  // oldPrice – giá base bị gạch ngang, chỉ render khi > giá hiện tại
  oldPrice: {
    flexShrink: 1, minWidth: 0,
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
    maxWidth: "100%",
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
    flexShrink: 1, minWidth: 0,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "900",
  },
  // metaRow – đồng hồ + prefix + số item, wrap an toàn ở vùng hẹp
  metaRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
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
  disclosureButton: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.SURFACE,
  },
  disclosureClip: {
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
  },
  disclosureContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
