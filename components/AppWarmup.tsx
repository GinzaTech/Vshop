import React from "react";

import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  preloadSessionResources,
  startBackgroundCatalogWarmup,
} from "~/utils/preload";

export default function AppWarmup() {
  const user = useUserStore((state) => state.user);
  const fetchMatches = useMatchStore((state) => state.fetchMatches);
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

    void preloadSessionResources(user);
    void fetchMatches(user);
    startBackgroundCatalogWarmup();
  }, [
    fetchMatches,
    user,
    user.accessToken,
    user.entitlementsToken,
    user.id,
    user.region,
    warmupKey,
  ]);

  return null;
}
