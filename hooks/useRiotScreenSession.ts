import { useMemo } from "react";
import { useUserStore } from "~/hooks/useUserStore";

export type RiotScreenSession = Pick<ReturnType<typeof useUserStore.getState>["user"], "id" | "region" | "accessToken" | "entitlementsToken">;

/** Stable across unrelated store updates; tokens remain private in memory. */
export function useRiotScreenSession(user: RiotScreenSession): RiotScreenSession {
  const { id, region, accessToken, entitlementsToken } = user;
  return useMemo(() => ({ id, region, accessToken, entitlementsToken }), [id, region, accessToken, entitlementsToken]);
}

export function hasRiotScreenSession(session: RiotScreenSession): boolean {
  return Boolean(session.id && session.region && session.accessToken && session.entitlementsToken);
}

/** Read the live store, including changes that React has not rendered yet. */
export function isCurrentRiotScreenSession(session: RiotScreenSession): boolean {
  const current = useUserStore.getState().user;
  return current.id === session.id && current.region === session.region &&
    current.accessToken === session.accessToken && current.entitlementsToken === session.entitlementsToken;
}
