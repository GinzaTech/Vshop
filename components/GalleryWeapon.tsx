// ===== GalleryWeapon.tsx =====
// Component hiển thị một card vũ khí/skin trong thư viện (gallery).
// Hỗ trợ: double-tap để toggle wishlist (với animation sweep), single-tap để xem preview media.
import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { WEAPON_NAME_ORDER } from "~/components/GalleryProfile";
import { MOTION_TIMING } from "~/constants/Motion";

// Props cho GalleryWeapon
// item: đối tượng GalleryItem (chứa thông tin skin vũ khí)
// toggleFromWishlist: hàm callback để toggle wishlist
interface Props {
  item: GalleryItem;
  toggleFromWishlist: Function;
}

export default function GalleryWeapon({
  item,
  toggleFromWishlist,
}: React.PropsWithChildren<Props>) {
  // Hook dịch thuật i18n
  const { t } = useTranslation();
  // showMediaPopup: hàm từ store MediaPopup để hiển thị popup media
  const showMediaPopup = useMediaPopupStore((state) => state.showMediaPopup);
  // screenshotModeEnabled: flag chế độ screenshot từ FeatureStore
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);
  // previewTimeoutRef: ref lưu timeout để phân biệt single-tap vs double-tap (220ms)
  const previewTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // cardWidth: state lưu chiều rộng thực tế của card (đo bằng onLayout)
  const [cardWidth, setCardWidth] = React.useState(0);
  // sweepTranslateX: Animated.Value cho hiệu ứng sweep (quét ngang) khi toggle wishlist
  const sweepTranslateX = useSharedValue(-160);
  // sweepOpacity: Animated.Value cho độ mờ của sweep overlay
  const sweepOpacity = useSharedValue(0);
  const sweepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sweepOpacity.value,
    transform: [
      { translateX: sweepTranslateX.value },
      { rotate: "14deg" },
    ],
  }));
  // tier: thông tin visual của content tier (màu sắc, nhãn) dựa vào contentTierUuid
  const tier = getContentTierVisual(item.contentTierUuid);

  // imageSource: useMemo tính toán nguồn ảnh
  // Lấy URI từ getDisplayIconUri, nếu không có hoặc đang ở chế độ screenshot thì dùng noimage
  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  // weaponType: useMemo xác định loại vũ khí dựa vào tên
  // Dùng WEAPON_NAME_ORDER để tìm tên vũ khí tương ứng trong displayName
  // Nếu không tìm thấy, trả về "shop_cards.store_skin" (đã dịch)
  const weaponType = React.useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    return (
      WEAPON_NAME_ORDER.find((weapon) =>
        lowerName.includes(weapon.toLowerCase())
      ) || t("shop_cards.store_skin")
    );
  }, [item.displayName, t]);

  // openPreview: Callback mở popup preview media (video/ảnh của skin levels và chromas)
  // Gom tất cả media từ levels và chromas, lọc bỏ entry rỗng
  // Gọi showMediaPopup với danh sách URI, tên skin, và cacheId
  const openPreview = React.useCallback(() => {
    const media = [
      ...item.levels.map((level) => ({
        cacheId: `skin-level:${level.uuid}:media`,
        uri: level.streamedVideo || level.displayIcon || "",
      })),
      ...item.chromas.map((chroma) => ({
        cacheId: `skin-chroma:${chroma.uuid}:media`,
        uri: chroma.streamedVideo || chroma.fullRender || "",
      })),
    ].filter((entry) => Boolean(entry.uri));

    if (media.length > 0) {
      showMediaPopup(
        media.map((entry) => entry.uri),
        item.displayName,
        media.map((entry) => entry.cacheId)
      );
    }
  }, [item.chromas, item.displayName, item.levels, showMediaPopup]);

  // handleCardPress: Xử lý nhấn card
  // Logic double-tap: nếu previewTimeoutRef đã tồn tại (đã nhấn lần 1) thì:
  //   - Clear timeout
  //   - Gọi toggleFromWishlist (thêm/xóa wishlist)
  //   - Chạy animation sweep (overlay quét ngang)
  // Nếu chưa có timeout (lần nhấn đầu), set timeout 220ms để chờ xem có nhấn lần 2 không
  //   Sau 220ms nếu không có nhấn lần 2, mở preview
  const handleCardPress = React.useCallback(() => {
    if (previewTimeoutRef.current) {
      // Đã có timeout => đây là lần nhấn thứ 2 => toggle wishlist
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
      toggleFromWishlist(item.levels[0].uuid);

      // Animation sweep: overlay trắng mờ quét từ trái sang phải
      const startX = -Math.max(cardWidth * 0.7, 120);
      cancelAnimation(sweepTranslateX);
      cancelAnimation(sweepOpacity);
      sweepTranslateX.value = startX;
      sweepOpacity.value = 0;

      // Sequence opacity: hiện lên 0.95 (120ms) => tắt dần 0 (360ms)
      sweepOpacity.value = withSequence(
        withTiming(0.95, { ...MOTION_TIMING.fast, duration: 120 }),
        withTiming(0, MOTION_TIMING.emphasized),
      );

      // Translate X: quét từ trái qua phải trong 520ms
      sweepTranslateX.value = withTiming(cardWidth + 120, {
        ...MOTION_TIMING.emphasized,
        duration: 480,
      });
      return;
    }

    // Lần nhấn đầu: set timeout 220ms chờ lần nhấn thứ 2
    previewTimeoutRef.current = setTimeout(() => {
      previewTimeoutRef.current = null;
      openPreview();
    }, 220);
  }, [
    cardWidth,
    item.levels,
    openPreview,
    sweepOpacity,
    sweepTranslateX,
    toggleFromWishlist,
  ]);

  // handleCardLayout: Callback đo chiều rộng card (để tính animation sweep)
  const handleCardLayout = React.useCallback((event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width);
  }, []);

  // useEffect cleanup: Clear timeout khi component unmount
  React.useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Pressable
      onPress={handleCardPress}
      onLayout={handleCardLayout}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        {
          backgroundColor: tier.cardBackground,
          borderColor: tier.border,
        },
      ]}
    >
      {/* Sweep overlay: hiệu ứng quét khi toggle wishlist (BlurView với tint trắng) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweepOverlay,
          sweepAnimatedStyle,
        ]}
      >
        <BlurView intensity={55} tint="light" style={styles.sweepBlur}>
          <View style={styles.sweepTint} />
        </BlurView>
      </Animated.View>

      {/* Header: loại vũ khí + badge "Saved" nếu có trong wishlist */}
      <View style={styles.cardHeader}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {weaponType}
        </Text>
        {item.onWishlist ? (
          <View
            style={[
              styles.savedBadge,
              {
                backgroundColor: tier.badgeBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Text style={[styles.savedBadgeText, { color: tier.text }]}>
              {t("shop_cards.saved")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Khung ảnh skin */}
      <View
        style={[
          styles.visualFrame,
          {
            backgroundColor: tier.visualBackground,
            borderColor: tier.border,
          },
        ]}
      >
        <Image
          cacheId={`skin:${item.uuid}:display`}
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
          transition={120}
          recyclingKey={item.uuid}
        />
      </View>

      {/* Tên skin (tối đa 2 dòng) */}
      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>

      {/* Meta badges: rarity + số chromas */}
      <View style={styles.metaRow}>
        <View
          style={[
            styles.metaBadge,
            {
              backgroundColor: tier.badgeBackground,
              borderColor: tier.border,
            },
          ]}
        >
          <View style={[styles.rarityDot, { backgroundColor: tier.accent }]} />
          <Text style={[styles.metaBadgeText, { color: tier.text }]} numberOfLines={1}>
            {tier.label}
          </Text>
        </View>

        <View
          style={[
            styles.metaBadge,
            {
              backgroundColor: tier.badgeBackground,
              borderColor: tier.border,
            },
          ]}
        >
          <Text style={[styles.metaBadgeText, { color: tier.text }]}>
            {t("chromas")} {item.chromas?.length ?? 0}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// StyleSheet: Định nghĩa các style cho GalleryWeapon
const styles = StyleSheet.create({
  card: {
    position: "relative",           // Để sweep overlay định vị absolute
    flex: 1,
    minHeight: 238,                 // Chiều cao tối thiểu
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",             // Ẩn sweep overlay khi chưa chạy animation
  },
  cardPressed: {
    opacity: 0.92,                  // Giảm độ mờ khi nhấn
  },
  sweepOverlay: {
    position: "absolute",           // Đè lên card
    top: -16,                       // Mở rộng ra ngoài để khi xoay không bị lộ
    bottom: -16,
    left: 0,
    width: 92,                      // Chiều rộng sweep
    borderRadius: 30,
    overflow: "hidden",
  },
  sweepBlur: {
    flex: 1,
    justifyContent: "center",
  },
  sweepTint: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)", // Lớp phủ trắng mờ
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Weapon type bên trái, saved badge bên phải
    marginBottom: 10,
  },
  eyebrow: {
    flex: 1,                        // Chiếm không gian còn lại
    marginRight: 10,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  savedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  visualFrame: {
    width: "100%",
    height: 112,                     // Chiều cao cố định khung ảnh
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  title: {
    marginTop: 12,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    minHeight: 40,                   // Tối thiểu 2 dòng
  },
  metaRow: {
    flexDirection: "row",            // Badge nằm ngang
    flexWrap: "wrap",                // Xuống dòng nếu cần
    gap: 8,
    marginTop: 10,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",         // Không dãn full width
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    minWidth: 82,                    // Đảm bảo đủ rộng cho text
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,                 // Hình tròn
    marginRight: 6,
  },
  metaBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
});
