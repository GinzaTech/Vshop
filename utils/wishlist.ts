// Import hàm lấy accessToken từ URI và kiểm tra cùng ngày UTC
import { getAccessTokenFromUri, isSameDayUTC } from "./misc";
// Import AsyncStorage để lưu trữ thời gian kiểm tra wishlist gần nhất
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import axios để gọi API lấy thông tin skin
import axios from "axios";
// Import hook quản lý state wishlist (danh sách skin yêu thích) dùng Zustand persist
import { useWishlistStore } from "~/hooks/useWishlistStore";
// Import Platform để kiểm tra nền tảng (bỏ qua background fetch trên web)
import { Platform } from "react-native";
// Import thư viện background fetch chạy tác vụ ngầm
import BackgroundFetch from "./background-fetch";

// Hằng số: tên channel thông báo cho wishlist
const NOTIFICATION_CHANNEL = "wishlist";
// Biến flag: đánh dấu đã cấu hình notification handler hay chưa
let notificationsConfigured = false;

// Hàm lấy module expo-notifications (dùng require để tránh lỗi import tĩnh khi module chưa available)
// Returns: module expo-notifications đã được import
function getNotifications() {
  return require("expo-notifications") as typeof import("expo-notifications");
}

// Hàm cấu hình notification handler một lần duy nhất
// Thiết lập cách hiển thị thông báo: hiện alert, phát âm thanh, không đặt badge
// Returns: module Notifications đã được cấu hình
function configureNotifications() {
  if (notificationsConfigured) {
    return getNotifications();                      // Đã cấu hình rồi, trả về module
  }

  const Notifications = getNotifications();
  // Thiết lập handler: luôn hiện alert, phát sound, không badge
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationsConfigured = true;
  return Notifications;
}

// Hàm lazy-load các dependencies cần thiết cho wishlist
// Dùng require thay vì import tĩnh để tránh circular dependency
// Returns: object chứa i18n, getVAPILang, plausible, fetchVersion, valorantApi
function getWishlistDependencies() {
  const localization = require("./localization");

  return {
    i18n: localization.default,                          // Hàm dịch thuật
    getVAPILang: localization.getVAPILang as typeof import("./localization").getVAPILang,  // Hàm lấy ngôn ngữ hiện tại
    plausible: require("./plausible") as typeof import("./plausible"),  // Module phân tích (analytics)
    fetchVersion: require("./valorant-assets")
      .fetchVersion as typeof import("./valorant-assets").fetchVersion,  // Hàm lấy version Riot
    valorantApi: require("./valorant-api") as typeof import("./valorant-api"),  // Module API Valorant
  };
}

// Export hàm tác vụ nền (background task) cho wishlist
// Kiểm tra shop mỗi ngày một lần, nếu có skin trong wishlist xuất hiện thì gửi thông báo
// Không nhận tham số, không trả về giá trị (async void)
export async function wishlistBgTask() {
  // Đảm bảo persist store đã được khôi phục từ AsyncStorage
  await useWishlistStore.persist.rehydrate();
  const wishlistStore = useWishlistStore.getState();

  // Nếu người dùng tắt notification wishlist thì thoát
  if (!wishlistStore.notificationEnabled) return;

  // Lấy thời gian kiểm tra gần nhất từ AsyncStorage
  const lastWishlistCheckTs = Number.parseInt(
    (await AsyncStorage.getItem("lastWishlistCheck")) || "0"
  );
  const lastWishlistCheck = new Date(lastWishlistCheckTs);
  const now = new Date();
  if (__DEV__) console.log(
    `Last wishlist check ${lastWishlistCheck}, current date: ${now.getTime()}`
  );

  // Chỉ kiểm tra nếu chưa check hôm nay hoặc chưa bao giờ check
  if (!isSameDayUTC(lastWishlistCheck, now) || lastWishlistCheckTs === 0) {
    const { plausible } = getWishlistDependencies();
    plausible.capture("wishlist_check");                   // Ghi nhận sự kiện analytics

    if (__DEV__) console.log("New day, checking shop in the background");
    await checkShop(wishlistStore.skinIds);                // Kiểm tra shop với danh sách skin yêu thích
    await AsyncStorage.setItem("lastWishlistCheck", now.getTime().toString());  // Cập nhật thời gian check
  }

  if (__DEV__) console.log("No wishlist check needed");
}

