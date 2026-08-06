export type AppScreenOrientation = "landscape" | "portrait";

/**
 * Safely locks orientation even when the currently installed development
 * client has not been rebuilt with expo-screen-orientation yet.
 */
export const lockScreenOrientation = async (
  orientation: AppScreenOrientation
) => {
  try {
    // Keep the import inside the guarded block. An old development client may
    // not contain the native module until it is rebuilt.
    const ScreenOrientation = require(
      "expo-screen-orientation"
    ) as typeof import("expo-screen-orientation");
    const orientationLock =
      orientation === "landscape"
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;

    await ScreenOrientation.lockAsync(orientationLock);
    return true;
  } catch {
    return false;
  }
};
