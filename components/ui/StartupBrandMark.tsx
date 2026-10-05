import React from "react";
import { Image, StyleSheet, View } from "react-native";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import { STARTUP_ICON_SIZE, STARTUP_ICON_SOURCE } from "~/constants/Startup";

/** Local fixed-size bitmap: no font, network request or perpetual animation. */
export default function StartupBrandMark({ onReady }: { onReady?: () => void }) {
  const [failed, setFailed] = React.useState(false);
  const loaded = React.useRef(false);
  const laidOut = React.useRef(false);
  const notified = React.useRef(false);
  const alive = React.useRef(true);
  const latestReady = React.useRef(onReady);
  latestReady.current = onReady;
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const notify = () => {
    if (alive.current && loaded.current && laidOut.current && !notified.current) {
      notified.current = true;
      latestReady.current?.();
    }
  };
  return <View testID="startup-brand-frame" pointerEvents="none" accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
    onLayout={({ nativeEvent }) => {
      laidOut.current = nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0;
      notify();
    }} style={styles.frame}>
    {failed ? <View testID="startup-brand-fallback" style={[styles.frame, styles.fallback]}
      onLayout={() => { loaded.current = true; notify(); }}>
      <AppIcon name="shop" size={64} color={COLORS.PURE_WHITE} decorative />
    </View> : <Image testID="startup-brand-image" source={STARTUP_ICON_SOURCE} resizeMode="contain" style={styles.frame}
      onLoad={() => { loaded.current = true; notify(); }}
      onError={() => { if (alive.current) setFailed(true); }} />}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: STARTUP_ICON_SIZE, height: STARTUP_ICON_SIZE },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ACCENT_DEEP },
});
