import React from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCombatStore, type CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";
import { selectAndLockPregameAgent } from "~/services/riot/pregame-actions";
import { getSessionGeneration } from "~/utils/session-operations";

type HandledMatch = { opened: boolean; entered: boolean };
// Token-free and bounded across screen remounts/renewal. Oldest matches are
// evicted after 128 distinct account/region/match combinations in this process.
let handledMatches = new Map<string, HandledMatch>();
function remember(key: string, change: Partial<HandledMatch>) {
  const next = new Map(handledMatches);
  next.set(key, { opened: false, entered: false, ...next.get(key), ...change });
  if (next.size > 128) {
    const oldest = next.keys().next().value;
    if (oldest !== undefined) next.delete(oldest);
  }
  handledMatches = next;
}

type FlowOptions = {
  session: RiotScreenSession;
  snapshot: CombatSessionSnapshot;
  enabled: boolean;
  agents: readonly ValorantAgent[];
  onEnterMatch: () => void;
};
type FlowState = {
  key: string;
  visible: boolean;
  selectedAgentId: string | null;
  locking: boolean;
  errorMessage: string | null;
};
const initial = (key: string): FlowState => ({ key, visible: false, selectedAgentId: null, locking: false, errorMessage: null });
const selfPlayer = (snapshot: CombatSessionSnapshot, id: string) =>
  snapshot.pregameMatch?.AllyTeam?.Players.find((player) => player.Subject === id);
const isPregame = (snapshot: CombatSessionSnapshot, id: string) =>
  snapshot.state === "pregame" && Boolean(snapshot.matchId) && snapshot.pregameMatch?.ID === snapshot.matchId &&
  snapshot.pregameMatch.PregameState === "character_select_active" && Boolean(selfPlayer(snapshot, id));
const isAvailable = (snapshot: CombatSessionSnapshot, id: string, agentId: string, agents: readonly ValorantAgent[]) =>
  agents.some((agent) => agent.uuid === agentId) && !snapshot.pregameMatch?.AllyTeam?.Players.some((player) =>
    player.Subject !== id && player.CharacterID === agentId && player.CharacterSelectionState === "locked");

