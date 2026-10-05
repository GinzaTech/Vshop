import React from "react";
import { FlatList, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ItemUpgradesScreen from "~/app/(authenticated)/item_upgrades";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { defaultUser } from "~/utils/valorant-user";
import { invalidateSessionOperations } from "~/utils/session-operations";

jest.setTimeout(15_000);

const mockUserState = { user: defaultUser };
const mockUpgrades = jest.fn();
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(
    (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState),
    { getState: () => mockUserState },
  ),
}));
jest.mock("~/utils/valorant-api", () => ({ getItemUpgrades: (...args: unknown[]) => mockUpgrades(...args) }));
jest.mock("~/utils/valorant-assets", () => ({ getAssetLookups: () => ({ skinByAnyId: new Map() }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-paper", () => ({ ActivityIndicator: "ActivityIndicator" }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("~/components/CurrencyIcon", () => "CurrencyIcon");
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/GlassCard", () => ({
  __esModule: true, default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/components/ui/AppRefreshControl", () => ({ __esModule: true, default: "AppRefreshControl" }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const response = (id: string): ItemUpgradesResponse => ({
  Definitions: [{
    ID: id,
    Item: { ItemTypeID: "skin", ItemID: id },
    RequiredEntitlement: { ItemTypeID: "skin", ItemID: id },
    ProgressionSchedule: { Name: "Path", ProgressionCurrencyID: "rad", ProgressionDeltaPerLevel: [] },
    RewardSchedule: { ID: "rewards", Name: "Rewards", Prerequisites: null, RewardsPerLevel: [] },
    Sidegrades: [],
  }],
});

describe("item upgrades request ownership", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<ItemUpgradesScreen />); }); };
  const update = async () => { await act(async () => { renderer!.update(<ItemUpgradesScreen />); }); };
  const rows = (): ItemUpgradesResponse["Definitions"] => renderer!.root.findAllByType(FlatList)[0]?.props.data ?? [];
  const loading = () => renderer!.root.findAllByType(Text).some((node) => node.props.children === "item_upgrades_page.loading");
  const refresh = () => renderer!.root.findByType(AppRefreshControl).props.onRefresh() as Promise<void>;
  beforeEach(() => {
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "synthetic-a", entitlementsToken: "synthetic-ent-a" };
    mockUpgrades.mockReset().mockResolvedValue(response("fresh"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; jest.restoreAllMocks(); });

  it("keeps B when the previous account A resolves later", async () => {
    const old = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("b"));
    await mount();
    mockUserState.user = { ...mockUserState.user, id: "b", accessToken: "synthetic-b" };
    await update();
    expect(rows().map((row) => row.ID)).toEqual(["b"]);
    await act(async () => { old.resolve(response("a")); });
    expect(rows().map((row) => row.ID)).toEqual(["b"]);
  });

  it.each(["id", "region", "accessToken", "entitlementsToken"] as const)(
    "hides old rows and starts a fresh load when %s changes", async (field) => {
      await mount();
      const next = deferred<ItemUpgradesResponse>();
      mockUpgrades.mockReturnValueOnce(next.promise);
      mockUserState.user = { ...mockUserState.user, [field]: `${field}-new` };
      await update();
      expect(mockUpgrades).toHaveBeenCalledTimes(2);
      expect(rows()).toEqual([]);
      expect(loading()).toBe(true);
      await act(async () => { next.resolve(response("next")); });
      expect(rows().map((row) => row.ID)).toEqual(["next"]);
    },
  );

  it("clears rows on logout and ignores the pending response", async () => {
    await mount();
    const pending = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(pending.promise);
    let task!: Promise<void>;
    act(() => { task = refresh(); });
    mockUserState.user = defaultUser;
    await update();
    expect(rows()).toEqual([]);
    await act(async () => { pending.resolve(response("late")); await task; });
    expect(rows()).toEqual([]);
    expect(loading()).toBe(false);
  });

  it("does not let an old rejection end the next account's loading", async () => {
    const old = deferred<ItemUpgradesResponse>();
    const next = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await mount();
    mockUserState.user = { ...mockUserState.user, id: "b", accessToken: "synthetic-b" };
    await update();
    await act(async () => { old.reject(new Error("old failure")); });
    expect(loading()).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
    await act(async () => { next.resolve(response("b")); });
    expect(rows().map((row) => row.ID)).toEqual(["b"]);
  });

  it("rejects a response when live credentials change before React renders", async () => {
    const pending = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(pending.promise);
    await mount();
    mockUserState.user = { ...mockUserState.user, accessToken: "rotated" };
    await act(async () => { pending.resolve(response("old")); });
    expect(rows()).toEqual([]);
    await update();
    expect(rows().map((row) => row.ID)).toEqual(["fresh"]);
  });

  it("ignores old-generation responses and permits a new refresh", async () => {
    await mount();
    const pending = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(pending.promise);
    let task!: Promise<void>;
    act(() => { task = refresh(); });
    invalidateSessionOperations();
    await act(async () => { pending.resolve(response("old-generation")); await task; });
    expect(rows().map((row) => row.ID)).toEqual(["fresh"]);
    mockUpgrades.mockResolvedValueOnce(response("recovered"));
    await act(async () => { await refresh(); });
    expect(rows().map((row) => row.ID)).toEqual(["recovered"]);
  });

  it.each(["null", "reject"])("keeps same-account rows on a %s refresh failure", async (failure) => {
    await mount();
    if (failure === "null") mockUpgrades.mockResolvedValueOnce(null);
    else mockUpgrades.mockRejectedValueOnce(new Error("temporary"));
    await act(async () => { await refresh(); });
    expect(rows().map((row) => row.ID)).toEqual(["fresh"]);
    expect(renderer!.root.findByType(AppRefreshControl).props.refreshing).toBe(false);
  });

  it("does not refetch for an unrelated balance update", async () => {
    await mount();
    mockUserState.user = { ...mockUserState.user, balances: { ...mockUserState.user.balances, rad: 100 } };
    await update();
    expect(mockUpgrades).toHaveBeenCalledTimes(1);
  });

  it("ignores a retained refresh and pending failure after unmount", async () => {
    await mount();
    const retained = refresh;
    const callback = renderer!.root.findByType(AppRefreshControl).props.onRefresh as () => Promise<void>;
    const pending = deferred<ItemUpgradesResponse>();
    mockUpgrades.mockReturnValueOnce(pending.promise);
    let task!: Promise<void>;
    act(() => { task = retained(); renderer!.unmount(); });
    await act(async () => { pending.reject(new Error("late")); await task; await callback(); });
    expect(mockUpgrades).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });
});
