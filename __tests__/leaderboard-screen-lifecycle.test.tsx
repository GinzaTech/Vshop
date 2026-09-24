import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { FlatList, TextInput, TouchableOpacity } from "react-native";
import LeaderboardScreen from "~/app/(authenticated)/leaderboard";

jest.setTimeout(15_000);

const account = (id: string, region = "ap") => ({ id, region, accessToken: `access-${id}`, entitlementsToken: `ent-${id}` });
let mockUser = account("one");
const mockContent = jest.fn();
const mockLeaderboard = jest.fn();

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(<T,>(select: (state: { user: typeof mockUser }) => T) => select({ user: mockUser }), {
    getState: () => ({ user: mockUser }),
  }),
}));
jest.mock("~/utils/valorant-api", () => ({
  getContent: (...args: unknown[]) => mockContent(...args),
  getLeaderboard: (...args: unknown[]) => mockLeaderboard(...args),
}));
jest.mock("~/utils/valorant-assets", () => ({
  getAssets: () => ({ competitiveTiers: [{ tiers: [{ tier: 1 }] }] }),
  fetchCompetitiveTiers: jest.fn(),
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("react-native-paper", () => ({ ActivityIndicator: "ActivityIndicator" }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "Image" }));
jest.mock("~/components/ui/GlassCard", () => "GlassCard");
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const content = (name: string) => ({ Seasons: ["active", "old"].map((suffix, index) => ({
  ID: `${name}-${suffix}`, Name: `${name}-${suffix}`, Type: "act", StartTime: "2020-01-01T00:00:00Z", EndTime: "2030-01-01T00:00:00Z", IsActive: index === 0,
})) });
const board = (name: string) => ({ Players: [{ puuid: name, gameName: name, leaderboardRank: 1, competitiveTier: 1 }], totalPlayers: 1 });

describe("leaderboard screen request ownership", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const rows = () => renderer.root.findAllByType(FlatList)[0]?.props.data ?? [];
  const update = async () => { await act(async () => { renderer.update(<LeaderboardScreen />); }); };
  beforeEach(() => {
    mockUser = account("one");
    mockContent.mockReset().mockResolvedValue(content("one"));
    mockLeaderboard.mockReset().mockResolvedValue(board("one"));
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.restoreAllMocks(); });
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<LeaderboardScreen />); }); };

  it("uses the season semantic icon without changing season control semantics", async () => {
    await mount();

    const seasonIcons = renderer.root
      .findAllByType(MockAppIcon)
      .filter((icon) => ["season", "leaderboardSeason"].includes(icon.props.name));
    expect(seasonIcons).toHaveLength(1);
    expect(seasonIcons[0].props.name).toBe("season");
    expect(seasonIcons[0].props.decorative).toBe(true);

    const seasonControls = renderer.root
      .findAllByType(TouchableOpacity)
      .filter((control) => control.props.accessibilityState?.selected !== undefined);
    expect(seasonControls).toHaveLength(2);
    expect(seasonControls.map((control) => control.props.accessibilityRole)).toEqual([
      "button",
      "button",
    ]);
    expect(seasonControls.map((control) => control.props.accessibilityState)).toEqual([
      { selected: true },
      { selected: false },
    ]);
  });

  it.each([account("two"), account("one", "eu")])("reinitializes and clears rows for a stable account/region change: %j", async (next) => {
    await mount();
    const pending = deferred<ReturnType<typeof content>>();
    mockContent.mockReturnValue(pending.promise);
    mockUser = next;
    await update();
    expect(mockContent).toHaveBeenCalledTimes(2);
    expect(rows()).toEqual([]);
    await act(async () => { pending.resolve(content("next")); });
    expect(mockLeaderboard).toHaveBeenLastCalledWith(next.accessToken, next.entitlementsToken, next.region, "next-active", { startIndex: 0, size: 100 });
  });

  it("does not reinitialize on unrelated store updates", async () => {
    await mount();
    mockUser = { ...mockUser };
    await update();
    expect(mockContent).toHaveBeenCalledTimes(1);
  });

  it("ignores stale content before React has rendered the changed account", async () => {
    const old = deferred<ReturnType<typeof content>>();
    mockContent.mockReturnValue(old.promise);
    await mount();
    mockUser = account("two");
    await act(async () => { old.resolve(content("old")); });
    expect(mockLeaderboard).not.toHaveBeenCalled();
  });

  it("ignores a board response after token rotation before the next render", async () => {
    const old = deferred<ReturnType<typeof board>>();
    mockLeaderboard.mockReturnValue(old.promise);
    await mount();
    mockUser = { ...mockUser, accessToken: "rotated" };
    await act(async () => { old.resolve(board("stale-token")); });
    expect(rows()).toEqual([]);
  });

  it("clears data on logout and ends the loading state", async () => {
    await mount();
    mockUser = { id: "", region: "", accessToken: "", entitlementsToken: "" };
    await update();
    expect(rows()).toEqual([]);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it("keeps the newest season when two responses finish in reverse order", async () => {
    const old = deferred<ReturnType<typeof board>>();
    mockLeaderboard.mockReturnValueOnce(old.promise).mockResolvedValue(board("new-season"));
    // Seed cached rows so season controls remain visible during requests.
    await mount();
    await act(async () => { old.resolve(board("seed")); });
    const first = deferred<ReturnType<typeof board>>();
    mockLeaderboard.mockReturnValueOnce(first.promise).mockResolvedValueOnce(board("new-season"));
    const chips = () => renderer.root.findAllByType(TouchableOpacity);
    await act(async () => { chips()[1].props.onPress(); });
    await act(async () => { chips()[0].props.onPress(); });
    await act(async () => { first.resolve(board("stale-season")); });
    expect(rows()[0].gameName).toBe("new-season");
  });

  it("retains cached rows on a failed refresh", async () => {
    await mount();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockLeaderboard.mockRejectedValueOnce(new Error("temporary"));
    await act(async () => { await renderer.root.findByType(FlatList).props.refreshControl.props.onRefresh(); });
    expect(rows()[0].gameName).toBe("one");
    expect(renderer.root.findByType(FlatList).props.refreshControl.props.refreshing).toBe(false);
  });

  it("retries content through pull-to-refresh after initial content failure", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockContent.mockRejectedValueOnce(new Error("temporary")).mockResolvedValue(content("recovered"));
    await mount();
    await act(async () => { await renderer.root.findByType(FlatList).props.refreshControl.props.onRefresh(); });
    expect(mockContent).toHaveBeenCalledTimes(2);
    expect(mockLeaderboard.mock.calls[0][3]).toBe("recovered-active");
  });

  it("does not continue initialization after unmount", async () => {
    const pending = deferred<ReturnType<typeof content>>();
    mockContent.mockReturnValue(pending.promise);
    await mount();
    act(() => renderer.unmount());
    await act(async () => { pending.resolve(content("late")); });
    expect(mockLeaderboard).not.toHaveBeenCalled();
  });

  it.each([null, { Seasons: [] }])("renders a refreshable empty list when content has no seasons: %j", async (result) => {
    mockContent.mockResolvedValue(result);
    await mount();
    expect(rows()).toEqual([]);
    expect(renderer.root.findAllByType(FlatList)).toHaveLength(1);
  });

  it("keeps cached rows on a null leaderboard response", async () => {
    await mount();
    mockLeaderboard.mockResolvedValueOnce(null);
    await act(async () => { await renderer.root.findByType(FlatList).props.refreshControl.props.onRefresh(); });
    expect(rows()[0].gameName).toBe("one");
  });

  it("ignores an old board failure after a newer season has loaded", async () => {
    await mount();
    const old = deferred<ReturnType<typeof board>>();
    mockLeaderboard.mockReturnValueOnce(old.promise).mockResolvedValueOnce(board("new"));
    const chips = () => renderer.root.findAllByType(TouchableOpacity);
    await act(async () => { chips()[1].props.onPress(); });
    await act(async () => { chips()[0].props.onPress(); });
    await act(async () => { old.reject(new Error("stale error")); });
    expect(rows()[0].gameName).toBe("new");
  });

  it("rejects a retained season handler from a previous A to B to A session", async () => {
    await mount();
    const oldSelect = renderer.root.findAllByType(TouchableOpacity)[1].props.onPress;
    mockUser = account("two");
    await update();
    mockUser = account("one");
    await update();
    const requests = mockLeaderboard.mock.calls.length;
    await act(async () => { oldSelect(); });
    expect(mockLeaderboard).toHaveBeenCalledTimes(requests);
  });
});
