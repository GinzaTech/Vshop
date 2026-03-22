import axios from "axios";
import { Platform } from "react-native";

let userAgent: string;
let appVersion: string | undefined;

function getDeviceModule() {
  return require("expo-device") as typeof import("expo-device");
}

function getApplicationModule() {
  return require("expo-application") as typeof import("expo-application");
}

// https://plausible.io/docs/events-api
export async function capture(
  name: "pageview" | "wishlist_check",
  path?: string
) {
  if (
    !process.env.EXPO_PUBLIC_PLAUSIBLE_URL ||
    !process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN
  )
    return;

  if (!userAgent) {
    const Device = getDeviceModule();
    const osName =
      Platform.OS === "android"
        ? "Android"
        : Platform.OS === "ios"
        ? "iOS"
        : null;
    const os = osName ? `${osName} ${Device.osVersion ?? ""}` : null;
    const modelName = Device.modelName;
    const platform = [os, modelName].filter((i) => !!i).join("; ");

    userAgent = `Mozilla/5.0 (${platform}) Gecko/20100101 Chrome/53.0`;
  }

  if (!appVersion) {
    const Application = getApplicationModule();
    appVersion = Application.nativeApplicationVersion || undefined;
  }

  await axios.request({
    url: `${process.env.EXPO_PUBLIC_PLAUSIBLE_URL}/api/event`,
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      "Content-Type": "application/json",
    },
    data: {
      name,
      domain: process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN,
      url: `app://localhost${path ?? ""}`,
      props: {
        app_version: appVersion,
      },
    },
  });
}
