
// Export biến defaultUser - đối tượng người dùng mặc định (trống)
// Dùng làm template/initial state cho thông tin người dùng
export let defaultUser = {
  id: "",                              // UUID người dùng
  name: "",                            // Tên hiển thị (GameName)
  TagLine: "",                         // TagLine (ví dụ: #NA1)
  region: "",                          // Khu vực (na, eu, ap, ...)
  shops: {                             // Thông tin shop
    main: [] as SkinShopItem[],         // Shop chính (4 skin hàng ngày)
    bundles: [] as BundleShopItem[],    // Bundle (gói)
    nightMarket: [] as NightMarketItem[], // Night Market
    accessory: [] as AccessoryShopItem[], // Phụ kiện
    remainingSecs: {                    // Thời gian còn lại (giây)
      main: 0,
      bundles: [0],
      nightMarket: 0,
      accessory: 0,
    },
  },
  balances: {                          // Số dư tiền tệ
    vp: 0,                              // Valorant Points (VP)
    rad: 0,                             // Radianite Points
    fag: 0,                             // Free Agent? (có thể là Kingdom Credits cũ)
    kc: 0,                              // Kingdom Credits
  },
  progress: {                          // Tiến trình tài khoản
    level: 0,                           // Cấp độ
    xp: 0,                              // Kinh nghiệm
  },
  ownedSkinIds: [] as string[],        // Danh sách UUID skin đã sở hữu
  accessToken: "",                      // Access token xác thực
  idToken: "",                          // ID token
  entitlementsToken: "",                // Entitlements token
};
