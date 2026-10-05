import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";
import * as Haptics from "expo-haptics";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "~/hooks/useAppTranslation";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { buildSkinPreviewMedia } from "~/utils/skin-preview";
import { COLORS, RADIUS, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { WEAPON_NAME_ORDER } from "~/components/GalleryProfile";
import { MOTION_SPRING, MOTION_TIMING } from "~/constants/Motion";
import { FLAT_CARD_STYLE } from "~/components/ui/LiquidGlassSurface";

// ─── SkinShowcaseCardProps ─────────────────────────────────────────────────────
//   - item: đối tượng SkinShopItem chứa thông tin skin
//   - variant: "store" | "bundle" – ảnh hưởng đến text hiển thị loại vũ khí

interface SkinShowcaseCardProps {
  item: SkinShopItem | GalleryItem;
  variant?: "store" | "bundle" | "gallery";
}

/**
 * SkinShowcaseCard – Component thẻ hiển thị skin trong shop, bundle hoặc gallery.
 * Được bọc trong React.memo để tránh re-render không cần thiết.
 *
 * State & Hook:
 *   - t (useTranslation): hàm dịch đa ngôn ngữ
 *   - showMediaPopup (useMediaPopupStore): hàm mở popup xem media (video/ảnh)
 *   - skinIds/toggleSkin (useWishlistStore): trạng thái + toggle wishlist
 *   - screenshotModeEnabled (useFeatureStore): bool chế độ chụp màn hình
 *   - scale/badgeScale (Reanimated): animation nhấn và badge "SAVED"
 *
 * Tương tác: single-tap (sau 220ms) mở preview media; double-tap toggle
 * wishlist kèm haptic Success.
 *
 * @param item – Đối tượng SkinShopItem hoặc GalleryItem chứa thông tin skin.
 * @param variant – "store" | "bundle" | "gallery" (mặc định "store"):
 *                   ảnh hưởng đến footer (giá VP / số chroma) và text loại.
 * @returns Card skin memo hoá (Animated.View + Pressable).
 */
const SkinShowcaseCard = React.memo(function SkinShowcaseCard({
  item,
  variant = "store",
}: SkinShowcaseCardProps) {
  const { t } = useTranslation();
  const showMediaPopup = useMediaPopupStore((state) => state.showMediaPopup);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);
  const reduceMotion = useReducedMotion();
  const compact = variant !== "gallery";
  const [contentPressed, setContentPressed] = React.useState(false);
  // previewTimeoutRef: lưu timeout phân biệt click đơn (preview) vs click
  // đôi (toggle wishlist) trong cửa sổ 220ms
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // wishlistId: UUID dùng cho wishlist (level đầu tiên, fallback item.uuid)
  const wishlistId = item.levels?.[0]?.uuid ?? item.uuid;
  const isFavorited = useWishlistStore((state) =>
    state.skinIds.includes(wishlistId)
  );
  const previousFavoritedRef = useRef(isFavorited);

  const badgeScale = useSharedValue(0);
  const badgeAnimatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: badgeScale.value }] }),
    [],
  );

  // useCallback: handlePreviewPress
  //   - Helper chung giữ cache identity và metadata ảnh/video của skin
  //   - Gọi showMediaPopup để mở popup xem media
  //   - Phụ thuộc: [item, showMediaPopup] để dùng metadata mới nhất
  const handlePreviewPress = useCallback(() => {
    const media = buildSkinPreviewMedia(item);

    if (media.length > 0) {
      showMediaPopup(media, item.displayName);
    }
  }, [item, showMediaPopup]);

  // useEffect: animation badge "SAVED" + haptic khi trạng thái wishlist đổi
  //   - isFavorited: chạy sequence spring (1.2 → 1) trừ khi Reduce Motion;
  //     nếu vừa chuyển từ chưa-fav sang fav thì rung haptic Success một lần
  //   - !isFavorited: thu badge về scale 0 (hoặc ẩn ngay khi Reduce Motion)
  //   - previousFavoritedRef: chặn haptic lặp khi component re-render cùng trạng thái
  //   - Phụ thuộc: [badgeScale, isFavorited, reduceMotion]
  useEffect(() => {
    if (isFavorited) {
      badgeScale.value = reduceMotion
        ? 1
        : withSequence(
            withSpring(1.2, MOTION_SPRING.press),
            withSpring(1, MOTION_SPRING.settle),
          );
      if (!previousFavoritedRef.current) {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    } else {
      badgeScale.value = reduceMotion
        ? 0
        : withTiming(0, MOTION_TIMING.fast);
    }
    previousFavoritedRef.current = isFavorited;
  }, [badgeScale, isFavorited, reduceMotion]);

  // useMemo: tier
  //   - Lấy thông tin hiển thị của content tier (màu sắc, nhãn, ...)
  //   - Dùng getContentTierVisual(item.contentTierUuid)
  //   - Phụ thuộc: [item.contentTierUuid]
  const tier = useMemo(
    () => getContentTierVisual(item.contentTierUuid),
    [item.contentTierUuid]
  );

  // useMemo: imageSource
  //   - Tính URI ảnh hiển thị (dùng getDisplayIconUri)
  //   - Nếu có URI và không ở chế độ screenshot => trả về { uri }
  //   - Nếu không => ảnh mặc định noimage.png
  //   - Phụ thuộc: [item, screenshotModeEnabled]
  const imageSource = useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  // useMemo: weaponType
  //   - Xác định loại vũ khí bằng cách so sánh tên skin với WEAPON_NAME_ORDER
  //   - Nếu không tìm thấy, dùng text động theo variant (store/bundle)
  //   - Phụ thuộc: [item.displayName, t, variant]
  const weaponType = useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    return (
      WEAPON_NAME_ORDER.find((weapon) =>
        lowerName.includes(weapon.toLowerCase())
      ) ||
      t(
        variant === "bundle"
          ? "shop_cards.bundle_skin"
          : "shop_cards.store_skin"
      )
    );
  }, [item.displayName, t, variant]);

  // itemPrice: giá VP của item (undefined nếu item đến từ gallery, không có price)
  const itemPrice = "price" in item ? item.price : undefined;
  // useMemo: footer
  //   - gallery  → "Chromas <số lượng>" (không hiển thị giá)
  //   - store/bundle → chuỗi giá, hoặc "--" nếu không có giá
  //   - Phụ thuộc: [item.chromas, itemPrice, t, variant]
  const footer = useMemo(() => {
    if (variant === "gallery") {
      return `${t("chromas")} ${item.chromas?.length ?? 0}`;
    }

    return typeof itemPrice === "number" ? String(itemPrice) : "--";
  }, [item.chromas, itemPrice, t, variant]);

  // useCallback: handleCardPress
  //   - Xử lý sự kiện nhấn vào card
  //   - Double-tap: nếu timeout đã tồn tại (click trước đó trong 220ms) =>
  //     clear timeout và toggle wishlist
  //   - Single-tap: set timeout 220ms, sau đó gọi handlePreviewPress
  //   - Phụ thuộc: [handlePreviewPress, item.levels, item.uuid, toggleSkin]
  const handleCardPress = useCallback(() => {
    setContentPressed(false);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
      toggleSkin(wishlistId);
      return;
    }

    previewTimeoutRef.current = setTimeout(() => {
      previewTimeoutRef.current = null;
      handlePreviewPress();
    }, 220);
  }, [handlePreviewPress, toggleSkin, wishlistId]);

  // useEffect: cleanup timeout khi component unmount
  //   - Tránh memory leak nếu người dùng rời đi trước khi timeout chạy
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.displayName}
        onPress={handleCardPress}
        onPressIn={() => setContentPressed(true)}
        onPressOut={() => setContentPressed(false)}
        style={[
          styles.card,
          FLAT_CARD_STYLE,
          compact && styles.compactTarget,
          {
            borderColor: tier.border, // border theo tier
          },
          contentPressed && styles.galleryPressed,
        ]}
      >
      {/*
        ── imageFrame ───────────────────────────────────────────────────────────
        Khung hình trên: nền theo tier, border dưới theo tier
        Chứa: tierBadge (cấp độ skin), savedBadge (nếu đã yêu thích), ảnh
        */}
      <View
        style={[
          styles.imageFrame,
          compact && styles.compactImageFrame,
          {
            backgroundColor: tier.cardBackground,
            borderBottomColor: tier.border,
          },
        ]}
      >
        <View style={[styles.tierBadge, compact && styles.compactTierBadge, { backgroundColor: tier.badgeBackground }]}>
          <Text style={[styles.tierText, { color: tier.text }]} numberOfLines={1}>
            {tier.label.toUpperCase()}
          </Text>
        </View>
        {isFavorited ? (
          <Animated.View style={[styles.savedBadge, compact && styles.compactSavedBadge, badgeAnimatedStyle]}>
            <Text style={styles.savedBadgeText}>
              {t("shop_cards.saved")}
            </Text>
          </Animated.View>
        ) : null}
        <Image
          cacheId={`skin:${item.uuid}:display`}
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
          transition={0}
          recyclingKey={item.uuid}
        />
      </View>

      {/*
        ── content ──────────────────────────────────────────────────────────────
        Phần nội dung dưới: loại vũ khí, tên skin, giá (kèm icon VP)
        */}
      <View style={[styles.content, compact && styles.compactContent]}>
        <Text style={[styles.weaponTypeText, compact && styles.compactSecondary]} numberOfLines={1}>
          {weaponType}
        </Text>
        <Text
          style={[styles.title, compact && styles.compactTitle]}
          numberOfLines={variant === "bundle" ? undefined : 2}
        >
          {item.displayName}
        </Text>

        <View style={styles.priceRow}>
          <View
            style={[
              styles.priceWrapper,
              compact && styles.compactPriceWrapper,
              {
                backgroundColor: tier.badgeBackground,
                borderColor: tier.border,
              },
            ]}
          >
            {variant !== "gallery" ? (
              <CurrencyIcon
                icon="vp"
                style={[styles.currencyIcon, { tintColor: tier.text }]}
              />
            ) : null}
            <Text style={[styles.priceText, compact && styles.compactPriceText, { color: tier.text }]}>
              {footer}
            </Text>
          </View>
        </View>
      </View>
      </Pressable>
    </View>
  );
});

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Native flat material keeps a single crisp rarity border and clear artwork.
  card: {
    flex: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  galleryPressed: { borderColor: COLORS.BORDER_STRONG },
  // content: padding ngang/dọc cho vùng nội dung
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
  compactTarget: { borderRadius: MORE_GLASS_MATERIAL.radius, minHeight: 48, minWidth: 48 },
  compactImageFrame: { aspectRatio: 1.5, padding: 8 },
  compactContent: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  compactSecondary: { fontSize: 10, marginBottom: 2 },
  compactTitle: { fontSize: 12, lineHeight: 16, minHeight: 32, marginBottom: 4 },
  compactPriceText: { flexShrink: 1, minWidth: 0 },
  compactTierBadge: { left: 4, top: 4, maxWidth: "40%", paddingHorizontal: 4 },
  compactSavedBadge: { right: 4, top: 4, paddingHorizontal: 4 },
  compactPriceWrapper: { paddingHorizontal: 4, paddingVertical: 4, flexWrap: "wrap", maxWidth: "100%" },
  // currencyIcon: icon VP, 13x13
  currencyIcon: {
    width: 13,
    height: 13,
    marginRight: 4,
  },
  // savedBadge: badge "SAVED" góc trên phải, nền đen, absolute
  savedBadge: {
    backgroundColor: COLORS.PURE_BLACK,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 1,
  },
  // savedBadgeText: text trong saved badge, trắng, size 10, bold 900
  savedBadgeText: {
    color: COLORS.PURE_WHITE,
    fontSize: 10,
    fontWeight: "900",
  },
  // imageFrame: khung ảnh tỷ lệ 1.45, border dưới 1px, padding 12, relative
  imageFrame: {
    aspectRatio: 1.45,
    borderBottomWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  // image: ảnh chiếm toàn bộ khung
  image: {
    width: "100%",
    height: "100%",
  },
  // title: tên skin, primary, 13px, bold 800, lineHeight 17, minHeight 34
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,
    marginBottom: 8,
  },
  // priceRow: hàng ngang chứa giá, flex row, space-between, gap 6
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  // priceWrapper: badge giá dạng chip, flex row, bo góc chip, border 1px
  priceWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  // priceText: text giá, 14px, bold 900 (màu lấy từ tier)
  priceText: {
    fontSize: 14,
    fontWeight: "900",
  },
  // tierBadge: badge cấp độ skin, absolute góc trên trái, bo góc 4, zIndex 1
  tierBadge: {
    borderRadius: 4,
    left: 8,
    maxWidth: "56%",
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
    zIndex: 1,
  },
  // tierText: text trong tier badge, 9px, bold 900 (màu lấy từ tier)
  tierText: {
    fontSize: 9,
    fontWeight: "900",
  },
  // weaponTypeText: text loại vũ khí, secondary, 10px, bold 600
  weaponTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 3,
  },
});

export default SkinShowcaseCard;