export function usePregameAgentFlow({ session, snapshot, enabled, agents, onEnterMatch }: FlowOptions) {
  const { t } = useTranslation();
  const activity = useCombatScreenActivity();
  const { isActiveNow } = activity;
  const fetchSession = useCombatStore((state) => state.fetchSession);
  const owner = `${session.region.toLowerCase()}|${session.id.toLowerCase()}`;
  const key = `${owner}|${snapshot.matchId ?? ""}`;
  const generation = getSessionGeneration();
  const mounted = React.useRef(false);
  const epoch = React.useRef(0);
  const pending = React.useRef<{ epoch: number; task: Promise<void> } | null>(null);
  const [state, setState] = React.useState(() => initial(key));
  const context = React.useRef({ key, generation, session, enabled, active: activity.isActive });
  const previous = context.current;
  if (previous.key !== key || previous.generation !== generation || previous.enabled !== enabled || previous.active !== activity.isActive ||
    previous.session.id !== session.id || previous.session.region !== session.region ||
    previous.session.accessToken !== session.accessToken || previous.session.entitlementsToken !== session.entitlementsToken) epoch.current += 1;
  context.current = { key, generation, session, enabled, active: activity.isActive };
  const renderEpoch = epoch.current;
  const currentMatch = React.useCallback(() => {
    if (!mounted.current || epoch.current !== renderEpoch || !enabled || !isActiveNow() ||
      !hasRiotScreenSession(session) || !isCurrentRiotScreenSession(session) || generation !== getSessionGeneration()) return false;
    const store = useCombatStore.getState();
    return store.sessionKey === owner && store.snapshot.matchId === snapshot.matchId;
  }, [isActiveNow, enabled, generation, owner, renderEpoch, session, snapshot.matchId]);
  const current = React.useCallback(() => currentMatch() && useCombatStore.getState().snapshot.state === snapshot.state, [currentMatch, snapshot.state]);
  const view = state.key === key ? state : initial(key);
  const pregame = isPregame(snapshot, session.id);
  const locked = selfPlayer(snapshot, session.id)?.CharacterSelectionState === "locked";
  const entered = handledMatches.get(key)?.entered === true;
  const visible = enabled && activity.isActive && pregame && !locked && !entered && view.visible;
  const selectedAgentId = view.selectedAgentId && isAvailable(snapshot, session.id, view.selectedAgentId, agents) ? view.selectedAgentId : null;

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current += 1; };
  }, []);
  // Invalidate at the event boundary, including background/foreground changes
  // that React batches into one render with an unchanged final active value.
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") epoch.current += 1;
    });
    return () => { subscription.remove(); };
  }, []);
  useFocusEffect(React.useCallback(() => () => { epoch.current += 1; }, []));
  React.useEffect(() => {
    setState((old) => old.key === key ? { ...old, locking: false } : initial(key));
  }, [key, renderEpoch]);

  const enter = React.useCallback((isAllowed: () => boolean = current) => {
    if (!isAllowed() || handledMatches.get(key)?.entered) return;
    remember(key, { entered: true });
    setState((old) => ({ ...old, visible: false, locking: false }));
    if (isAllowed()) onEnterMatch();
  }, [current, key, onEnterMatch]);
  React.useEffect(() => {
    if (!current()) return;
    if (snapshot.state === "live" && snapshot.matchId) { enter(); return; }
    if (snapshot.state === "pregame" && snapshot.pregameMatch?.ID === snapshot.matchId && locked) { enter(); return; }
    if (pregame && !handledMatches.get(key)?.opened && !handledMatches.get(key)?.entered) {
      remember(key, { opened: true });
      setState((old) => ({ ...(old.key === key ? old : initial(key)), visible: true }));
    }
  }, [current, enter, key, locked, pregame, snapshot.matchId, snapshot.pregameMatch?.ID, snapshot.state]);

  const onSelect = React.useCallback((id: string) => {
    if (!current() || !visible || pending.current?.epoch === renderEpoch || !isAvailable(useCombatStore.getState().snapshot, session.id, id, agents)) return;
    setState((old) => ({ ...old, selectedAgentId: id, errorMessage: null }));
  }, [agents, current, renderEpoch, session.id, visible]);
  const onClose = React.useCallback(() => {
    if (!current()) return;
    epoch.current += 1;
    setState((old) => ({ ...old, visible: false, locking: false }));
  }, [current]);
  const onOpen = React.useCallback(() => {
    if (!current() || !pregame || locked || handledMatches.get(key)?.entered) return;
    setState((old) => ({ ...old, visible: true }));
  }, [current, key, locked, pregame]);
  const onLock = React.useCallback(async () => {
    if (!current() || !visible || pending.current?.epoch === renderEpoch) return;
    const latest = useCombatStore.getState().snapshot;
    if (!isPregame(latest, session.id) || selfPlayer(latest, session.id)?.CharacterSelectionState === "locked") return;
    if (!selectedAgentId || !isAvailable(useCombatStore.getState().snapshot, session.id, selectedAgentId, agents)) {
      setState((old) => ({ ...old, errorMessage: t("combat.select_agent_message", { defaultValue: "Choose an agent before trying to lock." }) }));
      return;
    }
    const matchId = snapshot.matchId!;
    const actionEpoch = epoch.current;
    const valid = () => epoch.current === actionEpoch && current() && isPregame(useCombatStore.getState().snapshot, session.id);
    const canMutate = () => valid() && selfPlayer(useCombatStore.getState().snapshot, session.id)?.CharacterSelectionState !== "locked" &&
      isAvailable(useCombatStore.getState().snapshot, session.id, selectedAgentId, agents);
    setState((old) => ({ ...old, locking: true, errorMessage: null }));
    const task = (async () => {
      try {
        await selectAndLockPregameAgent({ session, expectedMatchId: matchId, agentId: selectedAgentId, isCurrent: canMutate });
      } catch {
        if (valid()) setState((old) => ({ ...old, locking: false, errorMessage: t("combat.lock_failed_message", { defaultValue: "Unable to lock that agent right now." }) }));
        return;
      }
      // The service has confirmed this bound match's locked self. A refresh is
      // advisory: it must not undo success, delay entry or produce a lock error.
      if (!currentMatch()) return;
      enter(currentMatch);
      if (!currentMatch()) return;
      try { await fetchSession(session); }
      catch {
        // Keep the confirmed success; the tracker's 3-second poll retries reads.
      }
    })();
    pending.current = { epoch: actionEpoch, task };
    await task;
    if (pending.current?.task === task) pending.current = null;
  }, [agents, current, currentMatch, enter, fetchSession, renderEpoch, selectedAgentId, session, snapshot.matchId, t, visible]);
  return { visible, selectedAgentId, locking: view.locking && visible, errorMessage: view.errorMessage, onSelect, onLock, onClose, onOpen };
}
