// ===== BundleItem.tsx =====
// Component hiển thị một item trong bundle (gói). Có 2 loại: skin (vũ khí) hoặc accessory (phụ kiện).
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import SkinShowcaseCard from "./SkinShowcaseCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

// Interface định nghĩa props cho BundleItem
// item: SkinShopItem (skin vũ khí) hoặc AccessoryShopItem (phụ kiện)
interface BundleItemProps {
  item: SkinShopItem | AccessoryShopItem;
}

// Hàm kiểm tra xem item có phải là SkinShopItem hay không
// Dùng "levels" in item để phân biệt (SkinShopItem có levels, AccessoryShopItem thì không)
// Trả về: true nếu là SkinShopItem, false nếu là AccessoryShopItem
function isSkinItem(item: SkinShopItem | AccessoryShopItem): item is SkinShopItem {
  return "levels" in item;
}

// BundleItem: Component chính, được memo hóa để tránh re-render không cần thiết
// item: đối tượng shop item cần hiển thị (skin hoặc accessory)
const BundleItem = React.memo(function BundleItem({ item }: BundleItemProps) {
  // Hook dịch thuật i18n
  const { t } = useTranslation();

  // Nếu là skin item, render bằng SkinShowcaseCard với variant="bundle"
  if (isSkinItem(item)) {
    return <SkinShowcaseCard item={item} variant="bundle" />;
  }

  // Nếu là accessory item, render card riêng với layout:
  //   - visualFrame: khung hình chứa ảnh và badge loại
  //   - content: tên, danh mục, giá (VP)
  return (
    <View style={styles.card}>
      <View style={styles.visualFrame}>
        {/* Badge hiển thị "ACCESSORY" ở góc trên bên trái */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText} numberOfLines={1}>
            {t("shop_cards.accessory").toUpperCase()}
          </Text>
        </View>
        {/* Ảnh đại diện của accessory, cache bằng cacheId */}
        <Image
          cacheId={`accessory:${item.uuid}:display`}
          style={styles.image}
          source={
            item.displayIcon
              ? { uri: item.displayIcon }
              : require("~/assets/images/noimage.png")
          }
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="low"
          recyclingKey={item.uuid}
        />
      </View>

      <View style={styles.content}>
        {/* Dòng danh mục: "BUNDLE ACCESSORY" */}
        <Text style={styles.categoryText} numberOfLines={1}>
          {t("shop_cards.bundle_accessory")}
        </Text>
        {/* Tên item, tối đa 2 dòng */}
        <Text style={styles.title} numberOfLines={2}>
          {item.displayName}
        </Text>
        {/* Hàng giá: icon VP + số giá */}
        <View style={styles.priceRow}>
          <View style={styles.priceBadge}>
            <CurrencyIcon icon="vp" style={styles.currencyIcon} />
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

// StyleSheet: Định nghĩa các style cho BundleItem
const styles = StyleSheet.create({
  card: {
    flex: 1,                       // Chiếm toàn bộ không gian có sẵn
    borderRadius: 8,               // Bo góc card
    borderWidth: 1,                // Viền card
    overflow: "hidden",            // Ẩn phần nội dung tràn ra ngoài
    backgroundColor: COLORS.SURFACE, // Màu nền surface
    borderColor: COLORS.WARNING_BORDER, // Màu viền warning (cảnh báo - dành cho bundle)
  },
  content: {
    paddingHorizontal: 10,         // Padding trái/phải
    paddingTop: 9,                // Padding trên
    paddingBottom: 10,            // Padding dưới
  },
  visualFrame: {
    aspectRatio: 1.45,            // Tỷ lệ khung hình (rộng/cao)
    borderBottomWidth: 1,         // Viền dưới
    borderBottomColor: COLORS.WARNING_BORDER,
    padding: 12,                  // Padding đều các bên
    alignItems: "center",         // Căn giữa theo chiều ngang
    justifyContent: "center",     // Căn giữa theo chiều dọc
    backgroundColor: COLORS.WARNING_SURFACE, // Nền màu warning
    position: "relative",         // Để các phần tử absolute trong đó định vị
  },
  image: {
    width: "100%",               // Chiếm toàn bộ chiều rộng frame
    height: "100%",              // Chiếm toàn bộ chiều cao frame
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,                 // Cỡ chữ
    fontWeight: "800",            // Đậm (extra bold)
    lineHeight: 17,               // Khoảng cách dòng
    minHeight: 34,                // Chiều cao tối thiểu (2 dòng)
    marginBottom: 8,
  },
  categoryText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
  },
  priceRow: {
    flexDirection: "row",         // Xếp ngang hàng
    alignItems: "center",         // Căn giữa theo chiều dọc
    justifyContent: "space-between", // Dàn đều 2 đầu
    gap: 6,                       // Khoảng cách giữa các phần tử
  },
  priceBadge: {
    flexDirection: "row",         // Icon + text nằm ngang
    alignItems: "center",
    borderRadius: RADIUS.chip,    // Bo tròn kiểu chip
    borderWidth: 1,
    borderColor: COLORS.WARNING_BORDER,
    backgroundColor: COLORS.WARNING_SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  currencyIcon: {
    width: 13,
    height: 13,
    marginRight: 4,
    tintColor: COLORS.TEXT_PRIMARY, // Màu nhuộm icon
  },
  priceText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "900",            // Siêu đậm
  },
  typeBadge: {
    backgroundColor: "rgba(229, 72, 77, 0.12)", // Nền đỏ mờ (màu Valorant)
    borderRadius: 4,
    left: 8,                      // Cách lề trái 8px
    maxWidth: "56%",              // Giới hạn chiều rộng tối đa
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: "absolute",         // Định vị tuyệt đối trong visualFrame
    top: 8,                       // Cách top 8px
    zIndex: 1,                    // Ưu tiên hiển thị trên ảnh
  },
  typeBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 9,                  // Chữ rất nhỏ
    fontWeight: "900",
  },
});

export default BundleItem;
