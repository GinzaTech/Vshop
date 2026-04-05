import React from "react";
import * as Network from "expo-network";
import { InteractionManager } from "react-native";

import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { fetchProfileWarmCache } from "~/utils/profile-cache";
import {
  preloadSessionResources,
  startBackgroundCatalogWarmup,
} from "~/utils/preload";

export default function AppWarmup() {
  const user = useUserStore((state) => state.user);
  const fetchMatches = useMatchStore((state) => state.fetchMatches);
  const setProfileCache = useProfileCacheStore((state) => state.setProfileCache);
  const sessionUserRef = React.useRef(user);
  const warmupKey = React.useMemo(
    () =>
      [
        user.id,
        user.region,
        user.shops.main.map((item) => item.uuid).join(","),
        user.shops.bundles.map((bundle) => bundle.uuid).join(","),
        user.shops.nightMarket.map((item) => item.uuid).join(","),
      ].join("|"),
    [user.id, user.region, user.shops.bundles, user.shops.main, user.shops.nightMarket]
  );
  const lastWarmupKey = React.useRef<string>("");
  const warmupStartedRef = React.useRef(false);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const interactionsRef = React.useRef<
    { cancel?: () => void | Promise<void> }[]
  >([]);

  React.useEffect(() => {
    sessionUserRef.current = user;
  }, [user]);

  React.useEffect(() => {
    if (
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region ||
      !user.id
    ) {
      return;
    }

    if (lastWarmupKey.current === warmupKey) {
      return;
    }

    lastWarmupKey.current = warmupKey;

    if (warmupStartedRef.current) {
      return;
    }

    warmupStartedRef.current = true;

    const clearScheduledWork = () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
      interactionsRef.current.forEach((task) => task.cancel?.());
      interactionsRef.current = [];
    };

    const scheduleTask = (delayMs: number, task: () => void | Promise<void>) => {
      const timer = setTimeout(() => {
        const interactionTask = InteractionManager.runAfterInteractions(() => {
          void task();
        });
        interactionsRef.current.push(interactionTask);
      }, delayMs);

      timersRef.current.push(timer);
    };

    void (async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isCellular =
          networkState.type === Network.NetworkStateType.CELLULAR;
        const currentUser = sessionUserRef.current;

        scheduleTask(120, () =>
          preloadSessionResources(currentUser, { cellular: isCellular })
        );
        scheduleTask(isCellular ? 420 : 260, () => fetchMatches(currentUser));
        scheduleTask(isCellular ? 980 : 520, async () => {
          const cache = await fetchProfileWarmCache(currentUser);
          if (cache) {
            setProfileCache(cache);
          }
        });

        if (!isCellular) {
          scheduleTask(1800, () => startBackgroundCatalogWarmup());
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[warmup] preload failed", error);
        }
      } finally {
        warmupStartedRef.current = false;
      }
    })();

    return () => {
      clearScheduledWork();
    };
  }, [
    fetchMatches,
    setProfileCache,
    user.accessToken,
    user.entitlementsToken,
    user.id,
    user.region,
    warmupKey,
  ]);

  return null;
}
