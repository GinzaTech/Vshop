import type { IconNode } from "lucide";

export type MorphIconDefinition = {
  kind: "morph";
  icon: IconNode;
  filled?: true;
};

export type AppIconDefinition = MorphIconDefinition;
