import { isOnlineFriend } from "~/utils/friend-presence";

describe("online-only friends", () => {
  it.each(["chat", "online", "dnd", "away", "mobile"])("includes connected %s presence", (show) => {
    expect(isOnlineFriend({ show }, "authenticated")).toBe(true);
  });
  it.each(["offline", "unavailable", "", "unknown"])("excludes %s presence", (show) => {
    expect(isOnlineFriend({ show }, "authenticated")).toBe(false);
  });
  it.each(["disconnected", "connecting", "error"])("does not show stale presence while %s", (connection) => {
    expect(isOnlineFriend({ show: "chat" }, connection)).toBe(false);
  });
});
