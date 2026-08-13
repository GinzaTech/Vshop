// Import axios để thực hiện HTTP request
import { publicHttpClient as axios } from "~/services/http/clients";
// Import expo-application để lấy thông tin version app
import * as Application from "expo-application";
// Import expo-constants để lấy cấu hình từ app.json / app.config
import Constants from "expo-constants";
// Import Platform từ react-native để kiểm tra môi trường chạy
import { Platform } from "react-native";

// Import helper kiểm tra có đang chạy trong Expo Go không
import { isExpoGo } from "./runtime";

// URL fallback khi không fetch được release mới nhất từ GitHub API
const FALLBACK_RELEASE_URL = "https://github.com/VShopApp/mobile/releases/latest";

// Type mô tả module expo-updates (dùng để dynamic require)
type UpdatesModule = typeof import("expo-updates");

/**
 * Type mô tả môi trường update:
 * - "standalone": App standalone (production)
 * - "development": Chế độ dev
 * - "expo-go": Chạy trong Expo Go
 * - "web": Chạy trên web
 */
export type UpdateEnvironment = "standalone" | "development" | "expo-go" | "web";

/**
 * Type kết quả kiểm tra update:
 * - "up-to-date": App đã ở phiên bản mới nhất
 * - "ota-available": Có bản OTA update
 * - "native-update": Cần cập nhật native (qua store)
 * - "error": Có lỗi xảy ra khi kiểm tra
 */
export type AppUpdateCheckResult =
  | {
      kind: "up-to-date";
      currentVersion: string;       // Phiên bản hiện tại
      latestVersion?: string;       // Phiên bản mới nhất (nếu biết)
      releaseUrl: string;           // URL release
      environment: UpdateEnvironment;// Môi trường hiện tại
      canUseOta: boolean;           // Có thể OTA không
      channel: string | null;       // Channel cập nhật (VD: production, staging)
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
      message: string; // Thông báo lỗi
    };

/**
 * Type kết quả áp dụng OTA update:
 * - applied: true nếu thành công
 * - applied: false kèm message lỗi nếu thất bại
 */
export type ApplyOtaUpdateResult =
  | {
      applied: false;
      message: string;
    }
  | {
      applied: true;
    };

/**
 * Lấy module expo-updates một cách an toàn.
 * Trả về null nếu đang ở web, Expo Go, hoặc require thất bại.
 * @returns UpdatesModule | null
 */
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

/**
 * Xác định môi trường cập nhật hiện tại.
 * Ưu tiên: web > expo-go > development > standalone.
 * @returns UpdateEnvironment
 */
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

/**
 * Chuẩn hóa chuỗi version thành mảng số để so sánh.
 * VD: "v1.2.3-beta" -> [1, 2, 3]
 * @param version - Chuỗi version cần chuẩn hóa
 * @returns number[] - Mảng các phần số
 */
const normalizeVersion = (version: string) =>
  version
    .replace(/^[^0-9]+/, "")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^0-9]/g, ""), 10) || 0);

/**
 * So sánh hai chuỗi version theo semver.
 * @param left - Version thứ nhất
 * @param right - Version thứ hai
 * @returns -1 nếu left < right, 1 nếu left > right, 0 nếu bằng nhau
 */
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

/**
 * Lấy version hiện tại của ứng dụng.
 * Ưu tiên: nativeApplicationVersion > expoConfig.version > "0.0.0"
 * @returns string - Version hiện tại
 */
const getCurrentVersion = () =>
  Application.nativeApplicationVersion ||
  Constants.expoConfig?.version ||
  "0.0.0";

/**
 * Lấy build number hiện tại của ứng dụng.
 * Ưu tiên: nativeBuildVersion > ios.buildNumber > android.versionCode > ""
 * @returns string - Build number
 */
const getCurrentBuild = () =>
  Application.nativeBuildVersion ||
  Constants.expoConfig?.ios?.buildNumber ||
  `${Constants.expoConfig?.android?.versionCode ?? ""}`;

/**
 * Fetch phiên bản release mới nhất từ GitHub API.
 * @returns Promise<{ version: string; url: string }> - Version và URL release
 */
const getLatestRelease = async () => {
  const response = await axios.request<{
    tag_name: string;
    html_url?: string;
  }>({
    url: "https://api.github.com/repos/GinzaTech/Vshop/releases/latest",
    method: "GET",
  });

  return {
    version: response.data.tag_name.replace(/^v/i, ""),
    url: response.data.html_url || FALLBACK_RELEASE_URL,
  };
};

/**
 * Chuyển đổi error thành thông báo an toàn.
 * @param error - Lỗi bất kỳ
 * @returns string - Thông báo lỗi
 */
const getSafeErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to check for updates right now.";
};

/**
 * Public API: Lấy nhãn version hiện tại (VD: "v1.2.3 (42)").
 * @returns string - Nhãn version
 */
export const getCurrentAppVersionLabel = () => {
  const version = getCurrentVersion();
  const build = getCurrentBuild();

  if (build) {
    return `v${version} (${build})`;
  }

  return `v${version}`;
};

/**
 * Public API: Kiểm tra xem có bản cập nhật nào không.
 * Kiểm tra OTA và native release từ GitHub.
 * @returns Promise<AppUpdateCheckResult> - Kết quả kiểm tra
 */
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

  // Nếu có thể OTA và module updates khả dụng
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
      // Nếu OTA thất bại nhưng có version mới hơn trên GitHub -> native update
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

  // So sánh version hiện tại với latest từ GitHub
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

/**
 * Public API: Áp dụng OTA update (tải và cài đặt).
 * Chỉ hoạt động ở môi trường standalone.
 * @returns Promise<ApplyOtaUpdateResult> - Kết quả áp dụng
 */
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
