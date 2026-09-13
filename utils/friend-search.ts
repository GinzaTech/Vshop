import type { ChatFriend } from "./chat-store";

/**
 * filterFriendsByRiotId — Lọc danh sách bạn bè theo từ khóa Riot ID
 * (dạng "GameName#Tag"). Từ khóa rỗng thì trả về nguyên danh sách.
 * So khớp không phân biệt hoa/thường; bạn bè thiếu tag vẫn khớp được nếu
 * tên chứa từ khóa.
 * @param {readonly ChatFriend[]} friends - Danh sách bạn bè hiện tại
 * @param {string} query - Từ khóa người dùng gõ (chưa chuẩn hóa)
 * @returns {readonly ChatFriend[]} Danh sách bạn bè đã lọc
 */
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
