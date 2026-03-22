import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Divider, IconButton, Menu } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import GlassCard from "~/components/ui/GlassCard";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface props {
  item: GalleryItem;
  toggleFromWishlist: Function;
}

export default function GalleryWeapon(props: React.PropsWithChildren<props>) {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();

  return (
    <View style={styles.wrapper}>
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.imageWrap}>
            <Image
              source={getDisplayIcon(props.item, screenshotModeEnabled)}
              style={styles.image}
              resizeMode="contain"
            />
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={2}>
              {props.item.displayName}
            </Text>
            <View style={styles.metaRow}>
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

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-horizontal"
                size={20}
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
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  card: {
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageWrap: {
    width: 112,
    height: 70,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  image: {
    width: 92,
    height: 48,
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  metaText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
  },
});
