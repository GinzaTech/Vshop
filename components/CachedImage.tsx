import React from "react";
import { Image as ExpoImage, type ImageProps } from "expo-image";

import {
  getManagedImageSource,
  type ImageCacheId,
} from "~/utils/image-cache";

export type CachedImageProps = ImageProps & {
  cacheId?: ImageCacheId;
};

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

export const CachedImage = React.memo(CachedImageComponent);
