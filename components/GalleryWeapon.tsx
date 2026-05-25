import React from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { WEAPON_NAME_ORDER } from "~/components/GalleryProfile";

interface Props {
  item: GalleryItem;
  toggleFromWishlist: Function;
}

export default function GalleryWeapon({
  item,
  toggleFromWishlist,
}: React.PropsWithChildren<Props>) {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const previewTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cardWidth, setCardWidth] = React.useState(0);
  const sweepTranslateX = React.useRef(new Animated.Value(-160)).current;
  const sweepOpacity = React.useRef(new Animated.Value(0)).current;
  const tier = getContentTierVisual(item.contentTierUuid);

  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  const weaponType = React.useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    return (
      WEAPON_NAME_ORDER.find((weapon) =>
        lowerName.includes(weapon.toLowerCase())
      ) || t("shop_cards.store_skin")
    );
  }, [item.displayName, t]);

  const openPreview = React.useCallback(() => {
    const media = [
      ...item.levels.map((level) => level.streamedVideo || level.displayIcon || ""),
      ...item.chromas.map((chroma) => chroma.streamedVideo || chroma.fullRender || ""),
    ].filter(Boolean);

    if (media.length > 0) {
      showMediaPopup(media, item.displayName);
    }
  }, [item.chromas, item.displayName, item.levels, showMediaPopup]);

  const handleCardPress = React.useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
      toggleFromWishlist(item.levels[0].uuid);

      const startX = -Math.max(cardWidth * 0.7, 120);
      sweepTranslateX.stopAnimation();
      sweepOpacity.stopAnimation();
      sweepTranslateX.setValue(startX);
      sweepOpacity.setValue(0);

      Animated.sequence([
        Animated.timing(sweepOpacity, {
          toValue: 0.95,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(sweepOpacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(sweepTranslateX, {
        toValue: cardWidth + 120,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

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

  const handleCardLayout = React.useCallback((event: LayoutChangeEvent) => {
    setCardWidth(event.nativeEvent.layout.width);
  }, []);

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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweepOverlay,
          {
            opacity: sweepOpacity,
            transform: [{ translateX: sweepTranslateX }, { rotate: "14deg" }],
          },
        ]}
      >
        <BlurView intensity={55} tint="light" style={styles.sweepBlur}>
          <View style={styles.sweepTint} />
        </BlurView>
      </Animated.View>

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
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          transition={120}
          recyclingKey={item.uuid}
        />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>

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

const styles = StyleSheet.create({
  card: {
    position: "relative",
    flex: 1,
    minHeight: 238,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.92,
  },
  sweepOverlay: {
    position: "absolute",
    top: -16,
    bottom: -16,
    left: 0,
    width: 92,
    borderRadius: 30,
    overflow: "hidden",
  },
  sweepBlur: {
    flex: 1,
    justifyContent: "center",
  },
  sweepTint: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    flex: 1,
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
    height: 112,
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
    minHeight: 40,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    minWidth: 82,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metaBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
});
