// 📦 BundleImage.tsx – Bundle detail card nền trắng theo layout tham chiếu Champions:
// hero artwork → title + giá thật (base bị gạch khi giảm) → timer + số item →
// estimate copy → carousel item compact cuộn ngang. Không còn onPress/modal;
// toàn bộ item hiển thị inline nên card tự chứa toàn bộ thông tin bundle.

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
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import {
  formatVp,
  getBundleItemWidth,
  hasBundleDiscount,
} from "~/utils/bundle-display";

interface BundleImageProps {
  bundle: BundleShopItem;
  remainingSecs: number;
}

/** Khoảng cách ngang giữa các item cell trong carousel (dp). */
const CAROUSEL_GAP = 10;

/** Separator cố định giữa các cell — tham chiếu module-level để FlatList không tạo lại. */
function CarouselSeparator() {
  return <View style={{ width: CAROUSEL_GAP }} />;
}

/**
 * BundleImage – Card chi tiết bundle inline (nền trắng/sáng).
 * @param bundle – Đối tượng BundleShopItem (displayName, displayIcon, items, price, originalPrice…).
 * @param remainingSecs – Số giây còn lại trước khi bundle hết hạn.
 */
function BundleImage({ bundle, remainingSecs }: BundleImageProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useAppWindowDimensions();
  const screenshotModeEnabled = useFeatureStore(
    (state) => state.screenshotModeEnabled
  );

  // Giữ mốc hết hạn tuyệt đối ổn định khi parent re-render vì balance/store đổi.
  const timestamp = React.useMemo(
    () => Date.now() + remainingSecs * 1000,
    [remainingSecs]
  );
  const discounted = hasBundleDiscount(bundle.originalPrice, bundle.price);

  /** Chiều rộng item cell ổn định, clamp theo compact/tablet. */
  const itemWidth = getBundleItemWidth(windowWidth);

  /**
   * heroSource – Ảnh hero của bundle: displayIcon → displayIcon2 → verticalPromoImage.
   * Chế độ screenshot hoặc thiếu ảnh → dùng asset fallback noimage.
   */
  const heroSource = React.useMemo(() => {
    const uri =
      bundle.displayIcon || bundle.displayIcon2 || bundle.verticalPromoImage;

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [
    bundle.displayIcon,
    bundle.displayIcon2,
    bundle.verticalPromoImage,
    screenshotModeEnabled,
  ]);

  /** renderItem ổn định theo itemWidth — tránh re-mount cell khi countdown tick. */
  const renderItem = React.useCallback(
    ({ item }: { item: SkinShopItem | AccessoryShopItem }) => (
      <BundleItem item={item} width={itemWidth} />
    ),
    [itemWidth]
  );

  const keyExtractor = React.useCallback(
    (item: SkinShopItem | AccessoryShopItem) => item.uuid,
    []
  );

  /** getItemLayout cho cell độ rộng cố định + gap để scroll ngang mượt. */
  const getItemLayout = React.useCallback(
    (_data: ArrayLike<SkinShopItem | AccessoryShopItem> | null | undefined, index: number) => ({
      length: itemWidth + CAROUSEL_GAP,
      offset: (itemWidth + CAROUSEL_GAP) * index,
      index,
    }),
    [itemWidth]
  );

  return (
    <View testID="bundle-card" style={styles.card}>
      {/* Hero artwork: khung cố định, artwork upstream tự tối — nền khung vẫn sáng */}
      <View
        style={styles.imageFrame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
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

      <View style={styles.content}>
        {/* Title + cột giá cố định bên phải */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {bundle.displayName}
          </Text>
          <View style={styles.priceBlock}>
            {discounted && bundle.originalPrice !== undefined ? (
              <Text style={styles.oldPrice} numberOfLines={1}>
                {formatVp(bundle.originalPrice)}
              </Text>
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

        {/* Timer đầy đủ + số item */}
        <View style={styles.metaRow}>
          {remainingSecs > 0 ? (
            <Text style={styles.metaText}>{t("bundles_page.ends_in")}</Text>
          ) : null}
          <Countdown
            timestamp={timestamp}
            format="bundle"
            endedLabel={t("bundles_page.ended")}
            color={COLORS.TEXT_SECONDARY}
            showIcon
            iconSize={13}
            textStyle={styles.metaText}
          />
          <Text style={styles.metaDivider}>·</Text>
          <Text style={styles.metaText}>
            {t("bundles_page.items_count", { count: bundle.items.length })}
          </Text>
        </View>

        {/* Estimate copy */}
        <Text style={styles.estimate}>{t("bundles_page.estimate")}</Text>
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
  // card – card chính: nền trắng, viền mờ, bo góc lớn, overflow giữ carousel trong card
  card: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.screen,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    overflow: "hidden",
  },
  // imageFrame – khung hero (tỉ lệ 1.65:1), nền xám nhạt giữ chỗ khi thiếu ảnh
  imageFrame: {
    aspectRatio: 1.65,
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
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  // titleRow – tên bundle + cột giá
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  // title – tên bundle, co lại khi dài để không đè cột giá
  title: {
    color: COLORS.TEXT_PRIMARY,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  // priceBlock – cột giá bên phải: giá gốc bị gạch (nếu giảm) trên giá hiện tại
  priceBlock: {
    alignItems: "flex-end",
  },
  // oldPrice – giá base bị gạch ngang, chỉ render khi > giá hiện tại
  oldPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
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
  // priceText – giá VP hiện tại
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "900",
  },
  // metaRow – timer + số item
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
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
  // estimate – dòng mô tả giá ước tính
  estimate: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  // carousel – danh sách item ngang full-bleed trong card
  carousel: {
    flexGrow: 0,
  },
  // carouselContent – padding ngang để card cuối không dính mép
  carouselContent: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
});

export default BundleImage;
