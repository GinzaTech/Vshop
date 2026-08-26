import React from "react";

import SkinShowcaseCard from "~/components/SkinShowcaseCard";

interface GalleryWeaponProps {
  item: GalleryItem;
}

/**
 * Gallery shares Store's skin-card renderer. The gallery variant preserves
 * preview and double-tap wishlist behavior, while showing chroma count instead
 * of a VP price.
 */
const GalleryWeapon = React.memo(function GalleryWeapon({
  item,
}: GalleryWeaponProps) {
  return <SkinShowcaseCard item={item} variant="gallery" />;
}, (previous, next) =>
  previous.item.uuid === next.item.uuid &&
  previous.item.displayName === next.item.displayName &&
  previous.item.contentTierUuid === next.item.contentTierUuid &&
  previous.item.onWishlist === next.item.onWishlist &&
  previous.item.levels === next.item.levels &&
  previous.item.chromas === next.item.chromas
);

export default GalleryWeapon;
