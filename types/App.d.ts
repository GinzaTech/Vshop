// ====== App.d.ts – Định nghĩa kiểu dữ liệu (TypeScript interfaces) cho toàn ứng dụng ======

/**
 * SkinShopItem – Một skin trong cửa hàng (kế thừa ValorantSkin + giá tiền).
 * @extends ValorantSkin – Kế thừa toàn bộ thuộc tính của ValorantSkin (tên, icon, tier…).
 * @param price – Giá skin trong cửa hàng (VP).
 */
interface SkinShopItem extends ValorantSkin {
  price: number;
}

/**
 * AccessoryShopItem – Một phụ kiện trong cửa hàng (không phải skin).
 * @param uuid          – UUID định danh duy nhất.
 * @param displayName   – Tên hiển thị của phụ kiện.
 * @param displayIcon   – (tuỳ chọn) Đường dẫn icon.
 * @param price         – Giá phụ kiện (VP).
 */
interface AccessoryShopItem {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  price: number;
}

/**
 * GalleryItem – Một skin trong bộ sưu tập (Gallery), kế thừa ValorantSkin + trạng thái wishlist.
 * @extends ValorantSkin – Kế thừa toàn bộ thuộc tính của ValorantSkin.
 * @param onWishlist – boolean đánh dấu skin đã được thêm vào wishlist hay chưa.
 */
interface GalleryItem extends ValorantSkin {
  onWishlist: boolean;
}

/**
 * NightMarketItem – Một mặt hàng trong Night Market (giảm giá).
 * @extends SkinShopItem – Kế thừa SkinShopItem (đã có price từ ValorantSkin).
 * @param discountedPrice – Giá sau khi giảm.
 * @param discountPercent – Phần trăm giảm giá (vd: 49 nghĩa là giảm 49%).
 */
interface NightMarketItem extends SkinShopItem {
  discountedPrice: number;
  discountPercent: number;
}

/**
 * BundleShopItem – Một bundle (gói) trong cửa hàng.
 * @extends ValorantBundle – Kế thừa ValorantBundle (tên, icon…).
 * @param price – Tổng giá của bundle.
 * @param items – Mảng các item trong bundle, mỗi item có thể là SkinShopItem hoặc AccessoryShopItem.
 */
interface BundleShopItem extends ValorantBundle {
  price: number;
  items: (SkinShopItem | AccessoryShopItem)[];
}

/**
 * Balance – Số dư tài khoản người dùng.
 * @param vp  – Số dư VP (Valorant Points).
 * @param rad – Số dư RAD (Radianite Points).
 * @param fag – Số dư FAG (Free Agent – đơn vị không chính thức, có thể dùng cho mục đích khác).
 */
interface Balance {
  vp: number;
  rad: number;
  fag: number;
}

/**
 * Progress – Cấp độ và kinh nghiệm người dùng.
 * @param level – Cấp độ hiện tại.
 * @param xp    – Kinh nghiệm hiện tại.
 */
interface Progress {
  level: number;
  xp: number;
}