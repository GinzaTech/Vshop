import React from "react";

import SkinShowcaseCard from "./SkinShowcaseCard";

interface BundleItemProps {
  item: SkinShopItem;
}

const BundleItem = React.memo(function BundleItem({ item }: BundleItemProps) {
  return <SkinShowcaseCard item={item} subtitle="Included in bundle" />;
});

export default BundleItem;
