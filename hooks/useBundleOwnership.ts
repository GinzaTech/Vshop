import React from "react";

import {
  useAccountScreenData,
  type AccountScreenLoadResult,
  type AccountScreenSession,
} from "~/hooks/useAccountScreenData";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { createBundleOwnershipLookup, extractBundleOwnedItemIds, type BundleOwnershipMatcher } from "~/utils/bundle-ownership";
import { VItemTypes } from "~/utils/misc";
import { getAccountSessionKey } from "~/utils/saved-accounts";
import { ownedItems } from "~/utils/valorant-api";

type BundleOwnershipData = {
  ownedSkinIds: readonly string[];
  ownedByType: Readonly<Record<string, readonly string[]>>;
};

export type BundleOwnershipResult = {
  isOwned: BundleOwnershipMatcher;
  reload: () => Promise<void>;
};

const EMPTY_OWNERSHIP: BundleOwnershipData = { ownedSkinIds: [], ownedByType: {} };
const OWNERSHIP_LOG_LABEL = "[bundles] ownership error:";
const INVENTORY_TYPES = [VItemTypes.SkinLevel, VItemTypes.SkinChroma, VItemTypes.Spray,
  VItemTypes.Flex, VItemTypes.PlayerCard, VItemTypes.PlayerTitle, VItemTypes.Buddy];

function mergeOwnership(first: BundleOwnershipData, second: BundleOwnershipData): BundleOwnershipData {
  return {
    ownedSkinIds: [...new Set([...first.ownedSkinIds, ...second.ownedSkinIds])],
    ownedByType: Object.fromEntries(INVENTORY_TYPES.map((type) => [type,
      [...new Set([...(first.ownedByType[type] ?? []), ...(second.ownedByType[type] ?? [])])],
    ])),
  };
}

/** Read-only per-type evidence; shared account loader guards tokens, generation and request order. */
export function useBundleOwnership(): BundleOwnershipResult {
  const accountKey = useUserStore((state) => getAccountSessionKey(state.user));
  const seededData = React.useMemo<BundleOwnershipData>(() => {
    if (accountKey === "guest") return EMPTY_OWNERSHIP;
    const user = useUserStore.getState().user;
    const cache = useProfileCacheStore.getState().cacheByAuth[accountKey];
    return {
      ownedSkinIds: [...new Set([...(user.ownedSkinIds ?? []), ...(cache?.ownedSkinItemIds ?? [])])],
      ownedByType: {
        [VItemTypes.Spray]: [...(cache?.ownedSprayItemIds ?? [])],
        [VItemTypes.Flex]: [...(cache?.ownedFlexItemIds ?? [])],
        [VItemTypes.PlayerCard]: [...(cache?.ownedPlayerCardItemIds ?? [])],
        [VItemTypes.PlayerTitle]: [...(cache?.ownedPlayerTitleItemIds ?? [])],
        // ProfileWarmCache has no Buddy ownership category.
      },
    };
  }, [accountKey]);
  const positivesRef = React.useRef({ accountKey: "", data: EMPTY_OWNERSHIP });

  const load = React.useCallback(async (
    session: AccountScreenSession,
  ): Promise<AccountScreenLoadResult<BundleOwnershipData>> => {
    // A single bounded wave: exactly one existing ownedItems GET per supported category.
    const results = await Promise.allSettled(INVENTORY_TYPES.map(async (type) => {
      const response = await ownedItems(session.accessToken, session.entitlementsToken,
        session.region, session.id, type);
      return extractBundleOwnedItemIds(response, session.id, type);
    }));
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason as unknown] : []);
    if (results.every((result) => result.status === "rejected")) throw errors[0];
    const fetched: BundleOwnershipData = {
      ownedSkinIds: [],
      ownedByType: Object.fromEntries(results.map((result, index) => [INVENTORY_TYPES[index],
        result.status === "fulfilled" ? result.value : [],
      ])),
    };
    const previous = positivesRef.current.accountKey === getAccountSessionKey(session)
      ? positivesRef.current.data : EMPTY_OWNERSHIP;
    // Never publish into refs here: only the shared loader may adopt this completion.
    return { data: mergeOwnership(mergeOwnership(seededData, previous), fetched), errors };
  }, [seededData]);

  const { data, reload } = useAccountScreenData(load, seededData, OWNERSHIP_LOG_LABEL);
  // Retain accepted positives through same-account token renewal, including total failure.
  const visibleData = React.useMemo(() => accountKey === "guest" ? EMPTY_OWNERSHIP :
    mergeOwnership(data, positivesRef.current.accountKey === accountKey
      ? positivesRef.current.data : EMPTY_OWNERSHIP), [accountKey, data]);
  React.useEffect(() => {
    // Account/guest transitions retire evidence; rejected loads never reach this effect.
    positivesRef.current = { accountKey, data: visibleData };
  }, [accountKey, visibleData]);
  const isOwned = React.useMemo(() => createBundleOwnershipLookup(
    visibleData.ownedSkinIds, visibleData.ownedByType,
  ), [visibleData]);
  return { isOwned, reload };
}
