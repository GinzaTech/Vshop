import { requireOptionalNativeModule } from "expo-modules-core";

type ScreenOrientationModule = {
  lockAsync?: (orientationLock: number) => Promise<void>;
};

export type AppScreenOrientation = "landscape" | "portrait";

/**
 * Safely locks orientation even when the currently installed development
 * client has not been rebuilt with expo-screen-orientation yet.
 */
export const lockScreenOrientation = async (
  orientation: AppScreenOrientation
) => {
  try {
    const nativeOrientationModule =
      requireOptionalNativeModule<ScreenOrientationModule>(
        "ExpoScreenOrientation"
      );
    if (!nativeOrientationModule?.lockAsync) {
      return false;
    }

    // expo-screen-orientation enum: PORTRAIT_UP = 3, LANDSCAPE = 5.
    await nativeOrientationModule.lockAsync(orientation === "landscape" ? 5 : 3);
    return true;
  } catch {
    return false;
  }
};
