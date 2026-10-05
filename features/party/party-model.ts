import type { CombatSessionSnapshot } from "~/hooks/useCombatStore";
import type { RiotScreenSession } from "~/hooks/useRiotScreenSession";
import type { ChatFriend } from "~/utils/chat-store";
import { isOnlineFriend } from "~/utils/friend-presence";
import type { PartyMemberView, PartyQueueOption, PartyViewModel } from "./party-types";

type PartyAssets = {
  cards: readonly { uuid: string; smallArt?: string; displayIcon?: string }[];
  competitiveTiers: readonly { tiers?: readonly { tier?: number; tierName?: string; smallIcon?: string; largeIcon?: string }[] }[];
};
type SelfCache = { authKey: string; competitiveRank: { currentTier: number | null; currentName: string; currentIcon: string | null } | null };
export type NormalQueueHistory = { authKey: string; partyId: string; queueIds: readonly string[] };
type PartyQueueChoice = PartyQueueOption & { previouslyEligible?: boolean };
export type PartyModelInput = {
  session: RiotScreenSession; snapshot: CombatSessionSnapshot;
  friends: Record<string, ChatFriend>; friendConnectionStatus: string;
  assets: PartyAssets; selfCache?: SelfCache;
  selfLevel?: number;
  normalQueueHistory?: NormalQueueHistory;
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const key = (value: string) => value.toLowerCase();
const label = (id: string) => id.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function readNormalQueueIds(party: unknown): string[] {
  return [...new Set(list(record(party).EligibleQueues).map(text).filter((id): id is string => id !== undefined && id.toLowerCase() !== "custom"))];
}

function hasCustomConfiguration(party: Record<string, unknown>): boolean {
  const data = record(party.CustomGameData); const settings = record(data.Settings);
  const rules = settings.GameRules ?? data.GameRules;
  const validRules = rules === undefined || rules === null || (typeof rules === "object" && !Array.isArray(rules));
  return Boolean(text(settings.Map) && text(settings.Mode) && validRules);
}

function avatar(cardId: unknown, assets: PartyAssets) {
  const card = assets.cards.find((item) => key(item.uuid) === key(text(cardId) ?? ""));
  return card?.smallArt || card?.displayIcon;
}

function memberView(value: unknown, input: PartyModelInput, selectedPod: string | undefined): PartyMemberView | null {
  const member = record(value); const id = text(member.Subject);
  if (!id) return null;
  const identity = record(member.PlayerIdentity); const isSelf = key(id) === key(input.session.id);
  const ownLevel = isSelf && typeof input.selfLevel === "number" && Number.isInteger(input.selfLevel) && input.selfLevel > 0 ? input.selfLevel : undefined;
  const cached = isSelf && input.selfCache?.authKey === `${key(input.session.region)}|${key(input.session.id)}` ? input.selfCache.competitiveRank : null;
  const actualTier = number(member.CompetitiveTier);
  const tier = actualTier ?? cached?.currentTier;
  const rank = input.assets.competitiveTiers.flatMap((set) => set.tiers ?? []).findLast((item) => tier !== undefined && tier !== null && tier > 0 && item.tier === tier);
  const display = text(input.snapshot.namesBySubject[key(id)]) ?? id.slice(0, 8);
  const split = display.lastIndexOf("#");
  const ping = list(member.Pings).map(record).find((item) => selectedPod && item.GamePodID === selectedPod);
  return {
    id, name: split >= 0 ? display.slice(0, split) : display, tag: split >= 0 ? display.slice(split + 1) : undefined,
    avatarUrl: avatar(identity.PlayerCardID, input.assets),
    level: ownLevel ?? (identity.Incognito === true || identity.HideAccountLevel === true ? undefined : number(identity.AccountLevel)),
    // This value is qualified by the FIRST preferred pod, never a minimum over unselected servers.
    pingMs: number(ping?.Ping),
    rankIconUrl: rank?.smallIcon || rank?.largeIcon || (actualTier === undefined ? cached?.currentIcon ?? undefined : undefined),
    rankName: rank?.tierName || (actualTier === undefined ? cached?.currentName : undefined),
    ready: member.IsReady === true, isSelf, isLeader: member.IsOwner === true,
  };
}

export function buildPartyViewModel(input: PartyModelInput): Omit<PartyViewModel, "queueOptions"> & { queueOptions: readonly PartyQueueChoice[] } {
  const party = record(input.snapshot.party); const partyId = text(party.ID) ?? null;
  const state = text(party.State) ?? "UNKNOWN"; const custom = state === "CUSTOM_GAME_SETUP";
  const matchmaking = record(party.MatchmakingData); const rawQueue = text(matchmaking.QueueID);
  const queueId = custom ? "custom" : rawQueue?.toLowerCase() === "custom" ? null : rawQueue ?? null;
  const selectedPod = text(list(matchmaking.PreferredGamePods)[0]);
  const members = list(party.Members).map((member) => memberView(member, input, selectedPod)).filter((member): member is PartyMemberView => member !== null);
  const isLeader = members.some((member) => member.isSelf && member.isLeader);
  const idle = input.snapshot.state === "idle" && (state === "DEFAULT" || custom) && Boolean(partyId);
  // Explicit nulls distinguish absence from incomplete/malformed snapshots.
  const noMatch = input.snapshot.state === "idle" && input.snapshot.matchId === null &&
    input.snapshot.pregameMatch === null && input.snapshot.currentGameMatch === null;
  const noParty = input.snapshot.party === null && input.snapshot.partyId === null;
  const confirmedParty = idle && input.snapshot.partyId === partyId && Array.isArray(party.Members) &&
    typeof party.ID === "string" && party.ID.length <= 256 && !/[\u0000-\u001f\u007f]/.test(party.ID);
  const canJoinParty = noMatch && (noParty || confirmedParty);
  const canManage = idle && isLeader; const isQueueing = state === "MATCHMAKING" && input.snapshot.state === "idle";
  const eligible = readNormalQueueIds(party);
  const history = input.normalQueueHistory;
  const priorQueues = custom && eligible.length === 0 && history?.authKey === `${key(input.session.region)}|${key(input.session.id)}` && history.partyId === partyId
    ? readNormalQueueIds({ EligibleQueues: history.queueIds }) : [];
  const queueOptions: PartyQueueChoice[] = eligible.map((id) => ({ id, label: label(id), enabled: true }));
  queueOptions.push(...priorQueues.map((id) => ({ id, label: `${label(id)} (previously available)`, enabled: true, previouslyEligible: true })));
  if (queueId && !custom && !eligible.includes(queueId)) queueOptions.push({ id: queueId, label: label(queueId), enabled: false });
  // Custom is a room-conversion action, never inferred to be an eligible matchmaking queue.
  queueOptions.push({ id: "custom", label: "Custom", enabled: canManage });
  const occupied = new Set([key(input.session.id), ...members.map((member) => key(member.id))]);
  const friends = input.friendConnectionStatus === "authenticated" ? Object.values(input.friends)
    .filter((friend) => !occupied.has(key(friend.id)) && isOnlineFriend(friend, input.friendConnectionStatus) &&
      !["away", "dnd"].includes(friend.show.trim().toLowerCase()) && friend.presence?.isIdle !== true)
    .map((friend) => ({
      id: friend.id, name: text(friend.gameName) ?? friend.id.slice(0, 8),
      avatarUrl: avatar(friend.presence?.playerCardId, input.assets),
      presence: friend.show.trim().toLowerCase() === "dnd" ? "busy" as const : "available" as const,
      activityLabel: friend.presence?.sessionLoopState ? label(friend.presence.sessionLoopState) : label(friend.show.trim().toLowerCase()),
      canInvite: canManage && Boolean(text(friend.gameName) && friend.gameName !== "Unknown" && text(friend.tagLine)),
    })) : [];
  return {
    partyId, queueId, queueLabel: queueId ? label(queueId) : "—", queueOptions,
    privacy: party.Accessibility === "OPEN" || party.Accessibility === "CLOSED" ? party.Accessibility : null,
    code: text(party.InviteCode) ?? null, partyState: state, members, friends, friendConnectionStatus: input.friendConnectionStatus,
    isLeader, isQueueing, canManage, canJoinParty, canReady: idle && members.some((member) => member.isSelf),
    canStartQueue: canManage && (custom ? hasCustomConfiguration(party) : Boolean(queueId && eligible.includes(queueId))) && members.length > 0 && members.every((member) => member.ready) &&
      !(number(party.RestrictedSeconds) ?? 0) && list(party.QueueIneligibilities).length === 0,
  };
}
