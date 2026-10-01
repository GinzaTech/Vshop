import { makePartyCustom, makePartyDefault, startPartyCustomGame } from "~/services/riot/party-custom-api";
import { buildPartyViewModel } from "~/features/party/party-model";
import type { PartyResponse } from "~/services/riot/api-types";
import type { CombatSessionSnapshot } from "~/hooks/useCombatStore";

const mockRequest = jest.fn();
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/services/riot/request-context", () => ({ extraHeaders: () => ({ "X-Riot-ClientVersion": "version", "X-Riot-ClientPlatform": "platform" }) }));
const session = { id: "self", region: "ap", accessToken: "test-access", entitlementsToken: "test-entitlement" };
const members = [{ Subject: "self", IsReady: true, IsOwner: true }];
const normal: PartyResponse = { ID: "party", State: "DEFAULT", Members: members, EligibleQueues: ["competitive", "swiftplay"], MatchmakingData: { QueueID: "competitive" } };
const custom: PartyResponse = { ...normal, State: "CUSTOM_GAME_SETUP", EligibleQueues: [], MatchmakingData: { QueueID: "" }, CustomGameData: { Settings: { Map: "/Game/Maps/Actual/Actual", Mode: "/Game/GameModes/Actual/Actual", GameRules: null } } };
const snapshot = (party: PartyResponse): CombatSessionSnapshot => ({ state: "idle", partyId: party.ID, party, matchId: null, pregameMatch: null, currentGameMatch: null, namesBySubject: {} });
const build = (party: PartyResponse, extra: Partial<Parameters<typeof buildPartyViewModel>[0]> = {}) => buildPartyViewModel({ session, snapshot: snapshot(party), friends: {}, friendConnectionStatus: "disconnected", assets: { cards: [], competitiveTiers: [] }, ...extra });

