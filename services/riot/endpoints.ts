import { normalizeValorantShard } from "~/utils/misc";

export const RIOT_ENDPOINT_NAMES = [
  "auth",
  "entitlements",
  "storefront",
  "wallet",
  "playerxp",
  "weapons",
  "offers",
  "name",
  "matchID",
  "lock",
  "quit",
  "player",
  "player-v3",
  "mmr",
  "owned-items",
  "match-history",
  "match-details",
  "competitive-updates",
  "session",
  "pregame-player",
  "pregame-match",
  "select-agent",
  "pregame-loadouts",
  "coregame-player",
  "coregame-match",
  "coregame-loadouts",
  "coregame-quit",
  "party-player",
  "party",
  "party-ready",
  "party-remove",
  "party-join-queue",
  "party-leave-queue",
  "party-invite-code",
  "party-join-by-code",
  "party-muc-token",
  "contracts",
  "activate-contract",
  "item-upgrades",
  "content",
  "leaderboard",
  "config",
  "penalties",
  "playerinfo",
  "riotgeo",
  "pastoken",
  "riotclientconfig",
] as const;

export type RiotEndpointName = (typeof RIOT_ENDPOINT_NAMES)[number];

export type RiotEndpointParams = {
  name: RiotEndpointName;
  region?: string | null;
  userId?: string | null;
  matchId?: string | null;
  agentId?: string | null;
  itemTypeId?: string | null;
  code?: string | null;
};

const SUPPORTED_SHARDS = new Set(["ap", "eu", "kr", "na", "pbe"]);

const requireValue = (value: string | null | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing Riot endpoint parameter: ${label}`);
  }
  return normalized;
};

const requireShard = (region: string | null | undefined) => {
  const shard = normalizeValorantShard(region);
  if (!SUPPORTED_SHARDS.has(shard)) {
    throw new Error(`Unsupported Riot region: ${region || "(empty)"}`);
  }
  return shard;
};

/** Build a validated Riot API URL and fail before a malformed request is sent. */
export function buildRiotApiUrl(params: RiotEndpointParams): string {
  const { name } = params;

  switch (name) {
    case "auth":
      return "https://auth.riotgames.com/api/v1/authorization";
    case "entitlements":
      return "https://entitlements.auth.riotgames.com/api/token/v1";
    case "weapons":
      return "https://valorant-api.com/v1/weapons";
    case "playerinfo":
      return "https://auth.riotgames.com/userinfo";
    case "riotgeo":
      return "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant";
    case "pastoken":
      return "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat";
    case "riotclientconfig":
      return "https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client";
  }

  const shard = requireShard(params.region);
  const pd = `https://pd.${shard}.a.pvp.net`;
  const glz = `https://glz-${shard}-1.${shard}.a.pvp.net`;
  const userId = () => encodeURIComponent(requireValue(params.userId, "userId"));
  const matchId = () => encodeURIComponent(requireValue(params.matchId, "matchId"));
  const agentId = () => encodeURIComponent(requireValue(params.agentId, "agentId"));
  const itemTypeId = () =>
    encodeURIComponent(requireValue(params.itemTypeId, "itemTypeId"));

  switch (name) {
    case "storefront":
      return `${pd}/store/v3/storefront/${userId()}`;
    case "wallet":
      return `${pd}/store/v1/wallet/${userId()}`;
    case "playerxp":
      return `${pd}/account-xp/v1/players/${userId()}`;
    case "offers":
      return `${pd}/store/v1/offers`;
    case "name":
      return `${pd}/name-service/v2/players`;
    case "matchID":
    case "pregame-player":
      return `${glz}/pregame/v1/players/${userId()}`;
    case "lock":
      return `${glz}/pregame/v1/matches/${matchId()}/lock/${agentId()}`;
    case "select-agent":
      return `${glz}/pregame/v1/matches/${matchId()}/select/${agentId()}`;
    case "quit":
      return `${glz}/pregame/v1/matches/${matchId()}/quit`;
    case "player":
      return `${pd}/personalization/v2/players/${userId()}/playerloadout`;
    case "player-v3":
      return `${pd}/personalization/v3/players/${userId()}/playerloadout`;
    case "mmr":
      return `${pd}/mmr/v1/players/${userId()}`;
    case "owned-items":
      return `${pd}/store/v1/entitlements/${userId()}/${itemTypeId()}`;
    case "match-history":
      return `${pd}/match-history/v1/history/${userId()}`;
    case "match-details":
      return `${pd}/match-details/v1/matches/${matchId()}`;
    case "competitive-updates":
      return `${pd}/mmr/v1/players/${userId()}/competitiveupdates`;
    case "session":
      return `${glz}/session/v1/sessions/${userId()}`;
    case "pregame-match":
      return `${glz}/pregame/v1/matches/${matchId()}`;
    case "pregame-loadouts":
      return `${glz}/pregame/v1/matches/${matchId()}/loadouts`;
    case "coregame-player":
      return `${glz}/core-game/v1/players/${userId()}`;
    case "coregame-match":
      return `${glz}/core-game/v1/matches/${matchId()}`;
    case "coregame-loadouts":
      return `${glz}/core-game/v1/matches/${matchId()}/loadouts`;
    case "coregame-quit":
      return `${glz}/core-game/v1/matches/${matchId()}/quit`;
    case "party-player":
    case "party-remove":
      return `${glz}/parties/v1/players/${userId()}`;
    case "party":
      return `${glz}/parties/v1/parties/${matchId()}`;
    case "party-ready":
      return `${glz}/parties/v1/parties/${matchId()}/members/${userId()}/setReady`;
    case "party-join-queue":
      return `${glz}/parties/v1/parties/${matchId()}/matchmaking/join`;
    case "party-leave-queue":
      return `${glz}/parties/v1/parties/${matchId()}/matchmaking/leave`;
    case "party-invite-code":
      return `${glz}/parties/v1/parties/${matchId()}/invitecode`;
    case "party-join-by-code":
      return `${glz}/parties/v1/players/joinbycode/${encodeURIComponent(
        requireValue(params.code, "code"),
      )}`;
    case "party-muc-token":
      return `${glz}/parties/v1/parties/${matchId()}/muctoken`;
    case "contracts":
      return `${pd}/contracts/v1/contracts/${userId()}`;
    case "activate-contract":
      return `${pd}/contracts/v1/contracts/${userId()}/special/${itemTypeId()}`;
    case "item-upgrades":
      return `${pd}/contract-definitions/v3/item-upgrades`;
    case "content":
      return `https://shared.${shard}.a.pvp.net/content-service/v3/content`;
    case "leaderboard":
      return `${pd}/mmr/v1/leaderboards/affinity/${shard}/queue/competitive/season/${itemTypeId()}`;
    case "config":
      return `${pd}/v1/config/${shard}`;
    case "penalties":
      return `${pd}/restrictions/v3/penalties`;
  }
}

