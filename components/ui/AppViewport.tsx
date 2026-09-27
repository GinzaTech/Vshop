import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import {
  Platform,
  StyleSheet,
  View,
  type ScaledSize,
  useWindowDimensions,
} from "react-native";

import { COLORS } from "~/constants/DesignSystem";
import type { AppScreenOrientation } from "~/utils/screen-orientation";

export const WEB_PHONE_MAX_WIDTH = 430;
export const WEB_PHONE_LANDSCAPE_MAX_WIDTH = 932;
export const WEB_PHONE_LANDSCAPE_MAX_HEIGHT = 430;

const AppViewportDimensionsContext = createContext<ScaledSize | null>(null);

export function getAppViewportDimensions(
  dimensions: ScaledSize,
  platform: typeof Platform.OS,
  orientation: AppScreenOrientation = "portrait",
): ScaledSize {
  if (platform !== "web") {
    return { ...dimensions };
  }

  if (orientation === "landscape") {
    return {
      ...dimensions,
      height: Math.min(dimensions.height, WEB_PHONE_LANDSCAPE_MAX_HEIGHT),
      width: Math.min(dimensions.width, WEB_PHONE_LANDSCAPE_MAX_WIDTH),
    };
  }

  return {
    ...dimensions,
    width: Math.min(dimensions.width, WEB_PHONE_MAX_WIDTH),
  };
}

export function useAppWindowDimensions(): ScaledSize {
  const appViewportDimensions = useContext(AppViewportDimensionsContext);
  const windowDimensions = useWindowDimensions();
  return (
    appViewportDimensions ??
    getAppViewportDimensions(windowDimensions, Platform.OS)
  );
}

type AppViewportProps = PropsWithChildren<{
  orientation?: AppScreenOrientation;
}>;

export default function AppViewport({
  children,
  orientation = "portrait",
}: AppViewportProps) {
  const { fontScale, height, scale, width } = useWindowDimensions();
  const platform = Platform.OS;
  const appDimensions = useMemo(
    () =>
      getAppViewportDimensions(
        { fontScale, height, scale, width },
        platform,
        orientation,
      ),
    [
      fontScale,
      height,
      orientation,
      platform,
      scale,
      width,
    ],
  );

  return (
    <AppViewportDimensionsContext.Provider value={appDimensions}>
      <View style={styles.host} testID="app-viewport-host">
        <View
          style={[
            styles.frame,
            { height: appDimensions.height, width: appDimensions.width },
          ]}
          testID="app-viewport-frame"
        >
          {children}
        </View>
      </View>
    </AppViewportDimensionsContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  frame: {
    backgroundColor: COLORS.BACKGROUND,
    overflow: "hidden",
  },
});