describe("Custom party room contracts", () => {
  it("rejects a same-party receipt that never confirms a Custom start", async () => {
    for (const State of ["DEFAULT", "UNKNOWN", "MATCHMAKING"]) {
      mockRequest.mockResolvedValue({ status: 200, data: { ...custom, State } });
      await expect(startPartyCustomGame(session, "party")).rejects.toThrow();
    }
  });

  beforeEach(() => mockRequest.mockReset());
  it("converts via the catalog path without body and requires same-party CUSTOM_GAME_SETUP", async () => {
    mockRequest.mockResolvedValue({ status: 200, data: custom });
    await expect(makePartyCustom(session, "party")).resolves.toEqual(custom);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party/makecustomgame", headers: expect.objectContaining({ Authorization: "Bearer test-access", "X-Riot-Entitlements-JWT": "test-entitlement", "X-Riot-ClientVersion": "version", "X-Riot-ClientPlatform": "platform" }) }));
    expect(mockRequest.mock.calls[0][0].data).toBeUndefined();
    mockRequest.mockResolvedValue({ status: 200, data: normal });
    await expect(makePartyCustom(session, "party")).rejects.toThrow();
    mockRequest.mockResolvedValue({ status: 200, data: { ...custom, ID: "other" } });
    await expect(makePartyCustom(session, "party")).rejects.toThrow();
  });
  it("returns to DEFAULT with an encoded queueID query and validates the exact requested queue", async () => {
    const receipt = { ...normal, MatchmakingData: { QueueID: "swiftplay" } };
    mockRequest.mockResolvedValue({ status: 200, data: receipt });
    await expect(makePartyDefault(session, "party", "swiftplay")).resolves.toEqual(receipt);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party/makedefault?queueID=swiftplay", method: "POST" }));
    expect(mockRequest.mock.calls[0][0].data).toBeUndefined();
    mockRequest.mockResolvedValue({ status: 200, data: normal });
    await expect(makePartyDefault(session, "party", "swiftplay")).rejects.toThrow();
    mockRequest.mockResolvedValue({ status: 200, data: custom });
    await expect(makePartyDefault(session, "party", "swiftplay")).rejects.toThrow();
    mockRequest.mockResolvedValue({ status: 200, data: { ...receipt, ID: "other" } });
    await expect(makePartyDefault(session, "party", "swiftplay")).rejects.toThrow();
  });
  it("starts explicitly at startcustomgame, without queue join or a request body", async () => {
    mockRequest.mockResolvedValue({ status: 200, data: { ...custom, State: "CUSTOM_GAME_STARTING" } });
    await startPartyCustomGame(session, "party");
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/party/startcustomgame" }));
    expect(mockRequest.mock.calls[0][0].data).toBeUndefined();
    mockRequest.mockResolvedValue({ status: 200, data: { ...custom, ID: "other" } });
    await expect(startPartyCustomGame(session, "party")).rejects.toThrow();
  });
  it.each([makePartyCustom, (s: typeof session, id: string) => makePartyDefault(s, id, "competitive"), startPartyCustomGame])("surfaces 404 and never silently tries another endpoint", async (operation) => {
    mockRequest.mockResolvedValue({ status: 404, data: {} });
    await expect(operation(session, "party")).rejects.toThrow("HTTP 404");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("rejects missing credentials/party/queue and reserved custom queue before transport", async () => {
    await expect(makePartyCustom({ ...session, accessToken: "" }, "party")).rejects.toThrow();
    await expect(startPartyCustomGame(session, "")).rejects.toThrow();
    await expect(makePartyDefault(session, "party", " ")).rejects.toThrow();
    await expect(makePartyDefault(session, "party", "custom")).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("Custom mode is party room state, not fabricated matchmaking eligibility", () => {
  it("offers Custom separately and infers current mode from CUSTOM_GAME_SETUP with empty QueueID", () => {
    expect(build(normal).queueOptions).toContainEqual({ id: "custom", label: "Custom", enabled: true });
    expect(build(custom)).toMatchObject({ queueId: "custom", queueLabel: "Custom", canManage: true, canReady: true, canStartQueue: true, isQueueing: false });
    expect(build(custom).queueOptions).toEqual([{ id: "custom", label: "Custom", enabled: true }]);
  });
  it.each([undefined, {}, { Settings: {} }, { Settings: { Map: "actual" } }, { Settings: { Map: "actual", Mode: "actual", GameRules: "invalid" } }])("does not start without a validated actual configuration: %j", (CustomGameData) => {
    expect(build({ ...custom, CustomGameData } as unknown as PartyResponse).canStartQueue).toBe(false);
  });
  it("requires leader/readiness and refuses all management while pregame/live", () => {
    expect(build({ ...custom, Members: [{ Subject: "self", IsReady: true }] }).canManage).toBe(false);
    expect(build({ ...custom, Members: [{ ...members[0], IsReady: false }] }).canStartQueue).toBe(false);
    for (const state of ["pregame", "live"] as const) expect(build(custom, { snapshot: { ...snapshot(custom), state } })).toMatchObject({ canManage: false, canReady: false, canStartQueue: false });
  });
  it("never treats custom as a regular eligible queue or infers room state from a queue string", () => {
    expect(build({ ...normal, EligibleQueues: ["custom"], MatchmakingData: { QueueID: "custom" } })).toMatchObject({ queueId: null, canStartQueue: false });
  });
  it("retains only same-account/same-party prior normal choices, qualified as candidates", () => {
    const normalQueueHistory = { authKey: "ap|self", partyId: "party", queueIds: ["competitive", "swiftplay"] };
    const model = build(custom, { normalQueueHistory });
    expect(model.queueOptions).toContainEqual({ id: "competitive", label: "Competitive (previously available)", enabled: true, previouslyEligible: true });
    expect(build(custom, { normalQueueHistory: { ...normalQueueHistory, authKey: "ap|other" } }).queueOptions).toHaveLength(1);
    expect(build(custom, { normalQueueHistory: { ...normalQueueHistory, partyId: "other" } }).queueOptions).toHaveLength(1);
  });
});
