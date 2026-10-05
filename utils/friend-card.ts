import type { ChatFriend } from "./chat-store";
import { isOnlineFriend } from "./friend-presence";

type FriendCardAsset = {
  uuid: string;
  smallArt?: string;
  displayIcon?: string;
  wideArt?: string;
  largeArt?: string;
};

/** Normalize equivalent UUID spellings, never URLs or a guessed UUID substring. */
export function normalizeFriendCardId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim().toLowerCase();
  const bare = /^\{[\da-f-]+\}$/.test(id) ? id.slice(1, -1) : id;
  if (/^[\da-f]{32}$/.test(bare) || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(bare)) {
    const hex = bare.replace(/-/g, "");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return /^[a-z0-9_-]{1,128}$/.test(id) ? id : undefined;
}

/** Presence supplies identity; the existing public catalog supplies art only. */
export function getFriendCardArt(
  friend: Pick<ChatFriend, "presence">,
  cards: readonly FriendCardAsset[] = [],
): string | undefined {
  const id = normalizeFriendCardId(friend.presence?.playerCardId);
  if (!id) return undefined;
  const card = cards.find((item) => normalizeFriendCardId(item.uuid) === id);
  return [card?.smallArt, card?.displayIcon, card?.wideArt, card?.largeArt]
    .find((art) => typeof art === "string" && art.trim().length > 0)?.trim();
}

/** The public asset cache has no emitter. Observe its snapshots without fetching. */
export function subscribeFriendCardAssets(
  readCards: () => readonly FriendCardAsset[],
  onChange: () => void,
): () => void {
  let snapshot = readCards();
  const timer = setInterval(() => {
    const next = readCards();
    if (next === snapshot) return;
    snapshot = next;
    onChange();
  }, 1000);
  return () => clearInterval(timer);
}

/** Optional pure aggregate inspection; this utility never logs identities or payloads. */
export function getFriendCardDiagnostics(
  friends: readonly Pick<ChatFriend, "show" | "presence">[],
  connectionStatus: string,
  cards: readonly FriendCardAsset[],
) {
  const online = friends.filter((friend) => isOnlineFriend(friend, connectionStatus));
  const knownIds = new Set(cards.map((card) => normalizeFriendCardId(card.uuid)).filter(Boolean));
  const identity = online.map((friend) => {
    const raw = friend.presence?.playerCardId;
    return { friend, id: normalizeFriendCardId(raw), hasIdentity: typeof raw === "string" ? Boolean(raw.trim()) : raw != null };
  });
  const matched = identity.filter(({ id }) => id && knownIds.has(id));
  const artAvailableCount = matched.filter(({ friend }) => getFriendCardArt(friend, cards)).length;
  const initialCounts = { chat: 0, online: 0, dnd: 0, away: 0, mobile: 0, offline: 0, other: 0 };
  const statusCounts = friends.reduce((counts, friend) => {
    const show = friend.show.trim().toLowerCase();
    const key = Object.prototype.hasOwnProperty.call(counts, show) ? show as keyof typeof counts : "other";
    return { ...counts, [key]: counts[key] + 1 };
  }, initialCounts);
  return {
    friendsCount: friends.length,
    onlineCount: online.length,
    catalogCardCount: cards.length,
    assetsReady: cards.length > 0,
    presenceCardCount: identity.filter(({ id }) => id).length,
    missingIdentityCount: identity.filter(({ hasIdentity }) => !hasIdentity).length,
    invalidIdentityCount: identity.filter(({ hasIdentity, id }) => hasIdentity && !id).length,
    matchingCardCount: matched.length,
    unknownCatalogIdCount: identity.filter(({ id }) => id && !knownIds.has(id)).length,
    missingArtCount: matched.length - artAvailableCount,
    artAvailableCount,
    statusCounts,
  };
}
