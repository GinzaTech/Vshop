import {
  buildRiotApiUrl,
  RIOT_ENDPOINT_NAMES,
  type RiotEndpointName,
} from "~/services/riot/endpoints";

const USER_ID = "user/id";
const MATCH_ID = "match/id";
const AGENT_ID = "agent/id";
const ITEM_TYPE_ID = "item/type";
const CODE = "join/code";

const expectedUrls: Record<RiotEndpointName, string> = {
  auth: "https://auth.riotgames.com/api/v1/authorization",
  entitlements: "https://entitlements.auth.riotgames.com/api/token/v1",
  storefront: "https://pd.ap.a.pvp.net/store/v3/storefront/user%2Fid",
  wallet: "https://pd.ap.a.pvp.net/store/v1/wallet/user%2Fid",
  playerxp: "https://pd.ap.a.pvp.net/account-xp/v1/players/user%2Fid",
  weapons: "https://valorant-api.com/v1/weapons",
  offers: "https://pd.ap.a.pvp.net/store/v1/offers",
  name: "https://pd.ap.a.pvp.net/name-service/v2/players",
  matchID: "https://glz-ap-1.ap.a.pvp.net/pregame/v1/players/user%2Fid",
  lock: "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match%2Fid/lock/agent%2Fid",
  quit: "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match%2Fid/quit",
  player: "https://pd.ap.a.pvp.net/personalization/v2/players/user%2Fid/playerloadout",
  "player-v3": "https://pd.ap.a.pvp.net/personalization/v3/players/user%2Fid/playerloadout",
  mmr: "https://pd.ap.a.pvp.net/mmr/v1/players/user%2Fid",
  "owned-items": "https://pd.ap.a.pvp.net/store/v1/entitlements/user%2Fid/item%2Ftype",
  "match-history": "https://pd.ap.a.pvp.net/match-history/v1/history/user%2Fid",
  "match-details": "https://pd.ap.a.pvp.net/match-details/v1/matches/match%2Fid",
  "competitive-updates": "https://pd.ap.a.pvp.net/mmr/v1/players/user%2Fid/competitiveupdates",
  session: "https://glz-ap-1.ap.a.pvp.net/session/v1/sessions/user%2Fid",
  "pregame-player": "https://glz-ap-1.ap.a.pvp.net/pregame/v1/players/user%2Fid",
  "pregame-match": "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match%2Fid",
  "select-agent": "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match%2Fid/select/agent%2Fid",
  "pregame-loadouts": "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match%2Fid/loadouts",
  "coregame-player": "https://glz-ap-1.ap.a.pvp.net/core-game/v1/players/user%2Fid",
  "coregame-match": "https://glz-ap-1.ap.a.pvp.net/core-game/v1/matches/match%2Fid",
  "coregame-loadouts": "https://glz-ap-1.ap.a.pvp.net/core-game/v1/matches/match%2Fid/loadouts",
  "coregame-quit": "https://glz-ap-1.ap.a.pvp.net/core-game/v1/matches/match%2Fid/quit",
  "party-player": "https://glz-ap-1.ap.a.pvp.net/parties/v1/players/user%2Fid",
  party: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid",
  "party-ready": "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid/members/user%2Fid/setReady",
  "party-remove": "https://glz-ap-1.ap.a.pvp.net/parties/v1/players/user%2Fid",
  "party-join-queue": "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid/matchmaking/join",
  "party-leave-queue": "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid/matchmaking/leave",
  "party-invite-code": "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid/invitecode",
  "party-join-by-code": "https://glz-ap-1.ap.a.pvp.net/parties/v1/players/joinbycode/join%2Fcode",
  "party-muc-token": "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/match%2Fid/muctoken",
  contracts: "https://pd.ap.a.pvp.net/contracts/v1/contracts/user%2Fid",
  "activate-contract": "https://pd.ap.a.pvp.net/contracts/v1/contracts/user%2Fid/special/item%2Ftype",
  "item-upgrades": "https://pd.ap.a.pvp.net/contract-definitions/v3/item-upgrades",
  content: "https://shared.ap.a.pvp.net/content-service/v3/content",
  leaderboard: "https://pd.ap.a.pvp.net/mmr/v1/leaderboards/affinity/ap/queue/competitive/season/item%2Ftype",
  config: "https://pd.ap.a.pvp.net/v1/config/ap",
  penalties: "https://pd.ap.a.pvp.net/restrictions/v3/penalties",
  playerinfo: "https://auth.riotgames.com/userinfo",
  riotgeo: "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
  pastoken: "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat",
  riotclientconfig: "https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client",
};

describe("Riot endpoint registry", () => {
  it.each(RIOT_ENDPOINT_NAMES)("builds %s without malformed segments", (name) => {
    const url = buildRiotApiUrl({
      name,
      region: "th1",
      userId: USER_ID,
      matchId: MATCH_ID,
      agentId: AGENT_ID,
      itemTypeId: ITEM_TYPE_ID,
      code: CODE,
    });

    expect(url).toBe(expectedUrls[name]);
    expect(url).not.toContain("undefined");
    expect(new URL(url).protocol).toBe("https:");
  });

  it("rejects an empty or unsupported region before sending a request", () => {
    expect(() => buildRiotApiUrl({ name: "wallet" })).toThrow(
      "Unsupported Riot region: (empty)",
    );
    expect(() =>
      buildRiotApiUrl({ name: "wallet", region: "mars", userId: USER_ID }),
    ).toThrow("Unsupported Riot region: mars");
  });

  it("rejects missing dynamic path parameters", () => {
    expect(() =>
      buildRiotApiUrl({ name: "wallet", region: "ap", userId: "  " }),
    ).toThrow("Missing Riot endpoint parameter: userId");
  });
});

