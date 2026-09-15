import { useCombatStore, type CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { hasRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";

const EMPTY_SNAPSHOT: CombatSessionSnapshot = {
  state: "idle", matchId: null, partyId: null, pregameMatch: null,
  currentGameMatch: null, party: null, namesBySubject: {},
};

/** A mounted but blurred screen must not expose a previous account's roster. */
export function useCombatSnapshot(session: RiotScreenSession) {
  const snapshot = useCombatStore((state) => state.snapshot);
  const owner = useCombatStore((state) => state.sessionKey);
  const expectedOwner = `${session.region.toLowerCase()}|${session.id.toLowerCase()}`;
  return hasRiotScreenSession(session) && owner === expectedOwner ? snapshot : EMPTY_SNAPSHOT;
}
