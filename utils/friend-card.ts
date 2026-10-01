import type { ChatFriend } from "./chat-store";

type FriendCardAsset = {
  uuid: string;
  smallArt?: string;
  displayIcon?: string;
  wideArt?: string;
  largeArt?: string;
};

/** Presence supplies identity; the existing public catalog supplies art only. */
export function getFriendCardArt(
  friend: Pick<ChatFriend, "presence">,
  cards: readonly FriendCardAsset[] = [],
): string | undefined {
  const id = friend.presence?.playerCardId?.trim().toLowerCase();
  if (!id) return undefined;
  const card = cards.find((item) => item.uuid.trim().toLowerCase() === id);
  return card?.smallArt || card?.displayIcon || card?.wideArt || card?.largeArt || undefined;
}
