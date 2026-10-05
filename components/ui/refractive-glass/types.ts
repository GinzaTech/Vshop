import type { View } from "react-native";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";
import type { packGlassProjection } from "./model";
export type GlassClipRef = Readonly<{ ref: AnimatedRef<View>; radius: number; height?: SharedValue<number> }>;
export type GlassEnvironment = Readonly<{ signals: readonly SharedValue<number>[]; clips: readonly GlassClipRef[] }>;
export type GlassRegistration = GlassEnvironment & Readonly<{ id: string; ref: AnimatedRef<View> }>;
export type GlassProjection = ReturnType<typeof packGlassProjection> & { viewportReady: boolean };
export type GlassSceneContextValue = {
  projection: SharedValue<GlassProjection>;
  ready: SharedValue<boolean>;
  opaque: boolean;
  register: (entry: GlassRegistration) => () => void;
  invalidate: () => void;
};
