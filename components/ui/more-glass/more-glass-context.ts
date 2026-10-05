import { createContext } from "react";
export const MoreGlassContext = createContext<"gpu" | "fallback" | "opaque">("fallback");
