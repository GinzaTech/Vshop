// Import helper kiểm tra cùng ngày UTC
import { isSameDayUTC } from "./misc";
// Import AsyncStorage để lưu trữ thời gian kiểm tra wishlist gần nhất
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import axios để gọi API lấy thông tin skin
import { getPublicSkinLevel } from "~/services/valorant/public-api";
// Import hook quản lý state wishlist (danh sách skin yêu thích) dùng Zustand persist
import { useWishlistStore } from "~/hooks/useWishlistStore";
// Import Platform để kiểm tra nền tảng (bỏ qua background fetch trên web)
// Import AppState để kiểm tra app foreground/background (fix L14)
import { AppState, Platform } from "react-native";
// Import thư viện background fetch chạy tác vụ ngầm
import BackgroundFetch from "./background-fetch";
import { useUserStore } from "~/hooks/useUserStore";
import { useAccountStore } from "~/hooks/useAccountStore";
import { isSessionRecoveryPaused, renewSavedAccountSession } from "~/services/accounts/session";
import { hasReusableAccessToken, isReauthenticationRequiredError, shouldProactivelyRefreshToken } from "./auth-session";
import { isRiotAuthenticationError, isTransientNetworkError } from "./session-events";
import { getAccountSessionKey } from "./saved-accounts";
import { isSessionChangedError } from "./session-operations";

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
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationsConfigured = true;
  return Notifications;
}

// Hàm lazy-load các dependencies cần thiết cho wishlist
// Dùng require thay vì import tĩnh để tránh circular dependency
// Returns: object chứa i18n, getVAPILang, plausible và valorantApi
function getWishlistDependencies() {
  const localization = require("./localization");

  return {
    i18n: localization.default,                          // Hàm dịch thuật
    getVAPILang: localization.getVAPILang as typeof import("./localization").getVAPILang,  // Hàm lấy ngôn ngữ hiện tại
    plausible: require("./plausible") as typeof import("./plausible"),  // Module phân tích (analytics)
    valorantApi: require("./valorant-api") as typeof import("./valorant-api"),  // Module API Valorant
  };
}

// Export hàm tác vụ nền (background task) cho wishlist
// Kiểm tra shop mỗi ngày một lần, nếu có skin trong wishlist xuất hiện thì gửi thông báo
// Không nhận tham số, không trả về giá trị (async void)
export async function wishlistBgTask() {
  // Đảm bảo persist store đã được khôi phục từ AsyncStorage
  await Promise.all([
    !useWishlistStore.persist.hasHydrated() && useWishlistStore.persist.rehydrate(),
    !useUserStore.persist.hasHydrated() && useUserStore.persist.rehydrate(),
    !useAccountStore.persist.hasHydrated() && useAccountStore.persist.rehydrate(),
  ]);
  const wishlistStore = useWishlistStore.getState();

  // Nếu người dùng tắt notification wishlist thì thoát
  if (!wishlistStore.notificationEnabled || isSessionRecoveryPaused()) return;
  const accountKey = getAccountSessionKey(useUserStore.getState().user);
  if (accountKey === "guest") return;
  const checkStorageKey = `lastWishlistCheck:${accountKey}`;

  // Lấy thời gian kiểm tra gần nhất từ AsyncStorage
  const lastWishlistCheckTs = Number.parseInt(
    (await AsyncStorage.getItem(checkStorageKey)) || "0"
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
    const checked = await checkShop(wishlistStore.skinIds);
    if (checked && getAccountSessionKey(useUserStore.getState().user) === accountKey) {
      await AsyncStorage.setItem(checkStorageKey, now.getTime().toString());
    }
  }

  if (__DEV__) console.log("No wishlist check needed");
}

// FIX (L14): in-flight guard — Android có thể chạy background-fetch callback
// ngay cả khi app đang foreground; không guard thì 2 checkShop chạy song song
// (double getShop + thông báo trùng).
let checkShopInFlight = false;

