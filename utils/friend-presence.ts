import type { ChatFriend } from "./chat-store";

const ONLINE_PRESENCE = new Set(["chat", "online", "dnd", "away", "mobile"]);

/** Availability is current only while XMPP is authenticated. */
export function isOnlineFriend(friend: Pick<ChatFriend, "show">, connectionStatus: string): boolean {
  return connectionStatus === "authenticated" && ONLINE_PRESENCE.has(friend.show.trim().toLowerCase());
}
