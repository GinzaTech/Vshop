import { getPartyState, invitePartyFriend, joinPartyWithCode, parsePartyRiotId, setPartyAccessibility, setPartyQueue } from "~/services/riot/party-api";

const mockRequest = jest.fn();
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/services/riot/request-context", () => ({ extraHeaders: () => ({ "X-Riot-ClientVersion": "test-version", "X-Riot-ClientPlatform": "test-platform" }) }));
const session = { id: "self", region: "ap", accessToken: "test-access", entitlementsToken: "test-entitlement" };
const party = { ID: "party", Members: [] };

describe("party mutation contracts", () => {
  beforeEach(() => { mockRequest.mockReset().mockResolvedValue({ status: 200, data: party }); });
  it("joins with a trimmed raw code encoded once and returns only the validated receipt", async () => {
    mockRequest.mockResolvedValue({ status: 201, data: { CurrentPartyID: " joined ", secret: "discard" } });
    await expect(joinPartyWithCode(session, " A_9-z ")).resolves.toEqual({ CurrentPartyID: "joined" });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/players/joinbycode/A_9-z" }));
    expect(mockRequest.mock.calls[0][0].data).toBeUndefined();
  });
  it.each(["", " ", "a\n", "a\u007f", "a/b", "a%b", "a b", "x".repeat(65)])("rejects invalid join code %p before transport", async (code) => {
    await expect(joinPartyWithCode(session, code)).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { CurrentPartyID: null }, { CurrentPartyID: 3 }, { CurrentPartyID: " " }, { CurrentPartyID: "a\n" }, { CurrentPartyID: "x".repeat(257) }])("rejects malformed join receipt %p", async (data) => {
    mockRequest.mockResolvedValue({ status: 200, data });
    await expect(joinPartyWithCode(session, "code")).rejects.toThrow();
  });
  it.each([199, 300, 401, 409, 500])("rejects join HTTP %s", async (status) => {
    mockRequest.mockResolvedValue({ status, data: { CurrentPartyID: "party", message: "secret" } });
    await expect(joinPartyWithCode(session, "code")).rejects.toThrow(`HTTP ${status}`);
  });
  it("parses trimmed Riot ID parts and uses the existing encoded invitation path", async () => {
    const parsed = parsePartyRiotId(" Náme /? # AP%1 ");
    expect(parsed).toEqual({ name: "Náme /?", tag: "AP%1" });
    await invitePartyFriend(session, "party", parsed.name, parsed.tag);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party/invites/name/N%C3%A1me%20%2F%3F/tag/AP%251" }));
    expect(parsePartyRiotId(`${"n".repeat(63)}#${"t".repeat(64)}`)).toEqual({ name: "n".repeat(63), tag: "t".repeat(64) });
  });
  it.each(["", "Name", "#tag", "name#", "name#tag#extra", "name\n#tag", "name#tag\u007f", `${"n".repeat(125)}#tag`, `name#${"t".repeat(124)}`])("rejects malformed Riot ID %p", (id) => {
    expect(() => parsePartyRiotId(id)).toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it("changes queue with the documented lowercase queueID field and Riot headers", async () => {
    await expect(setPartyQueue(session, "party/id", "competitive")).resolves.toEqual(party);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party%2Fid/queue", method: "POST", data: { queueID: "competitive" },
      headers: expect.objectContaining({ Authorization: "Bearer test-access", "X-Riot-Entitlements-JWT": "test-entitlement", "X-Riot-ClientVersion": "test-version", "X-Riot-ClientPlatform": "test-platform" }),
    }));
  });
  it.each(["OPEN", "CLOSED"] as const)("sets accessibility %s", async (accessibility) => {
    await setPartyAccessibility(session, "party", accessibility);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("/party/accessibility"), data: { accessibility } }));
  });
  it("invites by live Riot name and tag, encoded once, without a speculative PUUID payload", async () => {
    await invitePartyFriend(session, "party", "Náme /?", "AP#1");
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party/invites/name/N%C3%A1me%20%2F%3F/tag/AP%231", method: "POST" }));
    expect(mockRequest.mock.calls[0][0].data).toBeUndefined();
  });
  it.each([400, 401, 403, 409, 429, 500])("rejects HTTP %s without exposing payload secrets", async (status) => {
    mockRequest.mockResolvedValue({ status, data: { message: "secret-token" } });
    await expect(setPartyQueue(session, "party", "competitive")).rejects.toThrow(`HTTP ${status}`);
  });
  it.each([null, undefined, "", false, 0, []]) ("rejects missing success data %s", async (data) => {
    mockRequest.mockResolvedValue({ status: 200, data });
    await expect(invitePartyFriend(session, "party", "Name", "Tag")).rejects.toThrow();
  });
  it("validates credentials, region, party, queue, privacy, name and tag before transport", async () => {
    await expect(setPartyQueue({ ...session, accessToken: "" }, "party", "competitive")).rejects.toThrow();
    await expect(setPartyQueue({ ...session, entitlementsToken: "" }, "party", "competitive")).rejects.toThrow();
    await expect(setPartyQueue({ ...session, id: "" }, "party", "competitive")).rejects.toThrow();
    await expect(setPartyQueue({ ...session, region: "mars" }, "party", "competitive")).rejects.toThrow();
    await expect(setPartyQueue(session, " ", "competitive")).rejects.toThrow();
    await expect(setPartyQueue(session, "party", " ")).rejects.toThrow();
    await expect(setPartyAccessibility(session, "party", "invalid" as "OPEN")).rejects.toThrow();
    await expect(invitePartyFriend(session, "party", "", "Tag")).rejects.toThrow();
    await expect(invitePartyFriend(session, "party", "Name", " ")).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it("reads confirmed absence separately from failed discovery", async () => {
    mockRequest.mockResolvedValueOnce({ status: 404 });
    await expect(getPartyState(session)).resolves.toBeNull();
    mockRequest.mockResolvedValueOnce({ status: 503 });
    await expect(getPartyState(session)).rejects.toThrow("HTTP 503");
    mockRequest.mockResolvedValueOnce({ status: 200, data: { CurrentPartyID: "party" } }).mockResolvedValueOnce({ status: 200, data: party });
    await expect(getPartyState(session)).resolves.toEqual(party);
    mockRequest.mockResolvedValueOnce({ status: 200, data: {} });
    await expect(getPartyState(session)).rejects.toThrow();
    mockRequest.mockResolvedValueOnce({ status: 200, data: { CurrentPartyID: "party" } }).mockResolvedValueOnce({ status: 404 });
    await expect(getPartyState(session)).resolves.toBeNull();
  });
  it("accepts normal-sized JWTs and stops read followups when the caller is obsolete", async () => {
    await setPartyQueue({ ...session, accessToken: "x".repeat(1500), entitlementsToken: "y".repeat(1500) }, "party", "competitive");
    mockRequest.mockReset();
    let current = true;
    mockRequest.mockImplementationOnce(async () => { current = false; return { status: 200, data: { CurrentPartyID: "party" } }; });
    await expect(getPartyState(session, () => current)).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
