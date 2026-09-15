import React from "react";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import { hasRiotScreenSession, isCurrentRiotScreenSession, useRiotScreenSession } from "~/hooks/useRiotScreenSession";
import type { MatchDetailsData, MatchPlayerIdentity } from "~/types/match-ui";
import { getPlayerNames } from "~/utils/valorant-api";
import { getAccountSessionKey } from "~/utils/saved-accounts";
import { getSessionGeneration } from "~/utils/session-operations";
import { sanitizeErrorForLog } from "~/utils/log-redaction";

const identitySubject = (identity: MatchPlayerIdentity) =>
  (identity.Subject ?? identity.subject ?? "").trim().toLowerCase();

/** Own both detail and name responses by mounted route, account credentials and generation. */
export function useMatchDetailsData(matchId: string, isDemo: boolean, errorMessage: string) {
  const user = useUserStore((state) => state.user);
  const session = useRiotScreenSession(user);
  const generation = getSessionGeneration();
  const owner = React.useMemo(() => ({ session, generation, matchId, isDemo }), [session, generation, matchId, isDemo]);
  const authKey = getAccountSessionKey(session);
  const cachedDetails = useMatchStore((state) =>
    authKey !== "guest" && state.authKey === authKey && matchId ? state.detailsById[matchId] : undefined
  );
  const fetchMatchDetails = useMatchStore((state) => state.fetchMatchDetails);
  const activeOwner = React.useRef<typeof owner | null>(null);
  const detailRequest = React.useRef(0);
  const [state, setState] = React.useState({
    owner, details: cachedDetails ?? null as MatchDetailsData | null,
    loading: !isDemo && !cachedDetails, error: null as string | null,
  });
  const isCurrent = React.useCallback(() => activeOwner.current === owner &&
    owner.generation === getSessionGeneration() && isCurrentRiotScreenSession(owner.session), [owner]);

  React.useEffect(() => {
    activeOwner.current = owner;
    return () => { activeOwner.current = null; detailRequest.current += 1; };
  }, [owner]);

  const loadDetails = React.useCallback(async (force = false) => {
    if (owner.isDemo || !isCurrent()) return;
    if (!owner.matchId || !hasRiotScreenSession(owner.session)) {
      setState({ owner, details: null, loading: false, error: errorMessage });
      return;
    }
    const requestId = ++detailRequest.current;
    const ownsRequest = () => isCurrent() && requestId === detailRequest.current;
    setState((previous) => ({ owner, details: previous.owner === owner ? previous.details : null, loading: true, error: null }));
    try {
      const response = await fetchMatchDetails(useUserStore.getState().user, owner.matchId, force);
      if (!ownsRequest()) return;
      setState((previous) => ownsRequest() ? {
        owner, details: response ?? previous.details, loading: false,
        error: response ? null : errorMessage,
      } : previous);
    } catch (error) {
      if (!ownsRequest()) return;
      if (__DEV__) console.warn("Failed to load match details", sanitizeErrorForLog(error));
      setState((previous) => ownsRequest() ? { ...previous, loading: false, error: errorMessage } : previous);
    }
  }, [errorMessage, fetchMatchDetails, isCurrent, owner]);

  React.useEffect(() => {
    if (owner.isDemo) return;
    if (cachedDetails && hasRiotScreenSession(owner.session) && isCurrent()) {
      setState({ owner, details: cachedDetails, loading: false, error: null });
    } else {
      void loadDetails();
    }
  }, [cachedDetails, isCurrent, loadDetails, owner]);

  // Mask previous route/account data during the render before its effects run.
  const details = state.owner === owner ? state.details : cachedDetails ?? null;
  React.useEffect(() => {
    if (owner.isDemo || !details || !hasRiotScreenSession(owner.session) || !isCurrent()) return;
    const source = details;
    const existingIdentities = [...(source.PlayerIdentities ?? []), ...(source.playerIdentities ?? [])];
    const namedSubjects = new Set(existingIdentities.filter((identity) =>
      Boolean(identity.GameName || identity.gameName)
    ).map(identitySubject));
    const subjects = [...new Set(source.players.filter((player) =>
      !player.gameName && !namedSubjects.has(player.subject.trim().toLowerCase())
    ).map((player) => player.subject.trim().toLowerCase()).filter(Boolean))].sort();
    if (subjects.length === 0) return;
    let disposed = false;
    const canApplyNames = () => {
      if (disposed || !isCurrent()) return false;
      const cache = useMatchStore.getState();
      const current = cache.detailsById[owner.matchId];
      return cache.authKey === authKey && (!current || current === source);
    };
    void getPlayerNames(owner.session.accessToken, owner.session.entitlementsToken, subjects, owner.session.region)
      .then((names) => {
        if (!canApplyNames()) return;
        const identities: MatchPlayerIdentity[] = names.filter((name) =>
          name.GameName && subjects.includes(name.Subject.trim().toLowerCase())
        ).map((name) => ({ Subject: name.Subject, GameName: name.GameName, TagLine: name.TagLine }));
        if (identities.length === 0) return;
        const resolved = new Set(identities.map(identitySubject));
        const playerIdentities = [...existingIdentities.filter((identity) => !resolved.has(identitySubject(identity))), ...identities];
        setState((previous) => canApplyNames() && previous.owner === owner && previous.details === source
          ? { ...previous, details: { ...source, playerIdentities } } : previous);
        const cache = useMatchStore.getState();
        if (cache.detailsById[owner.matchId] === source) {
          cache.mergeMatchDetails(owner.matchId, { playerIdentities });
        }
      })
      .catch((error: unknown) => {
        if (__DEV__ && canApplyNames()) console.warn("Failed to resolve match player names", sanitizeErrorForLog(error));
      });
    return () => { disposed = true; };
  }, [authKey, details, isCurrent, owner]);

  return {
    details,
    loading: state.owner === owner ? state.loading : !isDemo && !cachedDetails,
    error: state.owner === owner ? state.error : null,
    loadDetails,
  };
}
