import { formatSessionQueueLabel } from "~/utils/valorant-session";
import vi from "~/assets/i18n/vi.json";

const translated = (key: string) => {
  const queueKey = key.replace("session_labels.queue.", "");
  return (vi.session_labels.queue as Record<string, string>)[queueKey] ?? key;
};

describe("user-approved Vietnamese queue names", () => {
  it.each([
    ["ggteam", "Tăng tiến"], ["spikerush", "Spike nhanh"], ["hurm", "Sinh tử đội"],
    ["swiftplay", "Siêu tốc"], ["deathmatch", "Sinh tử đơn"], ["AbilityDraftArena", "Thử thách: Lỗi hệ thống"],
  ])("labels %s without changing its transport ID", (id, label) => {
    expect(formatSessionQueueLabel(id, translated)).toBe(label);
  });
});
