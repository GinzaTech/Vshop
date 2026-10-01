import React, { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { CachedImage } from "~/components/CachedImage";
import { GLASS_MATERIAL, RADIUS } from "~/constants/DesignSystem";
import { useNativeGlassPreferences, useNativeGlassSlot } from "./liquid-glass-native-policy";

interface Props {
  artworkUri?: string;
  cacheId: string;
  radius?: number;
}

/** Real blur of a private decorative backdrop, never of sharp artwork/text.
 * Only prominent finite cards opt in. Dense lists keep LiquidGlassDecoration.
 * Native targets and their blur share identical bounds; target/image commit
 * before the blur mounts. No native blur is used on web or Android <31.
 */
export default function LiquidGlassBackdrop({ artworkUri, cacheId, radius = RADIUS.card }: Props) {
  const supported = Platform.OS === "ios" || (Platform.OS === "android" && Number(Platform.Version) >= 31);
  const preferences = useNativeGlassPreferences(supported && Boolean(artworkUri));
  const allowed = supported && Boolean(artworkUri) && !preferences.reduceTransparency && !preferences.reduceMotion;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius,
        backgroundColor: preferences.reduceTransparency ? GLASS_MATERIAL.fallback : GLASS_MATERIAL.surface }]}>
      {allowed && artworkUri ? <ArtworkBackdrop key={`${cacheId}:${artworkUri}`} artworkUri={artworkUri} cacheId={cacheId} /> : null}
    </View>
  );
}

function ArtworkBackdrop({ artworkUri, cacheId }: { artworkUri: string; cacheId: string }) {
  const target = useRef<View | null>(null);
  const [hasBounds, setHasBounds] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = hasBounds && loaded && !failed;
  const slot = useNativeGlassSlot(ready);
  const blur = ready && slot && target.current !== null;
  return <>
    <BlurTargetView ref={target} collapsable={false} style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent }) => setHasBounds(nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0)}>
      <CachedImage source={{ uri: artworkUri }} cacheId={cacheId} style={StyleSheet.absoluteFill}
        contentFit="cover" cachePolicy="memory-disk" priority="low" transition={0} recyclingKey={artworkUri}
        accessible={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    </BlurTargetView>
    {blur ? <>
      <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={45} tint="light"
        pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.frost]} />
    </> : <View style={[StyleSheet.absoluteFill, styles.fallback]} />}
  </>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  frost: { backgroundColor: GLASS_MATERIAL.frost },
  fallback: { backgroundColor: GLASS_MATERIAL.fallback },
});
