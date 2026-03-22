import React from "react";

import SkinShowcaseCard from "./SkinShowcaseCard";

interface ShopItemProps {
  item: SkinShopItem;
}

const ShopItem = React.memo(function ShopItem({ item }: ShopItemProps) {
  return <SkinShowcaseCard item={item} subtitle="Daily store pick" />;
});

export default ShopItem;
