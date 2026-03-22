import { getAccessTokenFromUri, isSameDayUTC } from "./misc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { Platform } from "react-native";
import BackgroundFetch from "./background-fetch";

const NOTIFICATION_CHANNEL = "wishlist";
let notificationsConfigured = false;

function getNotifications() {
  return require("expo-notifications") as typeof import("expo-notifications");
}

function configureNotifications() {
  if (notificationsConfigured) {
    return getNotifications();
  }

  const Notifications = getNotifications();
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

function getWishlistDependencies() {
  const localization = require("./localization");

  return {
    i18n: localization.default,
    getVAPILang: localization.getVAPILang as typeof import("./localization").getVAPILang,
    plausible: require("./plausible") as typeof import("./plausible"),
    fetchVersion: require("./valorant-assets")
      .fetchVersion as typeof import("./valorant-assets").fetchVersion,
    valorantApi: require("./valorant-api") as typeof import("./valorant-api"),
  };
}

export async function wishlistBgTask() {
  await useWishlistStore.persist.rehydrate();
  const wishlistStore = useWishlistStore.getState();

  if (!wishlistStore.notificationEnabled) return;

  const lastWishlistCheckTs = Number.parseInt(
    (await AsyncStorage.getItem("lastWishlistCheck")) || "0"
  );
  const lastWishlistCheck = new Date(lastWishlistCheckTs);
  const now = new Date();
  console.log(
    `Last wishlist check ${lastWishlistCheck}, current date: ${now.getTime()}`
  );

  if (!isSameDayUTC(lastWishlistCheck, now) || lastWishlistCheckTs === 0) {
    const { plausible } = getWishlistDependencies();
    plausible.capture("wishlist_check");

    console.log("New day, checking shop in the background");
    await checkShop(wishlistStore.skinIds);
    await AsyncStorage.setItem("lastWishlistCheck", now.getTime().toString());
  }

  console.log("No wishlist check needed");
}

export async function checkShop(wishlist: string[]) {
  const Notifications = configureNotifications();
  const { fetchVersion, getVAPILang, i18n, valorantApi } =
    getWishlistDependencies();
  const { getEntitlementsToken, getShop, getUserId, reAuth } = valorantApi;

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "Wishlist",
    importance: Notifications.AndroidImportance.MAX,
  });

  try {
    const version = await fetchVersion();

    // Automatic cookies: https://github.com/facebook/react-native/issues/1274
    const res = await reAuth(version);
    const accessToken = getAccessTokenFromUri(res.data.response.parameters.uri);
    const userId = getUserId(accessToken);

    const entitlementsToken = await getEntitlementsToken(accessToken);
    const region = (await AsyncStorage.getItem("region")) || "eu";
    const shop = await getShop(accessToken, entitlementsToken, region, userId);

    var hit = false;
    for (let i = 0; i < wishlist.length; i++) {
      if (shop.SkinsPanelLayout.SingleItemOffers.includes(wishlist[i])) {
        const skinData = await axios.get<{
          status: number;
          data: ValorantSkinLevel;
        }>(
          `https://valorant-api.com/v1/weapons/skinlevels/${
            wishlist[i]
          }?language=${getVAPILang()}`
        );
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
    console.log(e);
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

export async function initBackgroundFetch() {
  if (Platform.OS === "web") {
    return false;
  }

  configureNotifications();

  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      enableHeadless: true,
      startOnBoot: true,
      // Android options
      forceAlarmManager: false,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      requiresCharging: false,
      requiresDeviceIdle: false,
      requiresBatteryNotLow: false,
      requiresStorageNotLow: false,
    },
    async (taskId: string) => {
      await wishlistBgTask();
      BackgroundFetch.finish(taskId);
    },
    (taskId: string) => {
      console.log("[Fetch] TIMEOUT taskId:", taskId);
      BackgroundFetch.finish(taskId);
    }
  );

  return true;
}

export async function stopBackgroundFetch() {
  if (Platform.OS === "web") {
    return false;
  }

  await BackgroundFetch.stop();
  return true;
}
