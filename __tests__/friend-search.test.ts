import { filterFriendsByRiotId } from "../utils/friend-search";
import type { ChatFriend } from "../utils/chat-store";

const FRIENDS: ChatFriend[] = [
  {
    id: "friend-a",
    gameName: "Alpha Player",
    tagLine: "VN01",
    status: "",
    show: "chat",
  },
  {
    id: "friend-b",
    gameName: "Bravo",
    tagLine: "APAC",
    status: "",
    show: "offline",
  },
];

describe("filterFriendsByRiotId", () => {
  it("matches game names and tags without case sensitivity", () => {
    expect(filterFriendsByRiotId(FRIENDS, "alpha")).toEqual([FRIENDS[0]]);
    expect(filterFriendsByRiotId(FRIENDS, "apac")).toEqual([FRIENDS[1]]);
  });

  it("matches a complete Riot ID and ignores outer whitespace", () => {
    expect(filterFriendsByRiotId(FRIENDS, "  ALPHA PLAYER#VN01  ")).toEqual([
      FRIENDS[0],
    ]);
  });

  it("keeps the existing list when the query is empty", () => {
    expect(filterFriendsByRiotId(FRIENDS, "   ")).toBe(FRIENDS);
  });
});
