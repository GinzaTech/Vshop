// ===== MatchImage.tsx =====
// Ảnh dùng trong các màn hình match (agent, rank, map...): hiển thị ảnh cached,
// tự fallback sang icon khi không có URI hoặc ảnh load lỗi.
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

/**
 * MatchImageProps – Props của MatchImage.
 *
 * @param uri – (tuỳ chọn) URL ảnh; undefined/rỗng → hiển thị icon fallback.
 * @param cacheId – (tuỳ chọn) Cache key ổn định truyền xuống CachedImage.
 * @param style – Style ảnh (cũng dùng cho khối fallback nên cần kích thước).
 * @param icon – (mặc định "image-outline") Icon MaterialCommunityIcons fallback.
 * @param iconSize – (mặc định 22) Kích thước icon fallback.
 * @param contentFit – (mặc định "cover") Kiểu fit ảnh trong khung.
 */
type MatchImageProps = {
  uri?: string;
  cacheId?: string;
  style: StyleProp<ImageStyle>;
  icon?: ComponentProps<typeof Icon>["name"];
  iconSize?: number;
  contentFit?: "cover" | "contain";
};

/**
 * MatchImageComponent – Component nội bộ render ảnh hoặc icon fallback.
 * State `failed` bật khi CachedImage báo onError; effect reset `failed` về
 * false mỗi khi uri đổi để thử load lại. Không có timer/subscription.
 *
 * @param uri – URL ảnh (tuỳ chọn).
 * @param cacheId – Cache key cho CachedImage (tuỳ chọn).
 * @param style – Style áp cho cả ảnh và khối fallback.
 * @param icon – Icon thay thế khi thiếu ảnh/lỗi.
 * @param iconSize – Kích thước icon fallback.
 * @param contentFit – Kiểu fit ảnh.
 * @returns View icon fallback, hoặc CachedImage khi ảnh khả dụng.
 */
function MatchImageComponent({
  uri,
  cacheId,
  style,
  icon = "image-outline",
  iconSize = 22,
  contentFit = "cover",
}: MatchImageProps) {
  // failed: cờ ảnh load lỗi → chuyển sang icon fallback
  const [failed, setFailed] = React.useState(false);

  // Effect: reset failed khi uri đổi (cho phép thử load ảnh mới)
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

/**
 * MatchImage – Export memo hoá để dùng trong các danh sách match.
 */
export const MatchImage = React.memo(MatchImageComponent);