// Export hàm kiểm tra shop: gọi API Riot, re-auth, lấy shop, so sánh với wishlist
// Parameters:
//   - wishlist: mảng các UUID của skin cần theo dõi
// Returns: boolean — true nếu chuỗi kiểm tra chạy trót lọt (kể cả không hit),
//   false nếu bị chặn (đang phục hồi session, check đang chạy, lỗi phiên...)
export async function checkShop(wishlist: string[]) {
  if (isSessionRecoveryPaused()) return false;
  if (checkShopInFlight) return false;
  checkShopInFlight = true;
  try {
    return await checkShopInternal(wishlist);
  } finally {
    checkShopInFlight = false;
  }
}

// checkShopInternal — Thân chính của checkShop (đã có in-flight guard).
// Luồng: đảm bảo phiên hợp lệ (renew nếu cần) → lấy shop → so với wishlist
// → gửi notification cho từng skin trùng. Before ghi notification, kiểm tra
// lại accountKey để không spam thông báo của phiên cũ; lỗi phiên/cookie hết
// hạn được nuốt im lặng để nhường flow /reauth.
// Parameters:
//   - wishlist: mảng UUID skin cần theo dõi
// Returns: boolean — true nếu chạy xong chuỗi kiểm tra, false nếu bị chặn/lỗi
async function checkShopInternal(wishlist: string[]) {
  if (isSessionRecoveryPaused()) return false;
  const Notifications = configureNotifications();
  // Lấy các dependencies
  const { getVAPILang, i18n, valorantApi } =
    getWishlistDependencies();
  const { getShop } = valorantApi;

  // Tạo/đảm bảo channel thông báo wishlist tồn tại với mức ưu tiên MAX
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "Wishlist",
    importance: Notifications.AndroidImportance.MAX,
  });

  try {
    const currentUser = useUserStore.getState().user;
    let authenticatedUser = hasReusableAccessToken(currentUser.accessToken) &&
      !shouldProactivelyRefreshToken(currentUser.accessToken) && currentUser.entitlementsToken
      ? currentUser
      : await renewSavedAccountSession(currentUser);
    const accountKey = getAccountSessionKey(authenticatedUser);
    const region = authenticatedUser.region ||
      (await AsyncStorage.getItem("region")) ||
      "eu";
    const fetchShop = () => getShop(
      authenticatedUser.accessToken,
      authenticatedUser.entitlementsToken,
      region,
      authenticatedUser.id
    );
    const shop = await fetchShop().catch(async (error: unknown) => {
      if (!isRiotAuthenticationError(error)) throw error;
      authenticatedUser = await renewSavedAccountSession(authenticatedUser);
      return fetchShop();
    });
    if (isSessionRecoveryPaused() || getAccountSessionKey(useUserStore.getState().user) !== accountKey) return false;

    // Duyệt danh sách wishlist, kiểm tra từng skin có trong shop hôm nay không
    let hit = false;
    for (let i = 0; i < wishlist.length; i++) {
      if (shop.SkinsPanelLayout.SingleItemOffers.includes(wishlist[i])) {
        // Skin có trong shop: lấy thông tin chi tiết từ valorant-api.com
        const skinData = await getPublicSkinLevel(
          wishlist[i],
          getVAPILang(),
        );
        if (isSessionRecoveryPaused() || getAccountSessionKey(useUserStore.getState().user) !== accountKey) return false;
        // Gửi thông báo: có skin yêu thích trong shop
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t("wishlist.name"),
            body: i18n.t("wishlist.notification.hit", {
              displayname: skinData.displayName,
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
      // FIX (L14): chỉ gửi thông báo "no hit" khi app đang NỀN. App mở,
      // user tự nhìn thấy shop — thông báo "hôm nay không có" chỉ gây spam
      // (trước đây thông báo bắn cả khi đang dùng app foreground).
      const appInForeground = AppState.currentState === "active";
      if (!appInForeground) {
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
    }
    return true;
  } catch (e) {
    if (isSessionRecoveryPaused() || isTransientNetworkError(e) || isSessionChangedError(e)) return false;
    // Cookie hết hạn → cần login tương tác, im lặng chờ flow /reauth thay vì
    // bắn thông báo lỗi gây hoang mang (auth error KHÔNG phải lỗi hệ thống).
    if (isReauthenticationRequiredError(e)) return false;
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
    return false;
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
      try {
        await wishlistBgTask();
      } finally {
        BackgroundFetch.finish(taskId);
      }
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
