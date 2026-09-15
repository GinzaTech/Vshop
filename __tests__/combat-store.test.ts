import { act } from "react-test-renderer";
import { useCombatStore } from "~/hooks/useCombatStore";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockActiveUser = { user: { accessToken: "access-one", entitlementsToken: "entitlements-one", id: "one", region: "ap" } };
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => mockActiveUser } }));

const mockGetPartyPlayer = jest.fn();
const mockGetPreGamePlayer = jest.fn();
const mockGetCurrentGamePlayer = jest.fn();
const mockGetParty = jest.fn();
const mockGetPreGameMatch = jest.fn();
const mockGetCurrentGameMatch = jest.fn();
const mockGetPlayerNames = jest.fn();

jest.mock("~/utils/valorant-api", () => ({
  defaultUser: {
    accessToken: "",
    entitlementsToken: "",
    id: "",
    region: "",
  },
  getPartyPlayer: (...args: unknown[]) => mockGetPartyPlayer(...args),
  getPreGamePlayer: (...args: unknown[]) => mockGetPreGamePlayer(...args),
  getCurrentGamePlayer: (...args: unknown[]) => mockGetCurrentGamePlayer(...args),
  getParty: (...args: unknown[]) => mockGetParty(...args),
  getPreGameMatch: (...args: unknown[]) => mockGetPreGameMatch(...args),
  getCurrentGameMatch: (...args: unknown[]) => mockGetCurrentGameMatch(...args),
  getPlayerNames: (...args: unknown[]) => mockGetPlayerNames(...args),
}));

