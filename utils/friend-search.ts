import type { ChatFriend } from "./chat-store";

export const filterFriendsByRiotId = (
  friends: readonly ChatFriend[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return friends;

  return friends.filter((friend) => {
    const riotId = [friend.gameName, friend.tagLine]
      .filter(Boolean)
      .join("#")
      .toLocaleLowerCase();
    return riotId.includes(normalizedQuery);
  });
};
