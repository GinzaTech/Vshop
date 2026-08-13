import React from "react";

export function useAsyncRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshInFlight = React.useRef(false);

  const onRefresh = React.useCallback(async () => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      if (__DEV__) console.warn("[refresh] Failed to refresh screen", error);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
