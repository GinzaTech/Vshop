import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import PIXEL_CANVAS_HTML, {
  type PixelBackgroundTransition,
} from "~/components/profile/pixelCanvasDocument";

type PixelRevealBackgroundProps = {
  transition: PixelBackgroundTransition;
  durationMs: number;
};

export default function PixelRevealBackground({
  transition,
  durationMs,
}: PixelRevealBackgroundProps) {
  const nativeWebViewRef =
    React.useRef<React.ElementRef<typeof WebView>>(null);
  const webFrameRef = React.useRef<any>(null);
  const nativeLoadedRef = React.useRef(false);
  const webLoadedRef = React.useRef(false);
  const latestTransitionRef = React.useRef(transition);
  const source = React.useMemo(() => ({ html: PIXEL_CANVAS_HTML }), []);

  latestTransitionRef.current = transition;

  const runNativeTransition = React.useCallback(
    (nextTransition: PixelBackgroundTransition) => {
      nativeWebViewRef.current?.injectJavaScript(
        `window.__vshopPixelTransition && window.__vshopPixelTransition(${JSON.stringify(
          nextTransition
        )}, ${durationMs}); true;`
      );
    },
    [durationMs]
  );

  const runWebTransition = React.useCallback(
    (nextTransition: PixelBackgroundTransition) => {
      webFrameRef.current?.contentWindow?.postMessage(
        {
          type: "vshop-pixel-transition",
          mode: nextTransition,
          duration: durationMs,
        },
        "*"
      );
    },
    [durationMs]
  );

  React.useEffect(() => {
    if (Platform.OS === "web") {
      if (webLoadedRef.current) runWebTransition(transition);
      return;
    }

    if (nativeLoadedRef.current) runNativeTransition(transition);
  }, [runNativeTransition, runWebTransition, transition]);

  const canvas =
    Platform.OS === "web"
      ? React.createElement("iframe", {
          "aria-hidden": true,
          onLoad: () => {
            webLoadedRef.current = true;
            if (latestTransitionRef.current === "toLight") {
              runWebTransition("toLight");
            }
          },
          ref: webFrameRef,
          srcDoc: PIXEL_CANVAS_HTML,
          style: {
            border: 0,
            height: "100%",
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
            width: "100%",
          },
          tabIndex: -1,
          title: "",
        })
      : (
          <WebView
            ref={nativeWebViewRef}
            androidLayerType="hardware"
            bounces={false}
            javaScriptEnabled
            onLoadEnd={() => {
              nativeLoadedRef.current = true;
              if (latestTransitionRef.current === "toLight") {
                runNativeTransition("toLight");
              }
            }}
            originWhitelist={["*"]}
            overScrollMode="never"
            pointerEvents="none"
            scrollEnabled={false}
            setBuiltInZoomControls={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            source={source}
            style={styles.webView}
          />
        );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.container,
        {
          backgroundColor: transition === "toDark" ? "#FFFFFF" : "#000000",
        },
      ]}
    >
      {canvas}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  webView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
});
