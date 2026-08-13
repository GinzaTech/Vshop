import React from "react";

import type { OwnedWeaponCollectionItem } from "~/components/GalleryProfile";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";

type CheckerBalances = {
  vp: number;
  rad: number;
  kc: number;
};

export type CollectionCheckerProfile = {
  gameName: string;
  tagLine?: string;
  region: string;
  level: number;
  avatarUri?: string;
  avatarCacheId?: string;
  rank: CompetitiveRankSummary | null;
  balances: CheckerBalances;
};

type CollectionCheckerExportProviderProps = {
  items: OwnedWeaponCollectionItem[];
  profile: CollectionCheckerProfile;
  disabled?: boolean;
  children: React.ReactNode;
};

export function CollectionCheckerExportProvider({
  children,
}: CollectionCheckerExportProviderProps) {
  return children;
}

export function CollectionCheckerExport() {
  return null;
}
