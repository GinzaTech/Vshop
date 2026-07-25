import React from "react";

import SkinShowcaseCard from "./SkinShowcaseCard";

// ─── ShopItemProps ─────────────────────────────────────────────────────────────
//   - item: đối tượng SkinShopItem chứa thông tin skin cần hiển thị

interface ShopItemProps {
  item: SkinShopItem;
}

// ─── ShopItem ──────────────────────────────────────────────────────────────────
// Component wrapper đơn giản dùng React.memo để tối ưu re-render.
// Nhiệm vụ duy nhất: render SkinShowcaseCard với variant="store".
//
// React.memo: ghi nhớ kết quả render, chỉ re-render khi props thay đổi
// (so sánh nông - shallow compare)
//
// Props:
//   - item: thông tin skin truyền xuống SkinShowcaseCard
const ShopItem = React.memo(function ShopItem({ item }: ShopItemProps) {
  return <SkinShowcaseCard item={item} variant="store" />;
});

export default ShopItem;
