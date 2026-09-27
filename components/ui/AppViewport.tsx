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
import { SafeAreaProvider } from "react-native-safe-area-context";

import { COLORS } from "~/constants/DesignSystem";
import { useWebRefreshActivity } from "~/components/ui/AppRefreshControl";
import type { AppScreenOrientation } from "~/utils/screen-orientation";

export const WEB_PHONE_MAX_WIDTH = 430;
export const WEB_PHONE_LANDSCAPE_MAX_WIDTH = 932;
export const WEB_PHONE_LANDSCAPE_MAX_HEIGHT = 430;

// Synthetic safe-area cho web: trình duyệt không có status bar vật lý nên
// insets mặc định là 0 — nội dung dính sát mép trên frame khác hẳn mobile.
// Giá trị xấp xỉ chiều cao status bar của một chiếc phone tiêu chuẩn.
const WEB_SYNTHETIC_INSETS = { top: 26, bottom: 8, left: 0, right: 0 };

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
  // Web-only: thanh tiến trình mỏng khi có refresh đang chạy (thay cho
  // pull-to-refresh spinner vốn không tồn tại trên react-native-web).
  const refreshActive = useWebRefreshActivity();
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

  const frameContent = (
    <AppViewportDimensionsContext.Provider value={appDimensions}>
      <View style={styles.host} testID="app-viewport-host">
        <View
          style={[
            styles.frame,
            { height: appDimensions.height, width: appDimensions.width },
          ]}
          testID="app-viewport-frame"
        >
          {refreshActive ? (
            <View style={styles.refreshBar} testID="app-refresh-bar" />
          ) : null}
          {children}
        </View>
      </View>
    </AppViewportDimensionsContext.Provider>
  );

  // Web-only: bọc SafeAreaProvider với insets tổng hợp — native giữ provider
  // thật của expo-router (insets vật lý), nếu override trên native sẽ phá
  // safe area thật của thiết bị.
  if (platform !== "web") {
    return frameContent;
  }

  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: {
          x: 0,
          y: 0,
          width: appDimensions.width,
          height: appDimensions.height,
        },
        insets: WEB_SYNTHETIC_INSETS,
      }}
    >
      {frameContent}
    </SafeAreaProvider>
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
  refreshBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.ACCENT,
    zIndex: 20,
  },
});
