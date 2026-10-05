import { useEffect, useState, type ComponentType } from "react";
import { AppState, Platform, StyleSheet, View, type ViewProps } from "react-native";
import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import { NAV_GLASS_MATERIAL, GLASS_NAV_OPTICS, GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { useNativeGlassPreferences } from "~/components/ui/liquid-glass-native-policy";
import { canUseNativeRefraction, validRefractionTarget } from "./native-refraction-policy";
import type { RefractionLensProps, RefractionTargetProps } from "./native-refraction.types";

type NativeTargetProps = ViewProps & { enabled: boolean; onReady: (event: { nativeEvent: { targetTag: number } }) => void };
type NativeLensProps = ViewProps & { targetTag: number; enabled: boolean; tint: string; magnification: number; edgeDp: number };
let targetView: ComponentType<NativeTargetProps> | null = null;
let lensView: ComponentType<NativeLensProps> | null = null;

function supported() {
  const module = requireOptionalNativeModule<{ apiVersion: number }>("VShopLiquidGlass");
  return canUseNativeRefraction(Platform.OS, Platform.Version, module?.apiVersion);
}

function useForeground() {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => listener.remove();
  }, []);
  return active;
}

export function RefractionTarget({ enabled, onTargetReady, ...props }: RefractionTargetProps) {
  const active = useForeground();
  const preferences = useNativeGlassPreferences(enabled && active);
  if (!supported()) return <View {...props} />;
  const Target = targetView ??= requireNativeViewManager<NativeTargetProps>("VShopLiquidGlass", "RefractionTarget");
  // Reduce Transparency: người dùng từ chối hiệu ứng trong suốt → không ghi
  // nhận trang, bỏ luôn chi phí capture (lens sẽ không được render).
  return <Target {...props} testID="navigation-refraction-target" enabled={enabled && active && !preferences.reduceTransparency}
    onReady={({ nativeEvent }) => { if (validRefractionTarget(nativeEvent.targetTag)) onTargetReady(nativeEvent.targetTag); }} />;
}

/** Paints over the existing fallback only when native rendering succeeds. */
export function RefractionLens({ targetTag, enabled }: RefractionLensProps) {
  const active = useForeground();
  const preferences = useNativeGlassPreferences(enabled);
  if (!enabled || !active || !validRefractionTarget(targetTag) || !supported()) return null;
  // Reduce Transparency: fallback tint mờ đục phía dưới vẫn hiển thị, lớp
  // khúc xạ thật tắt để không phá lựa chọn accessibility của người dùng.
  if (preferences.reduceTransparency) return null;
  const Lens = lensView ??= requireNativeViewManager<NativeLensProps>("VShopLiquidGlass", "RefractionLens");
  return <Lens testID="navigation-native-refraction" targetTag={targetTag} enabled
    tint={NAV_GLASS_MATERIAL.nativeLensTint} magnification={GLASS_TAB_BAR.magnify} edgeDp={GLASS_NAV_OPTICS.refractionOffset}
    style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} aria-hidden
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
