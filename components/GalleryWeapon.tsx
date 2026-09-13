import React from "react";

import SkinShowcaseCard from "~/components/SkinShowcaseCard";

/**
 * GalleryWeaponProps – Props của GalleryWeapon.
 *
 * @param item – Item vũ khí trong gallery (GalleryItem) cần hiển thị.
 */
interface GalleryWeaponProps {
  item: GalleryItem;
}

/**
 * GalleryWeapon – Card vũ khí trong gallery, tái dùng renderer của Store
 * (SkinShowcaseCard) với variant="gallery": giữ nguyên preview và double-tap
 * wishlist, nhưng hiển thị số chroma thay vì giá VP.
 *
 * @param item – Item gallery cần render (xem GalleryWeaponProps).
 * @returns SkinShowcaseCard đã cấu hình cho gallery.
 *
 * React.memo comparator: chỉ re-render khi uuid, displayName, contentTierUuid,
 * onWishlist, levels hoặc chromas đổi — bỏ qua thay đổi trường không liên quan.
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