const user = (id: string) => ({
  accessToken: `access-${id}`,
  entitlementsToken: `entitlements-${id}`,
  id,
  region: "ap",
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
};

describe("combat store request ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveUser.user = user("one");
    useCombatStore.getState().resetSession();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    useCombatStore.setState({
      lastUpdated: 0,
      loading: false,
      sessionKey: null,
      snapshot: {
        state: "idle",
        matchId: null,
        partyId: null,
        pregameMatch: null,
        currentGameMatch: null,
        party: null,
        namesBySubject: {},
      },
    });
    mockGetPreGamePlayer.mockResolvedValue(null);
    mockGetCurrentGamePlayer.mockResolvedValue(null);
    mockGetParty.mockResolvedValue(null);
    mockGetPreGameMatch.mockResolvedValue(null);
    mockGetCurrentGameMatch.mockResolvedValue(null);
    mockGetPlayerNames.mockResolvedValue([]);
    mockGetPartyPlayer.mockReset().mockResolvedValue(null);
  });

  it.each(["account", "token", "generation"])("discards an in-flight snapshot after %s changed without another fetch", async (changed) => {
    const party = deferred<{ CurrentPartyID: string } | null>();
    mockGetPartyPlayer.mockReturnValueOnce(party.promise);
    const request = useCombatStore.getState().fetchSession(user("one"));
    if (changed === "account") mockActiveUser.user = user("two");
    if (changed === "token") mockActiveUser.user = { ...user("one"), entitlementsToken: "rotated" };
    if (changed === "generation") invalidateSessionOperations();
    party.resolve({ CurrentPartyID: "stale-party" });
    mockGetParty.mockResolvedValue({ ID: "stale-party", Members: [] });
    await request;
    expect(mockGetParty).not.toHaveBeenCalled();
    expect(useCombatStore.getState().snapshot.partyId).toBeNull();
    expect(useCombatStore.getState().lastUpdated).toBe(0);
    expect(useCombatStore.getState().loading).toBe(false);
  });

  it("ignores a delayed caller from an old account, including an empty stale caller", async () => {
    mockActiveUser.user = user("two");
    await useCombatStore.getState().fetchSession(user("two"));
    await useCombatStore.getState().fetchSession(user("one"));
    await useCombatStore.getState().fetchSession({ ...user("one"), accessToken: "" });
    expect(mockGetPartyPlayer).toHaveBeenCalledTimes(1);
    expect(useCombatStore.getState().sessionKey).toBe("ap|two");
  });

  it("resets on a current signed-out caller", async () => {
    mockActiveUser.user = { ...user("one"), accessToken: "" };
    await useCombatStore.getState().fetchSession(mockActiveUser.user);
    expect(mockGetPartyPlayer).not.toHaveBeenCalled();
    expect(useCombatStore.getState()).toMatchObject({ loading: false, sessionKey: null });
  });

  it.each(["pregame", "live"])("builds a %s snapshot with deduplicated normalized names", async (phase) => {
    mockGetPartyPlayer.mockResolvedValue({ CurrentPartyID: "party" });
    mockGetParty.mockResolvedValue({ ID: "party", Members: [{ Subject: "ONE" }] });
    if (phase === "pregame") {
      mockGetPreGamePlayer.mockResolvedValue({ MatchID: "pre" });
      mockGetPreGameMatch.mockResolvedValue({ ID: "pre", AllyTeam: { Players: [{ Subject: "one" }] }, EnemyTeam: { Players: [{ Subject: "TWO" }] } });
    } else {
      mockGetCurrentGamePlayer.mockResolvedValue({ MatchID: "live" });
      mockGetCurrentGameMatch.mockResolvedValue({ MatchID: "live", Players: [{ Subject: "ONE" }, { Subject: "TWO" }, { Subject: "" }] });
    }
    mockGetPlayerNames.mockResolvedValue([{ Subject: "ONE", GameName: "Player", TagLine: "TAG" }, { Subject: "TWO", GameName: "Other", TagLine: "" }]);
    await expect(useCombatStore.getState().fetchSession(user("one"))).resolves.toMatchObject({ state: phase, namesBySubject: { one: "Player#TAG", two: "Other" } });
    expect(mockGetPlayerNames).toHaveBeenCalledWith("access-one", "entitlements-one", ["one", "two"], "ap");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reset invalidates a pending response and allows a new request for the same credentials", async () => {
    const oldParty = deferred<{ CurrentPartyID: string } | null>();
    mockGetPartyPlayer.mockReturnValueOnce(oldParty.promise).mockResolvedValueOnce(null);
    const oldRequest = useCombatStore.getState().fetchSession(user("one"));
    useCombatStore.getState().resetSession();
    expect(useCombatStore.getState()).toMatchObject({ sessionKey: null, loading: false, lastUpdated: 0 });
    await useCombatStore.getState().fetchSession(user("one"));
    expect(mockGetPartyPlayer).toHaveBeenCalledTimes(2);
    oldParty.resolve({ CurrentPartyID: "old-party" });
    await oldRequest;
    expect(useCombatStore.getState().snapshot.partyId).toBeNull();
  });

  it("deduplicates concurrent refreshes for the same account", async () => {
    const party = deferred<{ CurrentPartyID: string } | null>();
    mockGetPartyPlayer.mockReturnValue(party.promise);

    const first = useCombatStore.getState().fetchSession(user("one"));
    const second = useCombatStore.getState().fetchSession(user("one"));

    expect(mockGetPartyPlayer).toHaveBeenCalledTimes(1);

    party.resolve(null);
    await act(async () => {
      await Promise.all([first, second]);
    });
  });

  it("does not let an older account response overwrite the active account", async () => {
    const firstParty = deferred<{ CurrentPartyID: string } | null>();
    mockGetPartyPlayer
      .mockReturnValueOnce(firstParty.promise)
      .mockResolvedValueOnce({ CurrentPartyID: "party-two" });
    mockGetParty.mockImplementation(
      async (_access, _entitlements, _region, partyId) => ({
        ID: partyId,
        Members: [],
      }),
    );

    const first = useCombatStore.getState().fetchSession(user("one"));
    mockActiveUser.user = user("two");
    const second = useCombatStore.getState().fetchSession(user("two"));
    await act(async () => {
      await second;
    });

    firstParty.resolve({ CurrentPartyID: "party-one" });
    await act(async () => {
      await first;
    });

    expect(useCombatStore.getState().sessionKey).toBe("ap|two");
    expect(useCombatStore.getState().snapshot.partyId).toBe("party-two");
  });

  it("starts a fresh request after credentials rotate for the same account", async () => {
    const oldParty = deferred<{ CurrentPartyID: string } | null>();
    mockGetPartyPlayer
      .mockReturnValueOnce(oldParty.promise)
      .mockResolvedValueOnce({ CurrentPartyID: "party-fresh" });
    mockGetParty.mockImplementation(
      async (_access, _entitlements, _region, partyId) => ({
        ID: partyId,
        Members: [],
      }),
    );

    const oldUser = user("one");
    const renewedUser = {
      ...oldUser,
      accessToken: "access-one-renewed",
      entitlementsToken: "entitlements-one-renewed",
    };
    const first = useCombatStore.getState().fetchSession(oldUser);
    mockActiveUser.user = renewedUser;
    const second = useCombatStore.getState().fetchSession(renewedUser);

    await act(async () => {
      await second;
    });
    expect(mockGetPartyPlayer).toHaveBeenCalledTimes(2);
    expect(useCombatStore.getState().snapshot.partyId).toBe("party-fresh");

    oldParty.resolve({ CurrentPartyID: "party-stale" });
    await act(async () => {
      await first;
    });
    expect(useCombatStore.getState().snapshot.partyId).toBe("party-fresh");
  });

  it("preserves a good snapshot when a refresh fails", async () => {
    mockGetPartyPlayer.mockResolvedValue({ CurrentPartyID: "party-one" });
    mockGetParty.mockResolvedValue({ ID: "party-one", Members: [] });
    await act(async () => {
      await useCombatStore.getState().fetchSession(user("one"));
    });

    mockGetPartyPlayer.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await useCombatStore.getState().fetchSession(user("one"));
    });

    expect(useCombatStore.getState().snapshot.partyId).toBe("party-one");
    expect(useCombatStore.getState().loading).toBe(false);
  });
});
