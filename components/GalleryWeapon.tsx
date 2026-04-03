import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Divider, IconButton, Menu } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";

import GlassCard from "~/components/ui/GlassCard";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";

interface props {
  item: GalleryItem;
  toggleFromWishlist: Function;
}

export default function GalleryWeapon(props: React.PropsWithChildren<props>) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const tier = getContentTierVisual(props.item.contentTierUuid);
  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(props.item);

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [props.item, screenshotModeEnabled]);

  return (
    <View style={styles.wrapper}>
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: tier.cardBackground,
            borderColor: tier.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {tier.label}
          </Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-horizontal"
                size={18}
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                props.toggleFromWishlist(props.item.levels[0].uuid);
              }}
              title={props.item.onWishlist ? t("wishlist.remove") : t("wishlist.add")}
              icon={props.item.onWishlist ? "minus" : "plus"}
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                showMediaPopup(
                  props.item.levels.map(
                    (level) => level.streamedVideo || level.displayIcon || ""
                  ),
                  t("levels")
                );
              }}
              title={t("levels")}
              icon="arrow-up-bold"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                showMediaPopup(
                  props.item.chromas.map(
                    (chroma) => chroma.streamedVideo || chroma.fullRender
                  ),
                  t("chromas")
                );
              }}
              title={t("chromas")}
              icon="format-color-fill"
            />
          </Menu>
        </View>

        <Pressable
          onPress={() => {
            showMediaPopup(
              props.item.levels.map(
                (level) => level.streamedVideo || level.displayIcon || ""
              ),
              props.item.displayName
            );
          }}
          style={styles.mainContent}
        >
          <View
            style={[
              styles.imageWrap,
              {
                backgroundColor: tier.visualBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Image
              source={imageSource}
              style={styles.image}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
              recyclingKey={props.item.uuid}
            />
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={2}>
              {props.item.displayName}
            </Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.metaPill,
                  {
                    backgroundColor: tier.badgeBackground,
                    borderColor: tier.border,
                  },
                ]}
              >
                <View
                  style={[styles.metaDot, { backgroundColor: tier.accent }]}
                />
                <Text style={[styles.metaText, { color: tier.text }]}>
                  {tier.label}
                </Text>
              </View>
              <View style={styles.metaPill}>
                <Icon
                  name={props.item.onWishlist ? "heart" : "star-outline"}
                  size={12}
                  color={props.item.onWishlist ? COLORS.ACCENT : COLORS.TEXT_SECONDARY}
                />
                <Text style={styles.metaText}>
                  {props.item.onWishlist ? t("wishlist.name") : "Collection"}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    marginBottom: 0,
    minHeight: 244,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  mainContent: {
    flex: 1,
  },
  eyebrow: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    marginRight: 10,
  },
  menuButton: {
    margin: -4,
  },
  imageWrap: {
    width: "100%",
    height: 114,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    marginTop: 12,
    minHeight: 74,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 6,
  },
  metaDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.chip,
  },
  metaText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
  },
});
