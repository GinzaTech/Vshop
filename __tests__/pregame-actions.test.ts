import { selectAndLockPregameAgent } from "~/services/riot/pregame-actions";
import { invalidateSessionOperations } from "~/utils/session-operations";

const session = { id: "self", region: "ap", accessToken: "test-access", entitlementsToken: "test-entitlements" };
let mockUser = session;
const mockRequest = jest.fn();
jest.mock("~/services/riot/client", () => ({ riotApiClient: { request: (...args: unknown[]) => mockRequest(...args) } }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockUser }) } }));
jest.mock("~/services/riot/request-context", () => ({ extraHeaders: () => ({ "X-Riot-ClientVersion": "test-version", "X-Riot-ClientPlatform": "test-platform" }) }));

function lockedResponse(): LockCharacterResponse {
  const team: PreGameTeam = { TeamID: "Blue", Players: [{
    Subject: "self", CharacterID: "agent", CharacterSelectionState: "locked", PregamePlayerState: "joined",
    CompetitiveTier: 0, IsCaptain: false,
    PlayerIdentity: { Subject: "self", PlayerCardID: "card", PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "", Incognito: false, HideAccountLevel: false },
    SeasonalBadgeInfo: { SeasonID: "", NumberOfWins: 0, WinsByTier: null, Rank: 0, LeaderboardRank: 0 },
  }] };
  return {
    ID: "match", Version: 1, Teams: [team], AllyTeam: team, EnemyTeam: null,
    ObserverSubjects: [], MatchCoaches: [], EnemyTeamSize: 5, EnemyTeamLockCount: 0,
    PregameState: "character_select_active", LastUpdated: "", MapID: "map", MapSelectPool: [],
    BannedMapIDs: [], MapSelectSteps: [], MapSelectStep: 0, Team1: "Blue", GamePodID: "pod",
    Mode: "mode", VoiceSessionID: "", MUCName: "", TeamMatchToken: "", QueueID: "unrated",
    ProvisioningFlowID: "Matchmaking", IsRanked: false, PhaseTimeRemainingNS: 0, StepTimeRemainingNS: 0,
    altModesFlagADA: false, TournamentMetadata: null, RosterMetadata: null,
  };
}
const player = () => ({ status: 200, data: { Subject: "self", MatchID: "match", Version: 1 } });
const options = () => ({ session, expectedMatchId: "match", agentId: "agent", isCurrent: () => true });
function arrangeSuccess() {
  mockRequest.mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data: lockedResponse() })
    .mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data: lockedResponse() });
}