// Export hàm kiểm tra shop: gọi API Riot, re-auth, lấy shop, so sánh với wishlist
// Parameters:
//   - wishlist: mảng các UUID của skin cần theo dõi
// Returns: void (async, gửi notification qua expo-notifications)
export async function checkShop(wishlist: string[]) {
  const Notifications = configureNotifications();
  // Lấy các dependencies
  const { fetchVersion, getVAPILang, i18n, valorantApi } =
    getWishlistDependencies();
  const { getEntitlementsToken, getShop, getUserId, reAuth } = valorantApi;

  // Tạo/đảm bảo channel thông báo wishlist tồn tại với mức ưu tiên MAX
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "Wishlist",
    importance: Notifications.AndroidImportance.MAX,
  });

  try {
    // Lấy version hiện tại của Riot client
    const version = await fetchVersion();

    // Re-authenticate để lấy accessToken mới
    // Lưu ý: cần cookie tự động (xem: https://github.com/facebook/react-native/issues/1274)
    const res = await reAuth(version);
    const accessToken = getAccessTokenFromUri(res.data.response.parameters.uri);
    const userId = getUserId(accessToken);

    // Lấy entitlementsToken và region, sau đó gọi API shop
    const entitlementsToken = await getEntitlementsToken(accessToken);
    const region = (await AsyncStorage.getItem("region")) || "eu";
    const shop = await getShop(accessToken, entitlementsToken, region, userId);

    // Duyệt danh sách wishlist, kiểm tra từng skin có trong shop hôm nay không
    var hit = false;
    for (let i = 0; i < wishlist.length; i++) {
      if (shop.SkinsPanelLayout.SingleItemOffers.includes(wishlist[i])) {
        // Skin có trong shop: lấy thông tin chi tiết từ valorant-api.com
        const skinData = await axios.get<{
          status: number;
          data: ValorantSkinLevel;
        }>(
          `https://valorant-api.com/v1/weapons/skinlevels/${
            wishlist[i]
          }?language=${getVAPILang()}`
        );
        // Gửi thông báo: có skin yêu thích trong shop
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t("wishlist.name"),
            body: i18n.t("wishlist.notification.hit", {
              displayname: skinData.data.data.displayName,
            }),
          },
          trigger: {
            channelId: NOTIFICATION_CHANNEL,
            seconds: 1,
          },
        });
        hit = true;
      }
    }
    // Nếu không có skin nào trong wishlist được tìm thấy
    if (!hit) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t("wishlist.name"),
          body: i18n.t("wishlist.notification.no_hit"),
        },
        trigger: {
          channelId: NOTIFICATION_CHANNEL,
          seconds: 1,
        },
      });
    }
  } catch (e) {
    // Xử lý lỗi: gửi thông báo lỗi
    if (__DEV__) console.log(e);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("wishlist.name"),
        body: i18n.t("wishlist.notification.error"),
      },
      trigger: {
        channelId: NOTIFICATION_CHANNEL,
        seconds: 1,
      },
    });
  }
}

// Export hàm khởi tạo background fetch: thiết lập tác vụ nền kiểm tra shop định kỳ
// Chỉ hoạt động trên native (Android/iOS), bỏ qua trên web
// Returns: true nếu khởi tạo thành công, false nếu là web
export async function initBackgroundFetch() {
  if (Platform.OS === "web") {
    return false;                          // Web không hỗ trợ background fetch
  }

  configureNotifications();

  // Cấu hình BackgroundFetch với các tham số:
  // - minimumFetchInterval: 15 phút (tối thiểu)
  // - stopOnTerminate: false (tiếp tục chạy khi app tắt)
  // - enableHeadless: true (chạy headless)
  // - startOnBoot: true (tự động chạy khi khởi động máy)
  // - Các tùy chọn Android: không yêu cầu sạc, không yêu cầu mạng đặc biệt,...
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      enableHeadless: true,
      startOnBoot: true,
      forceAlarmManager: false,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      requiresCharging: false,
      requiresDeviceIdle: false,
      requiresBatteryNotLow: false,
      requiresStorageNotLow: false,
    },
    // Callback chính: chạy tác vụ wishlist nền
    async (taskId: string) => {
      await wishlistBgTask();
      BackgroundFetch.finish(taskId);
    },
    // Callback timeout: kết thúc task khi hết thời gian
    (taskId: string) => {
      if (__DEV__) console.log("[Fetch] TIMEOUT taskId:", taskId);
      BackgroundFetch.finish(taskId);
    }
  );

  return true;
}

// Export hàm dừng background fetch
// Returns: true nếu dừng thành công, false nếu là web
export async function stopBackgroundFetch() {
  if (Platform.OS === "web") {
    return false;
  }

  await BackgroundFetch.stop();
  return true;
}
