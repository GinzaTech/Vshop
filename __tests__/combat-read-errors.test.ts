import {
  getPreGamePlayer, getPreGameMatch, getCurrentGamePlayer,
  getCurrentGameMatch, getPartyPlayer, getParty,
} from "~/services/riot/combat-api";

const mockRequest = jest.fn();
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/services/riot/request-context", () => ({ extraHeaders: () => ({}), API_DEBUG_LOGGING: false }));

const readers = [
  ["pregame player", getPreGamePlayer], ["pregame match", getPreGameMatch],
  ["current game player", getCurrentGamePlayer], ["current game match", getCurrentGameMatch],
  ["party player", getPartyPlayer], ["party", getParty],
] as const;

describe("combat discovery preserves transient failure information", () => {
  beforeEach(() => mockRequest.mockReset());

  it.each(readers)("%s rejects a 503 rather than pretending the resource disappeared", async (_label, read) => {
    mockRequest.mockResolvedValue({ status: 503, data: {} });
    await expect(read("access", "entitlements", "ap", "resource-id")).rejects.toThrow();
  });

  it.each(readers)("%s treats confirmed 404 absence as null", async (_label, read) => {
    mockRequest.mockResolvedValue({ status: 404, data: {} });
    await expect(read("access", "entitlements", "ap", "resource-id")).resolves.toBeNull();
  });

  it.each(readers)("%s keeps the successful response unchanged", async (_label, read) => {
    const body = { ID: "resource-id", Subject: "self", MatchID: "resource-id", Members: [] };
    mockRequest.mockResolvedValue({ status: 200, data: body });
    await expect(read("access", "entitlements", "ap", "resource-id")).resolves.toBe(body);
  });
});
