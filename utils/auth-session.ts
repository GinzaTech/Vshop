import { jwtDecode } from "jwt-decode";

import { loadAgent, loadAssets } from "./valorant-assets";
import {
  defaultUser,
  getBalances,
  getEntitlementsToken,
  getProgress,
  getRiotGeo,
  getShop,
  getUserId,
  getUsername,
  parseShop,
} from "./valorant-api";
import { normalizeValorantShard } from "./misc";

const ACCESS_TOKEN_BUFFER_SECONDS = 90;

type AccessTokenPayload = {
  exp?: number;
};

const normalizeRegion = (region?: string | null) =>
  normalizeValorantShard(region);

async function resolveLiveRegion(
  accessToken: string,
  idToken: string,
  fallbackRegion: string
) {
  if (!idToken) {
    return normalizeRegion(fallbackRegion);
  }

  const geo = await getRiotGeo(accessToken, idToken).catch(() => null);
  const liveRegion = normalizeRegion(geo?.affinities?.live);

  return liveRegion || normalizeRegion(fallbackRegion);
}

export const hasReusableAccessToken = (accessToken?: string) => {
  if (!accessToken) {
    return false;
  }

  try {
    const payload = jwtDecode<AccessTokenPayload>(accessToken);

    if (!payload.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now() + ACCESS_TOKEN_BUFFER_SECONDS * 1000;
  } catch {
    return false;
  }
};

export const canResumeUserSession = (
  user: typeof defaultUser,
  regionOverride?: string | null
) =>
  Boolean(
    (user.region || regionOverride) &&
      user.accessToken &&
      hasReusableAccessToken(user.accessToken)
  );

export async function buildAuthenticatedUser(
  accessToken: string,
  region: string,
  seedUser?: typeof defaultUser,
  idToken = seedUser?.idToken ?? ""
) {
  await Promise.all([loadAssets(), loadAgent()]);

  const entitlementsToken = await getEntitlementsToken(accessToken);
  const userId = getUserId(accessToken);
  const liveRegion = await resolveLiveRegion(accessToken, idToken, region);

  const [username, shop, progress, balances] =
    await Promise.all([
      getUsername(accessToken, entitlementsToken, userId, liveRegion),
      getShop(accessToken, entitlementsToken, liveRegion, userId),
      getProgress(accessToken, entitlementsToken, liveRegion, userId),
      getBalances(accessToken, entitlementsToken, liveRegion, userId),
    ]);

  const shops = await parseShop(shop);

  return {
    ...defaultUser,
    ...seedUser,
    id: userId,
    name: username.GameName,
    TagLine: username.TagLine,
    region: liveRegion,
    shops,
    progress,
    balances,
    accessToken,
    idToken,
    entitlementsToken,
  };
}