describe("fixed-match pregame actions", () => {
  beforeEach(() => { mockUser = session; mockRequest.mockReset(); });

  it("rechecks the active player before each exact-match mutation and returns the actual locked schema", async () => {
    arrangeSuccess();
    await expect(selectAndLockPregameAgent(options())).resolves.toEqual(lockedResponse());
    expect(mockRequest.mock.calls.map(([request]) => [request.method, request.url])).toEqual([
      ["GET", "https://glz-ap-1.ap.a.pvp.net/pregame/v1/players/self"],
      ["POST", "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match/select/agent"],
      ["GET", "https://glz-ap-1.ap.a.pvp.net/pregame/v1/players/self"],
      ["POST", "https://glz-ap-1.ap.a.pvp.net/pregame/v1/matches/match/lock/agent"],
    ]);
    for (const [request] of mockRequest.mock.calls) expect(request.headers).toEqual({
      "X-Riot-ClientVersion": "test-version", "X-Riot-ClientPlatform": "test-platform",
      "X-Riot-Entitlements-JWT": "test-entitlements", Authorization: "Bearer test-access",
    });
  });

  it.each(["id", "region", "accessToken", "entitlementsToken"] as const)("rejects missing %s before transport", async (field) => {
    await expect(selectAndLockPregameAgent({ ...options(), session: { ...session, [field]: " " } })).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it.each(["expectedMatchId", "agentId"] as const)("rejects missing %s before transport", async (field) => {
    await expect(selectAndLockPregameAgent({ ...options(), [field]: " " })).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it("rejects an invalid region", async () => {
    mockUser = { ...session, region: "invalid" };
    await expect(selectAndLockPregameAgent({ ...options(), session: mockUser })).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it.each([null, { Subject: "self", MatchID: "other" }, { Subject: "other", MatchID: "match" }])("rejects a missing/mismatched active player: %j", async (data) => {
    mockRequest.mockResolvedValue({ status: 200, data });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("never locks a replacement match after select", async () => {
    mockRequest.mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { Subject: "self", MatchID: "other" } });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });
  it.each([0, 1, 2, 3])("rejects HTTP failure at request %s without false success", async (index) => {
    const responses = [player(), { status: 200, data: {} }, player(), { status: 200, data: lockedResponse() }];
    responses.forEach((response, i) => mockRequest.mockResolvedValueOnce(i === index ? { status: 403, data: lockedResponse() } : response));
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(index + 1);
  });
  it("rejects a null select result instead of calling lock", async () => {
    mockRequest.mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data: null });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it("propagates request rejection", async () => {
    mockRequest.mockRejectedValue(new Error("offline"));
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow("offline");
  });
  it.each([null, {}, { ...lockedResponse(), ID: "other" }, { ...lockedResponse(), AllyTeam: null, Teams: [] },
    { ...lockedResponse(), AllyTeam: { TeamID: "Blue", Players: [{ Subject: "self", CharacterID: "agent", CharacterSelectionState: "selected" }] } },
    { ...lockedResponse(), AllyTeam: { TeamID: "Blue", Players: [{ Subject: "self", CharacterID: "other", CharacterSelectionState: "locked" }] } },
  ])("rejects an unusable/unconfirmed lock response: %j", async (data) => {
    mockRequest.mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce(player()).mockResolvedValueOnce({ status: 200, data });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
  });
  it.each([0, 1, 2, 3])("checks the callback guard after response %s", async (index) => {
    let current = true;
    const responses = [player(), { status: 200, data: {} }, player(), { status: 200, data: lockedResponse() }];
    responses.forEach((response, i) => mockRequest.mockImplementationOnce(async () => { if (i === index) current = false; return response; }));
    await expect(selectAndLockPregameAgent({ ...options(), isCurrent: () => current })).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(index + 1);
  });
  it("checks credentials and generation even when the caller guard stays true", async () => {
    mockRequest.mockImplementationOnce(async () => { invalidateSessionOperations(); return player(); });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    mockRequest.mockReset().mockImplementationOnce(async () => { mockUser = { ...session, accessToken: "renewed" }; return player(); });
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("does not start with a stale callback or account", async () => {
    await expect(selectAndLockPregameAgent({ ...options(), isCurrent: () => false })).rejects.toThrow();
    mockUser = { ...session, id: "other" };
    await expect(selectAndLockPregameAgent(options())).rejects.toThrow();
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it.each([[4, 1], [9, 3]])("checks the guard immediately before a mutation at guard call %s", async (guardCall, requests) => {
    arrangeSuccess(); let calls = 0;
    await expect(selectAndLockPregameAgent({ ...options(), isCurrent: () => ++calls < guardCall })).rejects.toThrow();
    expect(mockRequest).toHaveBeenCalledTimes(requests);
  });
  it("encodes bound match/agent IDs without resolving another match path", async () => {
    const expectedMatchId = "match/part?"; const agentId = "agent/part?";
    const data = lockedResponse(); data.ID = expectedMatchId;
    data.AllyTeam!.Players = data.AllyTeam!.Players.map((entry) => ({ ...entry, CharacterID: agentId }));
    const active = { ...player(), data: { ...player().data, MatchID: expectedMatchId } };
    mockRequest.mockResolvedValueOnce(active).mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce(active).mockResolvedValueOnce({ status: 200, data });
    await expect(selectAndLockPregameAgent({ ...options(), expectedMatchId, agentId })).resolves.toEqual(data);
    expect(mockRequest.mock.calls[1][0].url).toContain("/matches/match%2Fpart%3F/select/agent%2Fpart%3F");
    expect(mockRequest.mock.calls[3][0].url).toContain("/matches/match%2Fpart%3F/lock/agent%2Fpart%3F");
  });
});
