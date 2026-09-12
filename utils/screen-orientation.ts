export type AppScreenOrientation = "landscape" | "portrait";

const COMBAT_SESSION_SEGMENT = "combat_session";

/**
 * Combat session is the only route allowed to use landscape. Keeping this
 * decision in one helper prevents new routes from accidentally inheriting the
 * device sensor orientation.
 */
export const getScreenOrientationForPathname = (
  pathname: string
): AppScreenOrientation => {
  const normalizedPath = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const lastSegment = normalizedPath.split("/").filter(Boolean).at(-1);

  return lastSegment === COMBAT_SESSION_SEGMENT ? "landscape" : "portrait";
};

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
