import { jwtDecode } from "jwt-decode";

import { loadAgent, loadAssets } from "./valorant-assets";
import {
  defaultUser,
  getBalances,
  getEntitlementsToken,
  OwnedItemsResponse,
  getProgress,
  getShop,
  getUserId,
  getUsername,
  ownedItems,
  parseShop,
} from "./valorant-api";
import { VItemTypes } from "./misc";

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
  seedUser?: typeof defaultUser
) {
  await Promise.all([loadAssets(), loadAgent()]);

  const entitlementsToken = await getEntitlementsToken(accessToken);
  const userId = getUserId(accessToken);

  const [username, shop, progress, balances, ownedSkinResults] =
    await Promise.all([
      getUsername(accessToken, entitlementsToken, userId, region),
      getShop(accessToken, entitlementsToken, region, userId),
      getProgress(accessToken, entitlementsToken, region, userId),
      getBalances(accessToken, entitlementsToken, region, userId),
      Promise.allSettled([
        ownedItems(
          accessToken,
          entitlementsToken,
          region,
          userId,
          VItemTypes.SkinLevel
        ),
        ownedItems(
          accessToken,
          entitlementsToken,
          region,
          userId,
          VItemTypes.SkinChroma
        ),
      ]),
    ]);

  const shops = await parseShop(shop);
  const settledOwnedSkinResults = Array.isArray(ownedSkinResults)
    ? ownedSkinResults.filter(
        (
          result
        ): result is PromiseSettledResult<OwnedItemsResponse> => Boolean(result)
      )
    : [];
  const ownedSkinIds = Array.from(
    new Set(
      settledOwnedSkinResults.flatMap((result) =>
        result.status === "fulfilled"
          ? (result.value?.EntitlementsByTypes ?? []).flatMap((entry) =>
              (entry.Entitlements ?? []).map((entitlement) => entitlement.ItemID)
            )
          : []
      )
    )
  );

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
    ownedSkinIds,
    accessToken,
    entitlementsToken,
  };
}
