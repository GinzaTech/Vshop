import React from "react";
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { formatSessionQueueLabel } from "~/utils/valorant-session";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import { useCombatStore, type CombatSessionSnapshot } from "~/hooks/useCombatStore";
import { hasRiotScreenSession, isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useUserStore } from "~/hooks/useUserStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useChatStore } from "~/utils/chat-store";
import { getAssets } from "~/utils/valorant-assets";
import { getSessionGeneration } from "~/utils/session-operations";
import { getPartyState, invitePartyFriend, joinPartyWithCode, parsePartyRiotId, requirePartyCode, requirePartyText, setPartyAccessibility, setPartyQueue } from "~/services/riot/party-api";
import { makePartyCustom, makePartyDefault, startPartyCustomGame } from "~/services/riot/party-custom-api";
import { enterMatchmakingQueue, leaveMatchmakingQueue, removeFromParty, setPartyReady, generatePartyInviteCode } from "~/services/riot/combat-api";
import { buildPartyViewModel, readNormalQueueIds, type NormalQueueHistory } from "./party-model";
import type { PartyResponse } from "~/services/riot/api-types";
import type { PartyAction, PartyActions } from "./party-types";

type Scope = { session: RiotScreenSession; generation: number; activityRevision: number };
type ControllerState = Scope & {
  refreshing: boolean; busyAction: PartyAction | null; errorMessage: string | null;
  optimisticReady?: { partyId: string; value: boolean };
  confirmationUncertain?: boolean;
  baseSnapshot?: CombatSessionSnapshot; snapshot?: CombatSessionSnapshot;
};
type ControllerInput = { session: RiotScreenSession; snapshot: CombatSessionSnapshot; enabled: boolean };
type ConfirmedReceipt = { scope: Scope; snapshot: CombatSessionSnapshot; confirmationsRemaining: number };
const MAX_RECEIPT_CONFIRMATION_READS = 3;
const ownerKey = (session: RiotScreenSession) => `${session.region.toLowerCase()}|${session.id.toLowerCase()}`;
const sameScope = (left: Scope, right: Scope) => left.session === right.session && left.generation === right.generation;
const sameActivity = (left: Scope, right: Scope) => sameScope(left, right) && left.activityRevision === right.activityRevision;
const partyVersion = (party: PartyResponse | null) => typeof party?.Version === "number" && Number.isInteger(party.Version) && party.Version >= 0 ? party.Version : undefined;
const isOlderPartyRead = (read: PartyResponse | null, confirmed: PartyResponse | null) => {
  const readVersion = partyVersion(read); const confirmedVersion = partyVersion(confirmed);
  return read?.ID === confirmed?.ID && readVersion !== undefined && confirmedVersion !== undefined && readVersion < confirmedVersion;
};
const EMPTY_SNAPSHOT: CombatSessionSnapshot = { state: "idle", matchId: null, partyId: null, party: null, pregameMatch: null, currentGameMatch: null, namesBySubject: {} };
const ACTIVITY_KEYS: Record<string, string> = {
  MENUS: "friends_page.in_menu", PREGAME: "friends_page.in_pregame", INGAME: "friends_page.in_game",
  chat: "friends_page.online", online: "friends_page.online", mobile: "friends_page.mobile",
  dnd: "friends_page.dnd", away: "party_page.away",
};
function receiptMatches(read: PartyResponse | null, confirmed: PartyResponse | null): boolean {
  if (!read || !confirmed || read.ID !== confirmed.ID) return false;
  for (const field of ["State", "Accessibility", "InviteCode"] as const) {
    if (confirmed[field] !== undefined && read[field] !== confirmed[field]) return false;
  }
  const queue = confirmed.MatchmakingData?.QueueID;
  if (queue !== undefined && read.MatchmakingData?.QueueID !== queue) return false;
  return confirmed.Members.every((member) => {
    if (!member || typeof member.Subject !== "string") return false;
    const observed = read.Members.find((candidate) => candidate && typeof candidate.Subject === "string" && candidate.Subject.toLowerCase() === member.Subject.toLowerCase());
    return Boolean(observed) && (typeof member.IsReady !== "boolean" || observed?.IsReady === member.IsReady) &&
      (typeof member.IsOwner !== "boolean" || observed?.IsOwner === member.IsOwner);
  });
}
function preserveReceipt(read: PartyResponse | null, confirmed: PartyResponse | null): boolean {
  const readVersion = partyVersion(read); const confirmedVersion = partyVersion(confirmed);
  if (readVersion !== undefined && confirmedVersion !== undefined && readVersion !== confirmedVersion) return readVersion < confirmedVersion;
  return !receiptMatches(read, confirmed);
}
function applyPartyReceipt(read: CombatSessionSnapshot, confirmed: CombatSessionSnapshot | null) {
  if (!confirmed || (read.partyId && read.partyId !== confirmed.partyId)) return read;
  if (!preserveReceipt(read.party, confirmed.party)) return read;
  return { ...read, party: confirmed.party, partyId: confirmed.partyId };
}

