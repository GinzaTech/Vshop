import { jwtDecode } from "jwt-decode";

import { loadAgent, loadAssets } from "./valorant-assets";
import {
  defaultUser,
  getBalances,
  getEntitlementsToken,
  getProgress,
  getShop,
  getUserId,
  getUsername,
  parseShop,
} from "./valorant-api";

const ACCESS_TOKEN_BUFFER_SECONDS = 90;

type AccessTokenPayload = {
  exp?: number;
};

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

  const [username, shop, progress, balances] =
    await Promise.all([
      getUsername(accessToken, entitlementsToken, userId, region),
      getShop(accessToken, entitlementsToken, region, userId),
      getProgress(accessToken, entitlementsToken, region, userId),
      getBalances(accessToken, entitlementsToken, region, userId),
    ]);

  const shops = await parseShop(shop);

  return {
    ...defaultUser,
    ...seedUser,
    id: userId,
    name: username.GameName,
    TagLine: username.TagLine,
    region,
    shops,
    progress,
    balances,
    accessToken,
    idToken,
    entitlementsToken,
  };
}
