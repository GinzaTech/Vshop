import { createContext } from "react";
import type { GlassEnvironment, GlassSceneContextValue } from "./types";
export const GlassSceneContext = createContext<GlassSceneContextValue | null>(null);
export const GlassEnvironmentContext = createContext<GlassEnvironment>({ signals: [], clips: [] });
