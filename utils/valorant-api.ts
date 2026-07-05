import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { normalizeValorantShard, VCurrencies, VItemTypes } from "./misc";
import https from "https-browserify";
import { fetchBundle, getAssets } from "./valorant-assets";
import {
  logAxiosRequest,
  logAxiosResponse,
  logAxiosError,
  initApiLogger,
} from "./api-logger";

void initApiLogger();

axios.interceptors.request.use(
  function (config) {
    if (__DEV__) console.log(`${config.method?.toUpperCase()} ${config.url}`);
    (config as any).metadata = { startTime: Date.now() };
    return logAxiosRequest(config);
  },
  function (error) {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(logAxiosResponse, logAxiosError);

const maskSecretForLog = (value?: string | null) => {
  const text = String(value || "");
  if (!text) return "";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : "***";
};

const logValorantApiDebug = (
  label: string,
  payload: Record<string, unknown>
) => {
  if (__DEV__) {
    console.log(`[valorant-api] ${label}`, payload);
  }
};


export interface PlayerLoadoutResponse {
  Subject: string;
  Version: number;
  Guns: {
    ID: string;
    CharmInstanceID?: string;
    CharmID?: string;
    CharmLevelID?: string;
    SkinID: string;
    SkinLevelID: string;
    ChromaID: string;
    Attachments: unknown[];
  }[];
  Sprays: {
    EquipSlotID: string;
    SprayID: string;
    SprayLevelID: string | null;
  }[];
  Identity: {
    PlayerCardID: string;
    PlayerTitleID: string;
    AccountLevel: number;
    PreferredLevelBorderID: string;
    HideAccountLevel: boolean;
  };
  Incognito: boolean;
}

export interface OwnedItemsResponse {
  Subject?: string;
  ItemTypeID?: string;
  Entitlements?: {
    TypeID?: string;
    ItemID: string;
    InstanceID?: string;
  }[];
  EntitlementsByTypes?: {
    ItemTypeID: string;
    Entitlements: {
      TypeID: string;
      ItemID: string;
      InstanceID?: string;
    }[];
  }[];
}

export interface CompetitiveMMRResponse {
  Subject?: string;
  QueueSkills?: {
    competitive?: {
      CompetitiveTier?: number;
      HighestCompetitiveTier?: number;
      SeasonalInfoBySeasonID?: Record<
        string,
        {
          Rank?: number;
          CompetitiveTier?: number;
          RankedRating?: number;
          WinsByTier?: Record<string, number> | null;
          SeasonHighestCompetitiveTier?: number;
        }
      >;
    };
  };
  LatestCompetitiveUpdate?: {
    SeasonID?: string;
    TierAfterUpdate?: number;
    TierBeforeUpdate?: number;
    RankedRatingAfterUpdate?: number;
    MatchStartTime?: number;
  };
}

export interface ValorantSessionResponse {
  subject?: string;
  clientVersion?: string;
  clientPlatformInfo?: {
    platformType?: string;
    platformOS?: string;
    platformOSVersion?: string;
    platformChipset?: string;
    platformDevice?: string;
  };
  [key: string]: any;
}

export interface CurrentGameMatchResponse {
  MatchID: string;
  Players: {
    Subject: string;
    [key: string]: any;
  }[];
  [key: string]: any;
}

export interface PartyResponse {
  ID: string;
  Members: {
    Subject: string;
    IsReady: boolean;
    [key: string]: any;
  }[];
  [key: string]: any;
}

export const extractOwnedItemIds = (response?: OwnedItemsResponse | null) =>
  Array.from(
    new Set(
      [
        ...(response?.Entitlements ?? []).map((entitlement) => entitlement.ItemID),
        ...(response?.EntitlementsByTypes ?? []).flatMap((entry) =>
          (entry.Entitlements ?? []).map((entitlement) => entitlement.ItemID)
        ),
      ].filter((itemId): itemId is string => Boolean(itemId))
    )
  );


export let defaultUser = {
  id: "",
  name: "",
  TagLine: "",
  region: "",
  shops: {
    main: [] as SkinShopItem[],
    bundles: [] as BundleShopItem[],
    nightMarket: [] as NightMarketItem[],
    accessory: [] as AccessoryShopItem[],
    remainingSecs: {
      main: 0,
      bundles: [0],
      nightMarket: 0,
      accessory: 0,
    },
  },
  balances: {
    vp: 0,
    rad: 0,
    fag: 0,
    kc: 0,
  },
  progress: {
    level: 0,
    xp: 0,
  },
  ownedSkinIds: [] as string[],
  accessToken: "",
  idToken: "",
  entitlementsToken: "",
};

const DEFAULT_RIOT_CLIENT_VERSION = "release-13.00-shipping-32-4990475";
const RIOT_CLIENT_PLATFORM =
  "eyJwbGF0Zm9ybVR5cGUiOiJQQyIsInBsYXRmb3JtT1MiOiJXaW5kb3dzIiwicGxhdGZvcm1PU1ZlcnNpb24iOiIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwicGxhdGZvcm1DaGlwc2V0IjoiVW5rbm93biJ9";

let riotClientVersionOverride: string | null = null;

export const setRiotClientVersionOverride = (version?: string | null) => {
  const normalizedVersion = typeof version === "string" ? version.trim() : "";

  if (!normalizedVersion) {
    riotClientVersionOverride = null;
    return null;
  }

  riotClientVersionOverride = normalizedVersion;
  return riotClientVersionOverride;
};

export const getRiotClientVersionForRequests = () =>
  riotClientVersionOverride ||
  getAssets().riotClientVersion ||
  DEFAULT_RIOT_CLIENT_VERSION;

const extraHeaders = () => ({
  "X-Riot-ClientVersion":
    getRiotClientVersionForRequests(),
  "X-Riot-ClientPlatform": RIOT_CLIENT_PLATFORM,
});

export async function getEntitlementsToken(accessToken: string) {
  const res = await axios.request<EntitlementResponse>({
    url: getUrl({ name: "entitlements" }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: {},
  });
  return res.data.entitlements_token;
}

export function getUserId(accessToken: string) {
  const data = jwtDecode(accessToken) as any;
  return data.sub;
}

export async function getUsername(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string
) {
  const res = await axios.request<NameServiceResponse>({
    url: getUrl({ name: "name", region: region }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: [userId],
  });

  return {
    GameName: res.data[0].GameName || "?",
    TagLine: res.data[0].TagLine || "?",
  };
}


export async function getShop(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<StorefrontResponse>({
    url: getUrl({ name: "storefront", region: region, userId: userId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: {},
  });
  return res.data;
}

export async function parseShop(shop: StorefrontResponse) {
  /* NORMAL SHOP */
  let singleItemStoreOffers = shop.SkinsPanelLayout.SingleItemStoreOffers;
  let main: SkinShopItem[] = [];
  const { skins, buddies, cards, sprays, titles } = getAssets();

  for (let mainIndex = 0; mainIndex < singleItemStoreOffers.length; mainIndex++) {
    const offer = singleItemStoreOffers[mainIndex];

    const skin = skins.find((_skin) =>
      _skin.levels?.some((level) => level.uuid === offer.OfferID) ||
      _skin.chromas?.some((chroma) => chroma.uuid === offer.OfferID)
    );

    if (skin) {
      main[mainIndex] = {
        ...skin,
        price: offer.Cost[VCurrencies.VP],
      };
    }
  }

  /* BUNDLES */
  const bundles: BundleShopItem[] = [];
  const featuredBundles = shop.FeaturedBundle.Bundles?.length
    ? shop.FeaturedBundle.Bundles
    : shop.FeaturedBundle.Bundle
      ? [shop.FeaturedBundle.Bundle]
      : [];

  const bundleResults = await Promise.all(
    featuredBundles.map(async (bundle) => {
      const bundleAsset = await fetchBundle(bundle.DataAssetID);
      return { bundle, bundleAsset };
    })
  );

  for (const { bundle, bundleAsset } of bundleResults) {
    if (bundleAsset == null) continue;

    const allItems: (SkinShopItem | AccessoryShopItem)[] = [];

    for (const item of bundle.Items) {
      const uuid = item.Item.ItemID;
      const typeId = item.Item.ItemTypeID;
      const price = item.BasePrice;

      if (typeId === VItemTypes.SkinLevel || typeId === VItemTypes.SkinChroma) {
        const skin = skins.find((_skin) =>
          _skin.uuid === uuid ||
          _skin.levels?.some((level) => level.uuid === uuid) ||
          _skin.chromas?.some((chroma) => chroma.uuid === uuid)
        );
        if (skin) {
          allItems.push({ ...skin, price } as SkinShopItem);
        } else {
          allItems.push({
            uuid,
            displayName: "",
            themeUuid: "",
            assetPath: "",
            chromas: [],
            levels: [],
            price,
          } as SkinShopItem);
        }
      } else if (typeId === VItemTypes.Spray) {
        const spray = sprays.find((s) => s.uuid === uuid);
        if (spray) {
          allItems.push({
            uuid: spray.uuid,
            displayName: spray.displayName,
            displayIcon: spray.fullTransparentIcon || spray.displayIcon,
            price,
          });
        }
      } else if (typeId === VItemTypes.PlayerCard) {
        const card = cards.find((c) => c.uuid === uuid);
        if (card) {
          allItems.push({
            uuid: card.uuid,
            displayName: card.displayName,
            displayIcon: card.largeArt || card.displayIcon,
            price,
          });
        }
      } else if (typeId === VItemTypes.PlayerTitle) {
        const title = titles.find((t) => t.uuid === uuid);
        if (title) {
          allItems.push({
            uuid: title.uuid,
            displayName: title.displayName,
            price,
          });
        }
      } else if (typeId === VItemTypes.Buddy) {
        const buddy = buddies.find((b) =>
          b.levels?.some((level) => level.uuid === uuid)
        );
        if (buddy) {
          allItems.push({
            uuid: buddy.uuid,
            displayName: buddy.displayName,
            displayIcon: buddy.levels?.[0]?.displayIcon || buddy.displayIcon,
            price,
          });
        }
      }
    }

    bundles.push({
      ...bundleAsset,
      price: bundle.Items.map((item) => item.DiscountedPrice).reduce(
        (a, b) => a + b
      ),
      items: allItems,
    });
  }

  /* NIGHT MARKET */
  let nightMarket: NightMarketItem[] = [];
  if (shop.BonusStore) {
    const bonusStore = shop.BonusStore.BonusStoreOffers;
    for (let k = 0; k < bonusStore.length; k++) {
      let itemid = bonusStore[k].Offer.Rewards[0].ItemID;
      const skin = skins.find((_skin) =>
        _skin.levels?.some((level) => level.uuid === itemid) ||
        _skin.chromas?.some((chroma) => chroma.uuid === itemid)
      ) as ValorantSkin;

      nightMarket.push({
        ...skin,
        price: bonusStore[k].Offer.Cost[VCurrencies.VP],
        discountedPrice: bonusStore[k].DiscountCosts[VCurrencies.VP],
        discountPercent: bonusStore[k].DiscountPercent,
      });
    }
  }

  /* ACCESSORY SHOP */
  let accessoryStore = shop.AccessoryStore.AccessoryStoreOffers;
  let accessory: AccessoryShopItem[] = [];
  for (let accessoryIndex = 0; accessoryIndex < accessoryStore.length; accessoryIndex++) {
    const accessoryItem = accessoryStore[accessoryIndex].Offer;

    // This is a pain because of different return types
    const buddy = buddies.find((_buddy) =>
      _buddy.levels?.some((level) => level.uuid === accessoryItem.Rewards[0].ItemID)
    );
    const card = cards.find(
      (_card) => _card.uuid === accessoryItem.Rewards[0].ItemID
    );
    const title = titles.find(
      (_title) => _title.uuid === accessoryItem.Rewards[0].ItemID
    );
    const spray = sprays.find(
      (_spray) => _spray.uuid === accessoryItem.Rewards[0].ItemID
    );

    if (buddy) {
      accessory[accessoryIndex] = {
        uuid: buddy.levels[0].uuid,
        displayName: buddy.displayName,
        displayIcon: buddy.levels[0].displayIcon,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (card) {
      accessory[accessoryIndex] = {
        uuid: card.uuid,
        displayName: card.displayName,
        displayIcon: card.largeArt,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (title) {
      accessory[accessoryIndex] = {
        uuid: title.uuid,
        displayName: title.displayName,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (spray) {
      accessory[accessoryIndex] = {
        uuid: spray.uuid,
        displayName: spray.displayName,
        displayIcon: spray.fullTransparentIcon,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    }
  }

  return {
    main,
    bundles,
    nightMarket,
    accessory,
    remainingSecs: {
      main:
        shop.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds ?? 0,
      bundles: shop.FeaturedBundle.Bundles.map(
        (bundle) => bundle.DurationRemainingInSeconds
      ) ?? [0],
      nightMarket: shop.BonusStore?.BonusStoreRemainingDurationInSeconds ?? 0,
      accessory:
        shop.AccessoryStore.AccessoryStoreRemainingDurationInSeconds ?? 0,
    },
  };
}

export async function getBalances(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<WalletResponse>({
    url: getUrl({ name: "wallet", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });

  return {
    vp: res.data.Balances[VCurrencies.VP],
    rad: res.data.Balances[VCurrencies.RAD],
    fag: res.data.Balances[VCurrencies.FAG],
    kc: res.data.Balances[VCurrencies.KC],
  };
}

export async function getProgress(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<AccountXPResponse>({
    url: getUrl({ name: "playerxp", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return {
    level: res.data.Progress.Level,
    xp: res.data.Progress.XP,
  };
}


export const reAuth = (version: string) =>
  axios.request({
    url: "https://auth.riotgames.com/api/v1/authorization",
    method: "POST",
    headers: {
      "User-Agent": `RiotClient/${version} rso-auth (Windows; 10;;Professional, x64)`,
      "Content-Type": "application/json",
    },
    data: {
      client_id: "play-valorant-web-prod",
      nonce: "1",
      redirect_uri: "https://playvalorant.com/opt_in",
      response_type: "token id_token",
      response_mode: "query",
      scope: "account openid",
    },
    httpsAgent: new https.Agent({
      ciphers: [
        "TLS_CHACHA20_POLY1305_SHA256",
        "TLS_AES_128_GCM_SHA256",
        "TLS_AES_256_GCM_SHA384",
        "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
      ].join(":"),
      honorCipherOrder: true,
      minVersion: "TLSv1.2",
    }),
    withCredentials: true,
  });

export async function getMatchID(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const res = await axios.request<PreGamePlayerResponse>({
    url: getUrl({ name: "matchID", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.data.MatchID;
}

export async function lockAgent(
  accesstoken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);

  const res = await axios.request<LockCharacterResponse>({
    url: getUrl({ name: "lock", region: region, matchId: matchId, agentId: agentId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

export async function quitPreGameLobby(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: getUrl({ name: "quit", region: region, matchId: matchId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

function maskToken(token: string) {
  if (!token) return "";
  return `${token.slice(0, 12)}...${token.slice(-8)}`;
}

export async function playerLoadout(
    accesstoken: string,
    entitlementsToken: string,
    region: string,
    userId: string
) {
  const res = await axios.request<PlayerLoadoutResponse>({
    url: getUrl({ name: "player", region: region, userId: userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    },
  });

  console.log("Player Loadout status:", res.status);

  return res.status === 200 ? res.data : null;
}

export async function updatePlayerLoadout(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
) {
  const res = await axios.request<PlayerLoadoutResponse>({
    url: getUrl({ name: "player", region, userId }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: loadout,
  });

  return res.data;
}

export async function ownedItems(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  itemTypeId: string
) {
  const res = await axios.request<OwnedItemsResponse>({
    url: getUrl({
      name: "owned-items",
      region,
      userId,
      itemTypeId,
    }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : {};
}

export async function playerMatchHistory(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
) {
  const res = await axios.request({
    url: getUrl({ name: "match-history", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return res.data;
}

export async function getValorantSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<ValorantSessionResponse>({
    url: getUrl({ name: "session", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : null;
}

export async function hydrateRiotClientVersionFromSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const session = await getValorantSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  ).catch(() => null);
  const sessionVersion = session?.clientVersion?.trim();

  if (!sessionVersion) {
    return null;
  }

  return setRiotClientVersionOverride(sessionVersion);
}

export async function getCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const requestMmr = () => axios.request<CompetitiveMMRResponse>({
    url: getUrl({ name: "mmr", region: region, userId: userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  logValorantApiDebug("MMR_FetchPlayer request", {
    region,
    userId: maskSecretForLog(userId),
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await requestMmr();
  logValorantApiDebug("MMR_FetchPlayer response", {
    status: res.status,
    statusText: res.statusText,
    data: res.data,
  });

  if (res.status === 200) {
    return res.data;
  }

  const currentVersion = getRiotClientVersionForRequests();
  const sessionVersion = await hydrateRiotClientVersionFromSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  );

  if (sessionVersion && sessionVersion !== currentVersion) {
    const retryRes = await requestMmr();
    logValorantApiDebug("MMR_FetchPlayer retry response", {
      status: retryRes.status,
      statusText: retryRes.statusText,
      data: retryRes.data,
    });
    return retryRes.status === 200 ? retryRes.data : {};
  }

  return {};
}

export async function matchDetails(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
) {
  const res = await axios.request({
    url: getUrl({ name: "match-details", region: region, matchId: matchId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.data;
}

function getUrl({
  name,
  region,
  userId,
  matchId,
  agentId,
  itemTypeId,
  code,
}: {
  name: string;
  region?: string | null;
  userId?: string | null;
  matchId?: string | null;
  agentId?: string | null;
  itemTypeId?: string | null;
  code?: string | null;
}) {
  const shard = normalizeValorantShard(region);
  const URLS: Record<string, string> = {
    auth: "https://auth.riotgames.com/api/v1/authorization/",
    entitlements: "https://entitlements.auth.riotgames.com/api/token/v1/",
    storefront: `https://pd.${shard}.a.pvp.net/store/v3/storefront/${userId}`,
    wallet: `https://pd.${shard}.a.pvp.net/store/v1/wallet/${userId}`,
    playerxp: `https://pd.${shard}.a.pvp.net/account-xp/v1/players/${userId}`,
    weapons: "https://valorant-api.com/v1/weapons/",
    offers: `https://pd.${shard}.a.pvp.net/store/v1/offers/`,
    name: `https://pd.${shard}.a.pvp.net/name-service/v2/players`,
    matchID: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/players/${userId}`,
    lock: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/lock/${agentId}`,
    quit: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/quit`,
    player: `https://pd.${shard}.a.pvp.net/personalization/v2/players/${userId}/playerloadout`,
    mmr: `https://pd.${shard}.a.pvp.net/mmr/v1/players/${userId}`,
    "owned-items": `https://pd.${shard}.a.pvp.net/store/v1/entitlements/${userId}/${itemTypeId}`,
    "match-history": `https://pd.${shard}.a.pvp.net/match-history/v1/history/${userId}`,
    "match-details": `https://pd.${shard}.a.pvp.net/match-details/v1/matches/${matchId}`,
    "competitive-updates": `https://pd.${shard}.a.pvp.net/mmr/v1/players/${userId}/competitiveupdates`,
    session: `https://glz-${shard}-1.${shard}.a.pvp.net/session/v1/sessions/${userId}`,
    "pregame-player": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/players/${userId}`,
    "pregame-match": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}`,
    "select-agent": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/select/${agentId}`,
    "pregame-loadouts": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/loadouts`,
    "coregame-player": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/players/${userId}`,
    "coregame-match": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}`,
    "coregame-loadouts": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}/loadouts`,
    "coregame-quit": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}/quit`,
    "party-player": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/${userId}`,
    "party": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}`,
    "party-ready": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/members/${userId}/setReady`,
    "party-remove": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/${userId}`,
    "party-join-queue": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/matchmaking/join`,
    "party-leave-queue": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/matchmaking/leave`,
    "party-invite-code": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/invitecode`,
    "party-join-by-code": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/joinbycode/${code}`,
    "party-muc-token": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/muctoken`,
    "contracts": `https://pd.${shard}.a.pvp.net/contracts/v1/contracts/${userId}`,
    "activate-contract": `https://pd.${shard}.a.pvp.net/contracts/v1/contracts/${userId}/special/${itemTypeId}`,
    "item-upgrades": `https://pd.${shard}.a.pvp.net/contract-definitions/v3/item-upgrades`,
    "content": `https://shared.${shard}.a.pvp.net/content-service/v3/content`,
    "leaderboard": `https://pd.${shard}.a.pvp.net/mmr/v1/leaderboards/affinity/${shard}/queue/competitive/season/${itemTypeId}`,
    "config": `https://pd.${shard}.a.pvp.net/v1/config/${shard}`,
    "penalties": `https://pd.${shard}.a.pvp.net/restrictions/v3/penalties`,
    "playerinfo": "https://auth.riotgames.com/userinfo",
    "riotgeo": "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
    "pastoken": "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat",
    "riotclientconfig": "https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client",
  };

  return URLS[name];
}

// ---------------------------------------------------------------------------
// getCompetitiveUpdates
// ---------------------------------------------------------------------------
export async function getCompetitiveUpdates(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
) {
  logValorantApiDebug("MMR_FetchCompetitiveUpdates request", {
    region,
    userId: maskSecretForLog(userId),
    params,
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await axios.request({
    url: getUrl({ name: "competitive-updates", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  logValorantApiDebug("MMR_FetchCompetitiveUpdates response", {
    status: res.status,
    statusText: res.statusText,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// getPlayerNames  – resolves a list of subject UUIDs to GameName/TagLine
// ---------------------------------------------------------------------------
export async function getPlayerNames(
  accessToken: string,
  entitlementsToken: string,
  subjects: string[],
  region: string
): Promise<{ Subject: string; GameName: string; TagLine: string }[]> {
  const res = await axios.request<
    { Subject: string; GameName: string; TagLine: string }[]
  >({
    url: getUrl({ name: "name", region }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: subjects,
    validateStatus: () => true,
  });
  return Array.isArray(res.data) ? res.data : [];
}

// ---------------------------------------------------------------------------
// Pre-game
// ---------------------------------------------------------------------------
export async function getPreGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<PreGamePlayerResponse>({
    url: getUrl({ name: "pregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function getPreGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<LockCharacterResponse | null> {
  const res = await axios.request<LockCharacterResponse>({
    url: getUrl({ name: "pregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function selectAgent(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string
): Promise<any> {
  const matchId = await getMatchID(accessToken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: getUrl({ name: "select-agent", region, matchId, agentId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Core-game (live match)
// ---------------------------------------------------------------------------
export async function getCurrentGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<{ Subject: string; MatchID: string; Version: number }>({
    url: getUrl({ name: "coregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function getCurrentGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameMatchResponse | null> {
  const res = await axios.request<CurrentGameMatchResponse>({
    url: getUrl({ name: "coregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------
export async function getPartyPlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ CurrentPartyID: string; [key: string]: any } | null> {
  const res = await axios.request<{ CurrentPartyID: string; [key: string]: any }>({
    url: getUrl({ name: "party-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function getParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    // reuse matchId slot in getUrl to pass partyId
    url: getUrl({ name: "party", region, matchId: partyId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function getPartyMucToken(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyChatTokenResponse | null> {
  const url = getUrl({ name: "party-muc-token", region, matchId: partyId });
  const res = await axios.request<PartyChatTokenResponse>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const responseData = res.data as any;
  const logData =
    responseData && typeof responseData === "object"
      ? {
          ...responseData,
          Token: responseData.Token ? "[redacted]" : responseData.Token,
        }
      : responseData;
  console.log("[party-muc-token] response", {
    status: res.status,
    url,
    partyId,
    data: logData,
  });
  if (res.status !== 200) {
    const message =
      responseData?.message ||
      responseData?.errorCode ||
      `HTTP ${res.status}`;
    throw new Error(`Could not get party chat token (${res.status}: ${message})`);
  }
  return res.data;
}

export async function setPartyReady(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string,
  userId: string,
  ready: boolean
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-ready", region, matchId: partyId, userId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: { ready },
  });
  return res.status === 200 ? res.data : null;
}

export async function generatePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function disablePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

export async function joinPartyByCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  inviteCode: string
): Promise<{ CurrentPartyID?: string; [key: string]: any } | null> {
  const res = await axios.request<{ CurrentPartyID?: string; [key: string]: any }>({
    url: getUrl({
      name: "party-join-by-code",
      region,
      code: encodeURIComponent(inviteCode),
    }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export async function getContracts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: getUrl({ name: "contracts", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log("[contracts] response", {
    status: res.status,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Activate Contract
// ---------------------------------------------------------------------------
export async function activateContract(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  contractId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: getUrl({ name: "activate-contract", region, userId, itemTypeId: contractId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log("[activate-contract] response", {
    status: res.status,
    contractId,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Item Upgrades (Radianite skin upgrades)
// ---------------------------------------------------------------------------
export async function getItemUpgrades(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ItemUpgradesResponse | null> {
  const res = await axios.request<ItemUpgradesResponse>({
    url: getUrl({ name: "item-upgrades", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Fetch Content (seasons, acts, events)
// ---------------------------------------------------------------------------
export async function getContent(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ContentResponse | null> {
  const res = await axios.request<ContentResponse>({
    url: getUrl({ name: "content", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export async function getLeaderboard(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  seasonId: string,
  params?: { startIndex?: number; size?: number; query?: string }
): Promise<LeaderboardResponse | null> {
  const res = await axios.request<LeaderboardResponse>({
    url: getUrl({ name: "leaderboard", region, itemTypeId: seasonId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export async function getConfig(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ConfigResponse | null> {
  const res = await axios.request<ConfigResponse>({
    url: getUrl({ name: "config", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------
export async function getPenalties(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<PenaltiesResponse | null> {
  const res = await axios.request<PenaltiesResponse>({
    url: getUrl({ name: "penalties", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Player Info (from auth.riotgames.com/userinfo)
// ---------------------------------------------------------------------------
export async function getPlayerInfo(
  accessToken: string
): Promise<PlayerInfoResponse | null> {
  const res = await axios.request<PlayerInfoResponse>({
    url: getUrl({ name: "playerinfo" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Riot Geo (get region affinity)
// ---------------------------------------------------------------------------
export async function getRiotGeo(
  accessToken: string,
  idToken: string
): Promise<RiotGeoResponse | null> {
  const res = await axios.request<RiotGeoResponse>({
    url: getUrl({ name: "riotgeo" }),
    method: "PUT",
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: { id_token: idToken },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// PAS Token (chat XMPP auth)
// ---------------------------------------------------------------------------
export async function getPASToken(
  accessToken: string
): Promise<string | null> {
  const res = await axios.request<string>({
    url: getUrl({ name: "pastoken" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Riot Client Config
// ---------------------------------------------------------------------------
export async function getRiotClientConfig(
  accessToken: string,
  entitlementsToken: string
): Promise<RiotClientConfigResponse | null> {
  const res = await axios.request<RiotClientConfigResponse>({
    url: getUrl({ name: "riotclientconfig" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Pre-Game Loadouts
// ---------------------------------------------------------------------------
export async function getPregameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<PregameLoadoutsResponse | null> {
  const res = await axios.request<PregameLoadoutsResponse>({
    url: getUrl({ name: "pregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Current Game Loadouts
// ---------------------------------------------------------------------------
export async function getCurrentGameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameLoadoutsResponse | null> {
  const res = await axios.request<CurrentGameLoadoutsResponse>({
    url: getUrl({ name: "coregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Quit Current Game
// ---------------------------------------------------------------------------
export async function quitCurrentGame(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<any> {
  const res = await axios.request({
    url: getUrl({ name: "coregame-quit", region, matchId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Remove Player
// ---------------------------------------------------------------------------
export async function removeFromParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<void> {
  await axios.request({
    url: getUrl({ name: "party-remove", region, userId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Party: Enter Matchmaking Queue
// ---------------------------------------------------------------------------
export async function enterMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-join-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Leave Matchmaking Queue
// ---------------------------------------------------------------------------
export async function leaveMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-leave-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}
