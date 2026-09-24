import type { IconNode } from "lucide";

export type MorphIconDefinition = {
  kind: "morph";
  icon: IconNode;
  filled?: true;
};

export type LegacyIconDefinition = {
  kind: "legacy";
  legacyName:
    | "bomb"
    | "crosshairs-gps"
    | "flag-outline"
    | "pistol"
    | "shield-account-outline"
    | "shield-check-outline"
    | "sword-cross"
    | "timer-sand";
};

export type AppIconDefinition =
  | MorphIconDefinition
  | LegacyIconDefinition;
