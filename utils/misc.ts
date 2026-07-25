/**
 * VCurrencies - Đối tượng chứa UUID của các loại tiền tệ trong Valorant
 * Mỗi key là tên viết tắt, value là UUID tương ứng
 * @type {Object}
 */
export const VCurrencies = {
  VP: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741", // Valorant Points - Điểm Valorant
  RAD: "e59aa87c-4cbf-517a-5983-6e81511be9b7", // Radianite Points - Điểm Radianite
  FAG: "f08d4ae3-939c-4576-ab26-09ce1f23bb37", // Free Agents - Điểm Free Agents
  KC: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",  // Kingdom Credits - Tín dụng Kingdom
};

/**
 * VItemTypes - Đối tượng chứa UUID của các loại vật phẩm trong Valorant
 * Mỗi key là tên loại vật phẩm, value là UUID tương ứng
 * @type {Object}
 */
export const VItemTypes = {
  SkinLevel: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",       // Cấp độ skin
  SkinChroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",      // Màu skin (Chroma)
  Agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",           // Đặc vụ (Agent)
  ContractDefinition: "f85cb6f7-33e5-4dc8-b609-ec7212301948", // Hợp đồng (Battle Pass)
  Buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",           // Vật phẩm treo súng (Gun Buddy)
  Spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",           // Hình xăm (Spray)
  Flex: "03a572de-4234-31ed-d344-ababa488f981",             // Flex (thẻ trang trí)
  PlayerCard: "3f296c07-64c3-494c-923b-fe692a4fa1bd",      // Thẻ người chơi (Player Card)
  PlayerTitle: "de7caa6b-adf7-4588-bbd1-143831e786c6",     // Danh hiệu (Player Title)
};

/**
 * regions - Mảng chứa các khu vực Valorant được hỗ trợ
 * eu: Châu Âu, na: Bắc Mỹ, ap: Châu Á - Thái Bình Dương, kr: Hàn Quốc
 * @type {string[]}
 */
export const regions = ["eu", "na", "ap", "kr"];

/**
 * normalizeValorantShard - Chuẩn hóa tên server/khu vực về shard chuẩn của Valorant
 * @param {string | null | undefined} region - Tên khu vực cần chuẩn hóa
 * @returns {string} Tên shard đã chuẩn hóa (VD: "ap", "eu", "na", "kr", "pbe")
 */
export const normalizeValorantShard = (region?: string | null) => {
  const normalized = (region || "").trim().toLowerCase();
  // Bảng ánh xạ từ tên server sang shard chuẩn
  const platformToShard: Record<string, string> = {
    ap: "ap",
    asia: "ap",
    hk: "ap",
    jp: "ap",
    jp1: "ap",
    sea: "ap",
    sg: "ap",
    sg2: "ap",
    th: "ap",
    th1: "ap",
    tw: "ap",
    vn: "ap",
    vn2: "ap",
    eu: "eu",
    eun1: "eu",
    euw1: "eu",
    ru: "eu",
    ru1: "eu",
    tr: "eu",
    tr1: "eu",
    kr: "kr",
    kr1: "kr",
    na: "na",
    na1: "na",
    na2: "na",
    br: "na",
    br1: "na",
    la1: "na",
    la2: "na",
    latam: "na",
    pbe: "pbe",
  };

  return platformToShard[normalized] || normalized;
};

/**
 * getAccessTokenFromUri - Trích xuất access_token từ URI callback
 * @param {string} uri - URI chứa access token (VD: từ Riot login callback)
 * @returns {string} Access token đã trích xuất
 * @throws {Error} Nếu không tìm thấy access_token trong URI
 */
export const getAccessTokenFromUri = (uri: string) => {
  const match = uri.match(/access_token=([^\s&]+)/);
  if (!match) throw new Error("Could not extract access token from uri");
  return match[1];
};

/**
 * getIdTokenFromUri - Trích xuất id_token từ URI callback
 * @param {string} uri - URI chứa id token
 * @returns {string} Id token đã trích xuất
 * @throws {Error} Nếu không tìm thấy id_token trong URI
 */
export const getIdTokenFromUri = (uri: string) => {
  const match = uri.match(/id_token=([^\s&]+)/);
  if (!match) throw new Error("Could not extract id token from uri");
  return match[1];
};

/**
 * getDisplayIcon - Lấy icon hiển thị cho vật phẩm, nếu không có thì trả về ảnh mặc định "noimage"
 * @param {SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem} item - Vật phẩm cần lấy icon
 * @param {boolean} screenshotModeEnabled - Chế độ chụp màn hình (nếu bật thì dùng ảnh thật, không fallback)
 * @returns {Object} Đối tượng chứa URI ảnh hoặc require ảnh mặc định
 */
export const getDisplayIcon = (
  item: SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem,
  screenshotModeEnabled: boolean
) => {
  const imgUri = getDisplayIconUri(item);
  if (imgUri && !screenshotModeEnabled) return { uri: imgUri };
  return require("~/assets/images/noimage.png");
};

/**
 * getDisplayIconUri - Lấy URI icon hiển thị từ vật phẩm
 * @param {SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem} item - Vật phẩm cần lấy URI icon
 * @returns {string | null} URI của icon, hoặc null nếu không có
 */
export const getDisplayIconUri = (
  item: SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem
) => {
  // Nếu vật phẩm có thuộc tính "levels" (skin), ưu tiên lấy từ levels[0].displayIcon
  if ("levels" in item) {
    return (
      item.levels?.[0]?.displayIcon ||
      item.displayIcon ||
      item.chromas?.[0]?.displayIcon ||
      null
    );
  }

  // Vật phẩm thông thường, lấy displayIcon trực tiếp
  return item.displayIcon || null;
};

/**
 * isSameDayUTC - Kiểm tra hai ngày có cùng ngày (theo UTC) hay không
 * @param {Date} d1 - Ngày thứ nhất
 * @param {Date} d2 - Ngày thứ hai
 * @returns {boolean} true nếu hai ngày cùng ngày theo UTC, false nếu khác
 */
export const isSameDayUTC = (d1: Date, d2: Date) => {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
};
