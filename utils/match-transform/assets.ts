import { getAssets, getAgent } from "~/utils/valorant-assets";
import type { ScoreboardPlayer } from "~/types/match-ui";
import type { MatchAgentAsset, MatchAssetCatalog, MatchMapAsset, MatchTierAsset, MatchTierSetAsset, ValorantWeaponAsset } from "~/types/match-ui";
import { optionalNumber } from "./common";
export const normalizeAssetId = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const resolveAgentAsset = (
  catalog: MatchAssetCatalog,
  agentId: unknown
): MatchAgentAsset | undefined =>
  catalog.agentsById.get(normalizeAssetId(agentId));

export const resolveMapAsset = (
  catalog: MatchAssetCatalog,
  mapUrl: unknown
): MatchMapAsset | undefined =>
  catalog.mapsByUrl.get(normalizeAssetId(mapUrl));

export function createMatchAssetCatalog(): MatchAssetCatalog {
  const assets = getAssets();
  const agentAssets = getAgent().agents as unknown as MatchAgentAsset[];
  const mapAssets = assets.maps as unknown as MatchMapAsset[];
  const tierSets = assets.competitiveTiers as unknown as MatchTierSetAsset[];
  const weaponAssets = (assets.weapons ?? []) as ValorantWeaponAsset[];
  const tiersByNumber = new Map<number, MatchTierAsset>();

  tierSets.forEach((set) => {
    set.tiers?.forEach((tier) => {
      const tierNumber = optionalNumber(tier.tier);
      if (tierNumber && tierNumber > 0 && !tiersByNumber.has(tierNumber)) {
        tiersByNumber.set(tierNumber, tier);
      }
    });
  });

  return {
    agentsById: new Map(
      agentAssets.map((agent) => [normalizeAssetId(agent.uuid), agent])
    ),
    mapsByUrl: new Map(
      mapAssets
        .filter((map): map is MatchMapAsset & { mapUrl: string } =>
          Boolean(map.mapUrl)
        )
        .map((map) => [normalizeAssetId(map.mapUrl), map])
    ),
    tiersByNumber,
    weaponsById: new Map(
      weaponAssets.map((weapon) => [normalizeAssetId(weapon.uuid), weapon])
    ),
  };
}

export function rankFromTier(
  tierNumber: number,
  catalog: MatchAssetCatalog
): ScoreboardPlayer["rank"] {
  if (tierNumber <= 0) return undefined;
  const tier = catalog.tiersByNumber.get(tierNumber);
  return {
    name: tier?.tierName || `Tier ${tierNumber}`,
    iconUrl:
      tier?.smallIcon || tier?.largeIcon || tier?.rankTriangleDownIcon,
  };
}