export function usePartyController({ session, snapshot, enabled }: ControllerInput) {
  const { t } = useTranslation();
  const generation = getSessionGeneration();
  const snapshotOwner = useCombatStore((combat) => combat.sessionKey);
  const currentUser = useUserStore((userState) => userState.user);
  const selfLevel = currentUser.id === session.id && currentUser.region === session.region &&
    currentUser.accessToken === session.accessToken && currentUser.entitlementsToken === session.entitlementsToken && snapshotOwner === ownerKey(session)
    ? currentUser.progress?.level : undefined;
  const activity = React.useRef({ enabled, revision: 0 });
  if (activity.current.enabled !== enabled) activity.current = { enabled, revision: activity.current.revision + 1 };
  const activityRevision = activity.current.revision;
  const scope = React.useMemo(() => ({ session, generation, activityRevision }), [session, generation, activityRevision]);
  const enabledNow = React.useRef(enabled); enabledNow.current = enabled;
  const mounted = React.useRef(true);
  const inputSnapshot = React.useRef(snapshot); inputSnapshot.current = snapshot;
  const pendingRefresh = React.useRef<(Scope & { promise: Promise<unknown> }) | null>(null);
  const pendingAction = React.useRef<Promise<unknown> | null>(null);
  const reconciliationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const readRevision = React.useRef(0);
  const receipt = React.useRef<ConfirmedReceipt | null>(null);
  const joined = React.useRef<{ scope: Scope; partyId: string } | null>(null);
  const confirmedAbsence = React.useRef<Scope | null>(null);
  const normalQueueHistory = React.useRef<NormalQueueHistory | undefined>(undefined);
  const lastGood = React.useRef<{ scope: Scope; snapshot: CombatSessionSnapshot } | null>(null);
  const seenSnapshot = React.useRef<CombatSessionSnapshot | null>(null);
  if (snapshot !== seenSnapshot.current) {
    seenSnapshot.current = snapshot;
    if (snapshot.party && snapshotOwner === ownerKey(session) && isCurrentRiotScreenSession(session)) lastGood.current = { scope, snapshot };
  }
  const [state, setState] = React.useState<ControllerState>({ ...scope, refreshing: false, busyAction: null, errorMessage: null });
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (reconciliationTimer.current !== null) clearTimeout(reconciliationTimer.current);
    };
  }, []);
  const isCurrent = React.useCallback(() => mounted.current && enabledNow.current && hasRiotScreenSession(session) &&
    isCurrentRiotScreenSession(session) && getSessionGeneration() === generation && activity.current.revision === activityRevision, [activityRevision, generation, session]);
  const update = React.useCallback((patch: Partial<ControllerState>) => {
    if (isCurrent()) setState((current) => ({ ...(sameActivity(current, scope) ? current : { ...scope, refreshing: false, busyAction: null, errorMessage: null }), ...patch }));
  }, [isCurrent, scope]);
  const friends = useChatStore((chat) => chat.friends);
  const friendConnectionStatus = useChatStore((chat) => chat.status);
  const selfCache = useProfileCacheStore((cache) => cache.cacheByAuth[ownerKey(session)]);
  const scopedState = sameActivity(state, scope) ? state : null;
  const readSnapshot = scopedState?.snapshot && scopedState.baseSnapshot === snapshot ? scopedState.snapshot : snapshot;
  const authoritative = receipt.current && sameScope(receipt.current.scope, scope) &&
    (!readSnapshot.partyId || readSnapshot.partyId === receipt.current.snapshot.partyId) ? receipt.current.snapshot : null;
  const latestSnapshot = applyPartyReceipt(readSnapshot, authoritative);
  const previous = lastGood.current && sameScope(lastGood.current.scope, scope) ? lastGood.current.snapshot : null;
  const joinTransition = joined.current && sameScope(joined.current.scope, scope) ? joined.current : null;
  const transitionSnapshot = joinTransition && latestSnapshot.partyId !== joinTransition.partyId
    ? { ...latestSnapshot, partyId: joinTransition.partyId, party: null, namesBySubject: {} } : latestSnapshot;
  const effectiveSnapshot = !hasRiotScreenSession(session) || !isCurrentRiotScreenSession(session) || snapshotOwner !== ownerKey(session) ? EMPTY_SNAPSHOT :
    joinTransition ? transitionSnapshot :
    !latestSnapshot.party && previous?.party ? { ...latestSnapshot, party: previous.party, partyId: previous.partyId, namesBySubject: { ...previous.namesBySubject, ...latestSnapshot.namesBySubject } } : latestSnapshot;
  const assets = getAssets();
  if (effectiveSnapshot.state === "idle" && effectiveSnapshot.party?.State === "DEFAULT" && effectiveSnapshot.partyId) {
    normalQueueHistory.current = { authKey: ownerKey(session), partyId: effectiveSnapshot.partyId, queueIds: readNormalQueueIds(effectiveSnapshot.party) };
  }
  const model = buildPartyViewModel({ session, snapshot: effectiveSnapshot, friends, friendConnectionStatus, assets, selfCache, selfLevel, normalQueueHistory: normalQueueHistory.current });
  const queueLabel = (id: string, fallback: string) => formatSessionQueueLabel(id, (translationKey) => t(translationKey, { defaultValue: fallback }));
  const confirmationUncertain = scopedState?.confirmationUncertain === true || Boolean(receipt.current && sameScope(receipt.current.scope, scope) &&
    receipt.current.confirmationsRemaining === 0 && isOlderPartyRead(snapshot.party, receipt.current.snapshot.party));
  const localizedModel = {
    ...model, partyId: joinTransition?.partyId ?? model.partyId,
    canReady: model.canReady && !confirmationUncertain, canManage: model.canManage && !confirmationUncertain,
    canStartQueue: model.canStartQueue && !confirmationUncertain, code: confirmationUncertain ? null : model.code,
    canJoinParty: !confirmationUncertain && model.canJoinParty && isCurrent() && (!joinTransition || Boolean(effectiveSnapshot.party)) &&
      (Boolean(effectiveSnapshot.party) || Boolean(confirmedAbsence.current && sameScope(confirmedAbsence.current, scope))),
    queueLabel: model.queueId ? queueLabel(model.queueId, model.queueLabel) : model.queueLabel,
    // Presentation only: permissions continue to use Riot's confirmed model.
    members: enabled && scopedState?.busyAction === "ready" && scopedState.optimisticReady?.partyId === model.partyId
      ? model.members.map((member) => member.isSelf ? { ...member, ready: scopedState.optimisticReady!.value } : member) : model.members,
    queueOptions: model.queueOptions.map((option) => ({ ...option, label: option.previouslyEligible
      ? `${queueLabel(option.id, option.label.replace(" (previously available)", ""))} (${t("party_page.previously_available", { defaultValue: "previously available" })})`
      : queueLabel(option.id, option.label) })),
    friends: model.friends.map((friend) => {
      const source = friends[friend.id];
      const translationKey = ACTIVITY_KEYS[source?.presence?.sessionLoopState ?? source?.show];
      return { ...friend, canInvite: friend.canInvite && !confirmationUncertain, activityLabel: translationKey ? t(translationKey, { defaultValue: friend.activityLabel }) : friend.activityLabel };
    }),
  };

  const refresh = React.useCallback(async (manual = false, afterAction = false): Promise<unknown> => {
    if (!isCurrent() || (pendingAction.current && !afterAction)) return false;
    const pending = pendingRefresh.current;
    if (pending) {
      if (sameActivity(pending, scope)) {
        if (manual) update({ refreshing: true });
        try { return await pending.promise; }
        finally { if (manual) update({ refreshing: false }); }
      }
      await pending.promise;
      if (!isCurrent()) return false;
      return refresh(manual, afterAction);
    }
    const revision = readRevision.current;
    update({ refreshing: manual, errorMessage: null });
    const promise = (async () => {
      try {
        let next = await useCombatStore.getState().fetchSession(useUserStore.getState().user);
        if (!isCurrent() || revision !== readRevision.current) return false;
        // Legacy GET helpers return null for all non-200s. Confirm absence before replacing good data.
        if (!next.party) {
          const party = await getPartyState(session, () => isCurrent() && revision === readRevision.current);
          if (!isCurrent() || revision !== readRevision.current) return false;
          next = { ...next, party, partyId: party?.ID ?? null };
        }
        const transition = joined.current && sameScope(joined.current.scope, scope) ? joined.current : null;
        if (transition && next.partyId !== transition.partyId) {
          update({ errorMessage: t("party_page.join_pending", { defaultValue: "Party join accepted. Refresh to confirm the joined party." }) });
          return false;
        }
        if (transition && next.party?.ID === transition.partyId) joined.current = null;
        if (!next.party && !next.partyId) confirmedAbsence.current = scope;
        else confirmedAbsence.current = null;
        const confirmed = receipt.current;
        const awaitingConfirmation = confirmed && sameScope(confirmed.scope, scope) && next.party && next.partyId === confirmed.snapshot.partyId && preserveReceipt(next.party, confirmed.snapshot.party);
        let refreshHint: string | null = null;
        let uncertain = false;
        const knownOlder = confirmed && isOlderPartyRead(next.party, confirmed.snapshot.party);
        if (confirmed && awaitingConfirmation && (confirmed.confirmationsRemaining > 0 || knownOlder)) {
          const remaining = Math.max(0, confirmed.confirmationsRemaining - 1);
          receipt.current = { ...confirmed, confirmationsRemaining: remaining };
          next = { ...next, party: confirmed.snapshot.party, partyId: confirmed.snapshot.partyId };
          uncertain = remaining === 0 && Boolean(knownOlder);
          refreshHint = remaining === 0 ? "Party update accepted. Refresh to confirm the latest state." : "Party update accepted. Details are still refreshing.";
        } else { receipt.current = null; }
        lastGood.current = next.party ? { scope, snapshot: next } : null;
        update({ baseSnapshot: inputSnapshot.current, snapshot: next, errorMessage: refreshHint, confirmationUncertain: uncertain });
        return next;
      } catch {
        if (revision === readRevision.current) update({ errorMessage: "Party refresh failed. Please try again." });
        return false;
      } finally { update({ refreshing: false }); }
    })();
    const request = { ...scope, promise }; pendingRefresh.current = request;
    try { return await promise; }
    finally { if (pendingRefresh.current === request) pendingRefresh.current = null; }
  }, [isCurrent, scope, session, t, update]);
  const poll = React.useCallback(() => refresh(), [refresh]);
  useCombatPoll({ enabled: enabled && hasRiotScreenSession(session), repeat: true, intervalMs: 3000, request: poll, isCurrent });

  const liveModel = React.useCallback((expectedParty: string | null, requireIdle = true) => {
    if (!isCurrent() || !expectedParty) throw new Error("Party action is no longer available");
    const live = useCombatStore.getState();
    if (joined.current && sameScope(joined.current.scope, scope) && joined.current.partyId !== expectedParty) throw new Error("Party changed");
    if (live.sessionKey !== ownerKey(session) || live.snapshot.partyId !== expectedParty || live.snapshot.party?.ID !== expectedParty || (requireIdle && live.snapshot.state !== "idle")) throw new Error("Party changed");
    const chat = useChatStore.getState();
    const confirmed = receipt.current && sameScope(receipt.current.scope, scope) ? receipt.current.snapshot : null;
    if (confirmed && receipt.current!.confirmationsRemaining === 0 && isOlderPartyRead(live.snapshot.party, confirmed.party)) throw new Error("Party confirmation is uncertain");
    return buildPartyViewModel({ session, snapshot: applyPartyReceipt(live.snapshot, confirmed), friends: chat.friends, friendConnectionStatus: chat.status, assets: getAssets(), selfCache, selfLevel, normalQueueHistory: normalQueueHistory.current });
  }, [isCurrent, scope, selfCache, selfLevel, session]);
  const reconcile = React.useCallback((partyId: string, revision: number) => {
    // Yield to action completion/React first; never wait for the periodic three-second tick.
    reconciliationTimer.current = setTimeout(() => {
      reconciliationTimer.current = null;
      void (async () => {
        if (pendingRefresh.current) await pendingRefresh.current.promise;
        if (!isCurrent() || revision !== readRevision.current || pendingAction.current) return;
        const live = useCombatStore.getState();
        const transition = joined.current && sameScope(joined.current.scope, scope) && joined.current.partyId === partyId;
        if (live.sessionKey !== ownerKey(session) || (!transition && live.snapshot.partyId && live.snapshot.partyId !== partyId)) return;
        await refresh(false, true);
      })().catch(() => {
        if (isCurrent() && revision === readRevision.current) update({ errorMessage: "Party refresh failed. Please try again." });
      });
    }, 0);
  }, [isCurrent, refresh, scope, session, update]);
  const runAction = React.useCallback(async (action: PartyAction, partyId: string | null,
    allowed: (current: ReturnType<typeof buildPartyViewModel>) => boolean,
    operation: (partyId: string) => Promise<unknown>, allowVoid = false, refetch = true, readyValue?: boolean): Promise<unknown> => {
    if (pendingAction.current || !isCurrent()) return false;
    try {
      if (!allowed(liveModel(partyId))) throw new Error("Party action is unavailable");
    } catch { update({ errorMessage: "This party action is no longer available. Refresh and try again." }); return false; }
    if (refetch) {
      readRevision.current += 1;
      if (reconciliationTimer.current !== null) { clearTimeout(reconciliationTimer.current); reconciliationTimer.current = null; }
    }
    const revision = readRevision.current;
    let accepted = false;
    update({ busyAction: action, errorMessage: null, optimisticReady: action === "ready" && typeof readyValue === "boolean" && partyId ? { partyId, value: readyValue } : undefined });
    const promise = (async () => {
      try {
        const result = await operation(partyId!);
        if (!isCurrent()) return false;
        const live = useCombatStore.getState();
        const departed = action === "leave" && live.sessionKey === ownerKey(session) && !live.snapshot.partyId && !live.snapshot.party;
        const hasPartyReceipt = result && typeof result === "object" && "ID" in result && result.ID === partyId &&
          "State" in result && typeof result.State === "string" && "Members" in result && Array.isArray(result.Members);
        const advancedToMatch = (action === "ready" || action === "start") && hasPartyReceipt &&
          live.sessionKey === ownerKey(session) && live.snapshot.state !== "idle" && Boolean(live.snapshot.matchId) &&
          !live.snapshot.partyId && !live.snapshot.party;
        if (!departed && !advancedToMatch) liveModel(partyId, false);
        if (!allowVoid && result == null) throw new Error("No action confirmation");
        if (result && typeof result === "object" && "ID" in result && result.ID !== partyId) throw new Error("Party receipt changed");
        if (advancedToMatch) {
          // The newer match snapshot wins; an accepted action must not resurrect its old Party.
          receipt.current = null; lastGood.current = null;
          update({ baseSnapshot: inputSnapshot.current, snapshot: live.snapshot });
        } else if (result && typeof result === "object" && "ID" in result && result.ID === partyId &&
            "State" in result && typeof result.State === "string" && "Members" in result && Array.isArray(result.Members)) {
          const current = useCombatStore.getState().snapshot;
          const next = { ...current, party: result as PartyResponse, partyId };
          receipt.current = { scope, snapshot: next, confirmationsRemaining: MAX_RECEIPT_CONFIRMATION_READS }; lastGood.current = { scope, snapshot: next };
          update({ baseSnapshot: inputSnapshot.current, snapshot: next });
        }
        accepted = true;
        return refetch ? result ?? true : true;
      } catch {
        const live = useCombatStore.getState();
        if (live.snapshot.partyId === partyId && live.snapshot.party?.ID === partyId) {
          update({ errorMessage: "Party action failed. Please refresh and try again." });
        }
        return false;
      }
      finally { update({ busyAction: null, optimisticReady: undefined }); }
    })();
    pendingAction.current = promise;
    try { return await promise; }
    finally {
      if (pendingAction.current === promise) pendingAction.current = null;
      if (accepted && refetch && partyId && isCurrent()) reconcile(partyId, revision);
    }
  }, [isCurrent, liveModel, reconcile, scope, session, update]);
  const joinCode = React.useCallback(async (code: string, expectedParty: string | null): Promise<unknown> => {
    if (pendingAction.current || !isCurrent()) return false;
    const validate = (destination?: string) => {
      const live = useCombatStore.getState();
      const confirmed = receipt.current && sameScope(receipt.current.scope, scope) ? receipt.current : null;
      if (confirmed && confirmed.confirmationsRemaining === 0 && isOlderPartyRead(live.snapshot.party, confirmed.snapshot.party)) throw new Error("Party confirmation is uncertain");
      const transition = joined.current && sameScope(joined.current.scope, scope) ? joined.current : null;
      const observedDestination = destination && live.snapshot.partyId === destination && live.snapshot.party?.ID === destination;
      if (!isCurrent() || live.sessionKey !== ownerKey(session) || (!observedDestination && live.snapshot.partyId !== expectedParty) ||
        (transition && transition.partyId !== expectedParty) || (transition && live.snapshot.party?.ID !== transition.partyId)) throw new Error("Party changed");
      const current = buildPartyViewModel({ session, snapshot: live.snapshot, friends: {}, friendConnectionStatus: "disconnected", assets: getAssets() });
      if (!current.canJoinParty || (!expectedParty && !(confirmedAbsence.current && sameScope(confirmedAbsence.current, scope)))) throw new Error("Join unavailable");
    };
    let trimmed: string;
    try { trimmed = requirePartyCode(code); validate(); }
    catch { update({ errorMessage: t("party_page.join_failed", { defaultValue: "Enter a valid party code while outside queue or a match. Refresh and try again." }) }); return false; }
    readRevision.current += 1;
    const revision = readRevision.current;
    if (reconciliationTimer.current !== null) { clearTimeout(reconciliationTimer.current); reconciliationTimer.current = null; }
    update({ busyAction: "join", errorMessage: null });
    let acceptedId: string | null = null;
    const promise = (async () => {
      try {
        const result = await joinPartyWithCode(session, trimmed);
        if (!isCurrent()) return false;
        const partyId = requirePartyText(result?.CurrentPartyID, "joined ID");
        validate(partyId);
        joined.current = { scope, partyId }; acceptedId = partyId;
        receipt.current = null; lastGood.current = null; confirmedAbsence.current = null; normalQueueHistory.current = undefined;
        const next = { ...useCombatStore.getState().snapshot, partyId, party: null, namesBySubject: {} };
        update({ baseSnapshot: inputSnapshot.current, snapshot: next });
        return result;
      } catch {
        if (isCurrent()) update({ errorMessage: t("party_page.join_failed", { defaultValue: "Party join failed or the party changed. Check the code, refresh and try again." }) });
        return false;
      } finally { update({ busyAction: null }); }
    })();
    pendingAction.current = promise;
    try { return await promise; }
    finally {
      if (pendingAction.current === promise) pendingAction.current = null;
      if (acceptedId && isCurrent()) reconcile(acceptedId, revision);
    }
  }, [isCurrent, reconcile, scope, session, t, update]);
  const actions: Omit<PartyActions, "onClose" | "onAllFriends"> = React.useMemo(() => {
    const partyId = model.partyId;
    const args = [session.accessToken, session.entitlementsToken, session.region] as const;
    return {
      onRefresh: () => refresh(true),
      onStartQueue: () => runAction("start", partyId, (current) => current.canStartQueue, (id) => liveModel(partyId).partyState === "CUSTOM_GAME_SETUP"
        ? startPartyCustomGame(session, id) : enterMatchmakingQueue(...args, id)),
      onCancelQueue: () => runAction("cancel", partyId, (current) => current.isLeader && current.isQueueing, (id) => leaveMatchmakingQueue(...args, id)),
      onLeave: () => runAction("leave", partyId, (current) => current.canReady, () => removeFromParty(...args, session.id), true),
      onReady: (ready) => runAction("ready", partyId, (current) => current.canReady && typeof ready === "boolean", async (id) => {
        const confirmed = await setPartyReady(...args, id, session.id, ready);
        const member = confirmed?.Members?.find((entry) => typeof entry?.Subject === "string" && entry.Subject.toLowerCase() === session.id.toLowerCase());
        if (confirmed?.ID !== id || typeof confirmed.State !== "string" || member?.IsReady !== ready) throw new Error("Ready was not confirmed");
        return confirmed;
      }, false, true, ready),
      onQueueChange: (queueId) => runAction("queue", partyId, (current) => current.canManage && current.queueOptions.some((option) => option.id === queueId && option.enabled), (id) => {
        const current = liveModel(partyId);
        if (queueId === "custom") return current.partyState === "CUSTOM_GAME_SETUP" ? Promise.resolve(true) : makePartyCustom(session, id);
        return current.partyState === "CUSTOM_GAME_SETUP" ? makePartyDefault(session, id, queueId) : setPartyQueue(session, id, queueId);
      }),
      onPrivacyChange: (privacy) => runAction("privacy", partyId, (current) => current.canManage && (privacy === "OPEN" || privacy === "CLOSED"), (id) => setPartyAccessibility(session, id, privacy)),
      onGenerateCode: () => runAction("code", partyId, (current) => current.canManage, (id) => generatePartyInviteCode(...args, id)),
      onCopyCode: () => runAction("code", partyId, (current) => Boolean(current.code), async () => { await Clipboard.setStringAsync(liveModel(partyId).code!); }, true, false),
      onShareCode: () => runAction("share", partyId, (current) => Boolean(current.code), async () => {
        await Share.share({ message: liveModel(partyId).code! });
      }, true, false),
      onJoinCode: (code) => joinCode(code, partyId),
      onInviteByName: (riotId) => {
        if (!isCurrent() || pendingAction.current) return Promise.resolve(false);
        try {
          const { name, tag } = parsePartyRiotId(riotId);
          return runAction("invite", partyId, (current) => current.canManage, (id) => invitePartyFriend(session, id, name, tag));
        } catch {
          update({ errorMessage: t("party_page.invalid_riot_id", { defaultValue: "Enter a valid Riot ID as Name#Tag (one #, with a non-empty name and tag)." }) });
          return Promise.resolve(false);
        }
      },
      onInvite: (friendId) => runAction("invite", partyId, (current) => current.friends.some((friend) => friend.id === friendId && friend.canInvite), (id) => {
        const friend = useChatStore.getState().friends[friendId];
        if (!friend) throw new Error("Friend is no longer available");
        return invitePartyFriend(session, id, friend.gameName, friend.tagLine);
      }),
    };
  }, [isCurrent, joinCode, liveModel, model.partyId, refresh, runAction, session, t, update]);
  return { model: localizedModel, refreshing: scopedState?.refreshing ?? false, busyAction: scopedState?.busyAction ?? null, errorMessage: scopedState?.errorMessage ?? null, actions };
}
