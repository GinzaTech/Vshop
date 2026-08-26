import { act } from "react-test-renderer";
import { useCombatStore } from "~/hooks/useCombatStore";

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
