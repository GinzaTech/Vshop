import type { ViewProps } from "react-native";

export type RefractionTargetProps = ViewProps & {
  enabled: boolean;
  onTargetReady: (tag: number) => void;
};
export type RefractionLensProps = { targetTag: number | null; enabled: boolean };
