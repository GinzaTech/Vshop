import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { WEAPON_NAME_ORDER } from "~/components/GalleryProfile";
import { MOTION_SPRING, MOTION_TIMING } from "~/constants/Motion";

// ─── SkinShowcaseCardProps ─────────────────────────────────────────────────────
//   - item: đối tượng SkinShopItem chứa thông tin skin
//   - variant: "store" | "bundle" – ảnh hưởng đến text hiển thị loại vũ khí

interface SkinShowcaseCardProps {
  item: SkinShopItem | GalleryItem;
  variant?: "store" | "bundle" | "gallery";
}

// ─── SkinShowcaseCard ──────────────────────────────────────────────────────────
// Component thẻ hiển thị skin trong shop hoặc bundle.
// Được bọc trong React.memo để tránh re-render không cần thiết.
//
// State & Hook:
//   - t (useTranslation): hàm dịch đa ngôn ngữ
//   - showMediaPopup (useMediaPopupStore): hàm mở popup xem media (video/ảnh)
//   - skinIds (useWishlistStore): mảng chứa UUID các skin đã yêu thích
//   - toggleSkin (useWishlistStore): hàm thêm/xoá skin khỏi wishlist
//   - screenshotModeEnabled (useFeatureStore): bool chế độ chụp màn hình

// useRef:
//   - previewTimeoutRef: lưu timeout để phân biệt click đơn vs click đôi
//     (double-tap để toggle wishlist, single-tap sau 220ms để preview)

const SkinShowcaseCard = React.memo(function SkinShowcaseCard({
  item,
  variant = "store",
}: SkinShowcaseCardProps) {
  const { t } = useTranslation();
  const showMediaPopup = useMediaPopupStore((state) => state.showMediaPopup);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);
  const reduceMotion = useReducedMotion();
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistId = item.levels?.[0]?.uuid ?? item.uuid;
  const isFavorited = useWishlistStore((state) =>
    state.skinIds.includes(wishlistId)
  );
  const previousFavoritedRef = useRef(isFavorited);

  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(0);
  const cardAnimatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [],
  );
  const badgeAnimatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: badgeScale.value }] }),
    [],
  );

  // useCallback: handlePreviewPress
  //   - Tập hợp danh sách media từ levels (video/icon) và chromas (video/render)
  //   - Lọc bỏ entry không có URI
  //   - Gọi showMediaPopup để mở popup xem media
  //   - Phụ thuộc: [item.chromas, item.displayName, item.levels, showMediaPopup]
  const handlePreviewPress = useCallback(() => {
    const media = [
      ...(item.levels ?? []).map((level) => ({
        cacheId: `skin-level:${level.uuid}:media`,
        group: "level" as const,
        kind: level.streamedVideo ? ("video" as const) : ("image" as const),
        label: level.displayName,
        uri: level.streamedVideo || level.displayIcon || "",
      })),
      ...(item.chromas ?? []).map((chroma) => ({
        cacheId: `skin-chroma:${chroma.uuid}:media`,
        group: "chroma" as const,
        kind: chroma.streamedVideo ? ("video" as const) : ("image" as const),
        label: chroma.displayName,
        uri: chroma.streamedVideo || chroma.fullRender || "",
      })),
    ].filter((entry) => Boolean(entry.uri));

    if (media.length > 0) {
      showMediaPopup(media, item.displayName);
    }
  }, [item.chromas, item.displayName, item.levels, showMediaPopup]);

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

  const itemPrice = "price" in item ? item.price : undefined;
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
    <Animated.View style={[styles.container, cardAnimatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.displayName}
        onPress={handleCardPress}
        onPressIn={() => {
          scale.value = reduceMotion
            ? 1
            : withSpring(0.97, MOTION_SPRING.press);
        }}
        onPressOut={() => {
          scale.value = reduceMotion
            ? 1
            : withSpring(1, MOTION_SPRING.settle);
        }}
        style={[
          styles.card,
          {
            borderColor: tier.border, // border theo tier
          },
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
          {
            backgroundColor: tier.cardBackground,
            borderBottomColor: tier.border,
          },
        ]}
      >
        <View style={[styles.tierBadge, { backgroundColor: tier.badgeBackground }]}>
          <Text style={[styles.tierText, { color: tier.text }]} numberOfLines={1}>
            {tier.label.toUpperCase()}
          </Text>
        </View>
        {isFavorited ? (
          <Animated.View style={[styles.savedBadge, badgeAnimatedStyle]}>
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
          transition={reduceMotion ? 0 : 120}
          recyclingKey={item.uuid}
        />
      </View>

      {/*
        ── content ──────────────────────────────────────────────────────────────
        Phần nội dung dưới: loại vũ khí, tên skin, giá (kèm icon VP)
        */}
      <View style={styles.content}>
        <Text style={styles.weaponTypeText} numberOfLines={1}>
          {weaponType}
        </Text>
        <Text
          style={styles.title}
          numberOfLines={variant === "bundle" ? undefined : 2}
        >
          {item.displayName}
        </Text>

        <View style={styles.priceRow}>
          <View
            style={[
              styles.priceWrapper,
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
            <Text style={[styles.priceText, { color: tier.text }]}>
              {footer}
            </Text>
          </View>
        </View>
      </View>
      </Pressable>
    </Animated.View>
  );
});

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // card: thẻ chính, flex 1, nền SURFACE, bo góc 8, border 1px, overflow hidden
  card: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  // cardPressed: hiệu ứng khi nhấn - giảm opacity
  cardPressed: {
    opacity: 0.86,
  },
  // content: padding ngang/dọc cho vùng nội dung
  content: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
  },
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
