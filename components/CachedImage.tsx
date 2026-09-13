// ===== CachedImage.tsx =====
// Wrapper chuẩn hoá cho expo-image: mọi ảnh mạng trong app nên đi qua component
// này để có cache key ổn định (cacheId) và cache policy thống nhất memory-disk.
import React from "react";
import { Image as ExpoImage, type ImageProps } from "expo-image";

import {
  getManagedImageSource,
  type ImageCacheId,
} from "~/utils/image-cache";

/**
 * CachedImageProps – Props của CachedImage.
 * Kế thừa toàn bộ ImageProps của expo-image, bổ sung cacheId.
 *
 * @param cacheId – (tuỳ chọn) Cache key ổn định dùng cho image-cache
 *                  (định dạng gợi ý: "<loai>:<uuid>:<thuoc-tinh>").
 */
export type CachedImageProps = ImageProps & {
  cacheId?: ImageCacheId;
};

/**
 * CachedImageComponent – Component nội bộ hiển thị ảnh với cache được quản lý.
 * Tính toán source qua getManagedImageSource (resolve uri/cacheId) rồi render
 * ExpoImage với cachePolicy mặc định "memory-disk".
 *
 * @param cacheId – Cache key ổn định (xem CachedImageProps).
 * @param cachePolicy – Chính sách cache expo-image, mặc định "memory-disk".
 * @param source – Nguồn ảnh gốc (uri hoặc require) trước khi được quản lý.
 * @param props – Các ImageProps còn lại (style, contentFit, onLoadEnd...) được
 *                forward nguyên ven xuống ExpoImage.
 * @returns Ảnh expo-image với source đã được quản lý bởi image-cache.
 */
function CachedImageComponent({
  cacheId,
  cachePolicy = "memory-disk",
  source,
  ...props
}: CachedImageProps) {
  const managedSource = React.useMemo(
    () => getManagedImageSource(source, cacheId),
    [cacheId, source]
  );

  return (
    <ExpoImage
      {...props}
      source={managedSource}
      cachePolicy={cachePolicy}
    />
  );
}

/**
 * CachedImage – Phiên bản memo hoá của CachedImageComponent.
 * Giữ ổn định tham chiếu để tránh re-render khi parent render lại mà props
 * không đổi. Đây là export được các màn hình import và dùng.
 */
export const CachedImage = React.memo(CachedImageComponent);
