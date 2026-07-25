import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import type { ComponentProps } from "react";
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";

import { CachedImage } from "~/components/CachedImage";
import { MATCH_COLORS } from "~/constants/MatchTheme";

type MatchImageProps = {
  uri?: string;
  cacheId?: string;
  style: StyleProp<ImageStyle>;
  icon?: ComponentProps<typeof Icon>["name"];
  iconSize?: number;
  contentFit?: "cover" | "contain";
};

function MatchImageComponent({
  uri,
  cacheId,
  style,
  icon = "image-outline",
  iconSize = 22,
  contentFit = "cover",
}: MatchImageProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [uri]);

  if (!uri || failed) {
    return (
      <View style={[style, styles.fallback]}>
        <Icon name={icon} size={iconSize} color={MATCH_COLORS.textMuted} />
      </View>
    );
  }

  return (
    <CachedImage
      cacheId={cacheId}
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MATCH_COLORS.surfaceSoft,
  },
});

export const MatchImage = React.memo(MatchImageComponent);
