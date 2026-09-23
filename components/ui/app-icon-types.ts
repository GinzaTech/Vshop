import type { IconNode } from "lucide";

export type MorphIconDefinition = {
  kind: "morph";
  icon: IconNode;
  filled?: true;
};

export type LegacyIconDefinition = {
  kind: "legacy";
  legacyName: "pistol" | "sword-cross" | "shield-account-outline";
};

export type AppIconDefinition =
  | MorphIconDefinition
  | LegacyIconDefinition;
