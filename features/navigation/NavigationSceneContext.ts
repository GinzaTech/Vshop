import { createContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export const NavigationSceneContext = createContext<{ weights: SharedValue<number[]> } | null>(null);
