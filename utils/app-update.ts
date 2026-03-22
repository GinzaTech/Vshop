import axios from "axios";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { isExpoGo } from "./runtime";

const FALLBACK_RELEASE_URL = "https://github.com/VShopApp/mobile/releases/latest";

type UpdatesModule = typeof import("expo-updates");

export type UpdateEnvironment = "standalone" | "development" | "expo-go" | "web";

export type AppUpdateCheckResult =
  | {
      kind: "up-to-date";
      currentVersion: string;
      latestVersion?: string;
      releaseUrl: string;
      environment: UpdateEnvironment;
      canUseOta: boolean;
      channel: string | null;
    }
  | {
      kind: "ota-available";
      currentVersion: string;
      latestVersion?: string;
      releaseUrl: string;
      environment: UpdateEnvironment;
      canUseOta: true;
      channel: string | null;
    }
  | {
      kind: "native-update";
      currentVersion: string;
      latestVersion?: string;
      releaseUrl: string;
      environment: UpdateEnvironment;
      canUseOta: boolean;
      channel: string | null;
    }
  | {
      kind: "error";
      currentVersion: string;
      latestVersion?: string;
      releaseUrl: string;
      environment: UpdateEnvironment;
      canUseOta: boolean;
      channel: string | null;
      message: string;
    };

export type ApplyOtaUpdateResult =
  | {
      applied: false;
      message: string;
    }
  | {
      applied: true;
    };

const getUpdatesModule = (): UpdatesModule | null => {
  if (Platform.OS === "web" || isExpoGo) {
    return null;
  }

  try {
    return require("expo-updates") as UpdatesModule;
  } catch (error) {
    console.warn("[updates] expo-updates is unavailable.", error);
    return null;
  }
};

const getUpdateEnvironment = (): UpdateEnvironment => {
  if (Platform.OS === "web") {
    return "web";
  }

  if (isExpoGo) {
    return "expo-go";
  }

  if (__DEV__) {
    return "development";
  }

  return "standalone";
};

const normalizeVersion = (version: string) =>
  version
    .replace(/^[^0-9]+/, "")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^0-9]/g, ""), 10) || 0);

const compareVersions = (left: string, right: string) => {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue < rightValue) {
      return -1;
    }

    if (leftValue > rightValue) {
      return 1;
    }
  }

  return 0;
};

const getCurrentVersion = () =>
  Application.nativeApplicationVersion ||
  Constants.expoConfig?.version ||
  "0.0.0";

const getCurrentBuild = () =>
  Application.nativeBuildVersion ||
  Constants.expoConfig?.ios?.buildNumber ||
  `${Constants.expoConfig?.android?.versionCode ?? ""}`;

const getLatestRelease = async () => {
  const response = await axios.request<{
    tag_name: string;
    html_url?: string;
  }>({
    url: "https://api.github.com/repos/vshopapp/mobile/releases/latest",
    method: "GET",
  });

  return {
    version: response.data.tag_name.replace(/^v/i, ""),
    url: response.data.html_url || FALLBACK_RELEASE_URL,
  };
};

const getSafeErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to check for updates right now.";
};

export const getCurrentAppVersionLabel = () => {
  const version = getCurrentVersion();
  const build = getCurrentBuild();

  if (build) {
    return `v${version} (${build})`;
  }

  return `v${version}`;
};

export const checkForAppUpdate = async (): Promise<AppUpdateCheckResult> => {
  const currentVersion = getCurrentVersion();
  const environment = getUpdateEnvironment();
  const updates = getUpdatesModule();
  const canUseOta = Boolean(updates?.isEnabled) && environment === "standalone";
  const channel = updates?.channel ?? null;

  let latestVersion: string | undefined;
  let releaseUrl = FALLBACK_RELEASE_URL;

  try {
    const release = await getLatestRelease();
    latestVersion = release.version;
    releaseUrl = release.url;
  } catch (error) {
    console.warn("[updates] Failed to fetch latest release.", error);
  }

  if (canUseOta && updates) {
    try {
      const updateResult = await updates.checkForUpdateAsync();

      if (updateResult.isAvailable) {
        return {
          kind: "ota-available",
          currentVersion,
          latestVersion,
          releaseUrl,
          environment,
          canUseOta: true,
          channel,
        };
      }
    } catch (error) {
      if (
        latestVersion &&
        compareVersions(currentVersion, latestVersion) < 0
      ) {
        return {
          kind: "native-update",
          currentVersion,
          latestVersion,
          releaseUrl,
          environment,
          canUseOta,
          channel,
        };
      }

      return {
        kind: "error",
        currentVersion,
        latestVersion,
        releaseUrl,
        environment,
        canUseOta,
        channel,
        message: getSafeErrorMessage(error),
      };
    }
  }

  if (latestVersion && compareVersions(currentVersion, latestVersion) < 0) {
    return {
      kind: "native-update",
      currentVersion,
      latestVersion,
      releaseUrl,
      environment,
      canUseOta,
      channel,
    };
  }

  return {
    kind: "up-to-date",
    currentVersion,
    latestVersion,
    releaseUrl,
    environment,
    canUseOta,
    channel,
  };
};

export const applyOtaUpdate = async (): Promise<ApplyOtaUpdateResult> => {
  const updates = getUpdatesModule();

  if (!updates?.isEnabled || getUpdateEnvironment() !== "standalone") {
    return {
      applied: false,
      message: "In-app updates are not enabled in this build yet.",
    };
  }

  try {
    const fetchResult = await updates.fetchUpdateAsync();

    if (!fetchResult.isNew) {
      return {
        applied: false,
        message: "No new OTA package was downloaded.",
      };
    }

    await updates.reloadAsync();
    return { applied: true };
  } catch (error) {
    return {
      applied: false,
      message: getSafeErrorMessage(error),
    };
  }
};
