import React from "react";
import { Switch, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AboutScreen from "~/app/(authenticated)/about";
import ContractsScreen from "~/app/(authenticated)/contracts";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAccountScreenData, type AccountScreenLoadResult } from "~/hooks/useAccountScreenData";
import { defaultUser } from "~/utils/valorant-user";

const mockUserState = { user: defaultUser };
const mockPlayerInfo = jest.fn();
const mockConfig = jest.fn();
const mockContent = jest.fn();
const mockContracts = jest.fn();
const mockDefinitions = jest.fn();
const mockStorage = jest.fn();

jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(
    (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState),
    { getState: () => mockUserState },
  ),
}));
jest.mock("~/utils/valorant-api", () => ({
  getPlayerInfo: (...args: unknown[]) => mockPlayerInfo(...args),
  getRiotClientConfig: (...args: unknown[]) => mockConfig(...args),
  getContent: (...args: unknown[]) => mockContent(...args),
  getContracts: (...args: unknown[]) => mockContracts(...args),
}));
jest.mock("~/services/valorant/public-api", () => ({
  getPublicContracts: (...args: unknown[]) => mockDefinitions(...args),
}));
jest.mock("~/utils/storage", () => ({
  getStoredItem: (...args: unknown[]) => mockStorage(...args),
  setStoredItem: jest.fn(),
  removeStoredItem: jest.fn(),
}));
jest.mock("~/utils/valorant-assets", () => ({ getAgent: () => ({ agents: [] }) }));
jest.mock("~/utils/localization", () => ({ getVAPILang: () => "en-US" }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-paper", () => ({ ActivityIndicator: "ActivityIndicator" }));
jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: "AppIcon",
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/GlassCard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function player(name: string) {
  return {
    sub: name,
    acct: { game_name: name, tag_line: "TEST", created_at: "" },
    country: "VN",
    email_verified: true,
    phone_number_verified: false,
  };
}

function contracts(name: string) {
  return {
    Contracts: [{
      ContractDefinitionID: name,
      ProgressionLevelReached: 1,
      ProgressionTowardsNextLevel: 100,
      ContractProgression: { TotalProgressionEarned: 20 },
    }],
    Missions: [],
  };
}

const scenarios = [
  { name: "about", Screen: AboutScreen, request: mockPlayerInfo, payload: player, displayed: (name: string) => `${name}#TEST` },
  { name: "contracts", Screen: ContractsScreen, request: mockContracts, payload: contracts, displayed: (name: string) => name },
];

describe.each(scenarios)("$name session responses", ({ Screen, request, payload, displayed }) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let errorLog: jest.SpyInstance;
  const text = () => renderer!.root.findAllByType(Text).map((node) => node.props.children);
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<Screen />); }); };
  const rerender = async () => { await act(async () => { renderer!.update(<Screen />); }); };
  const refresh = () => renderer!.root.findByType(AppRefreshControl).props.onRefresh() as Promise<void>;

  beforeEach(() => {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "access-a", entitlementsToken: "ent-a" };
    mockConfig.mockResolvedValue({ featureA: true });
    mockContent.mockResolvedValue({ Seasons: [{ Type: "act", IsActive: true, Name: "Act A", EndTime: "2026-12-01" }] });
    mockStorage.mockResolvedValue(null);
    mockDefinitions.mockResolvedValue(["A", "B", "old", "new"].map((name) => ({ uuid: name, displayName: name })));
    request.mockResolvedValue(payload("A"));
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    errorLog.mockRestore();
  });

  it("clears displayed account data when the session is removed", async () => {
    await mount();
    expect(text()).toContain(displayed("A"));
    mockUserState.user = defaultUser;
    await rerender();
    expect(text()).not.toContain(displayed("A"));
    expect(text()).not.toContain("Act A");
    expect(renderer!.root.findByType(AppRefreshControl)).toBeDefined();
  });

  it.each(["id", "region", "accessToken", "entitlementsToken"] as const)(
    "clears data and reloads when %s changes",
    async (field) => {
      await mount();
      const pending = deferred<ReturnType<typeof payload>>();
      request.mockReturnValueOnce(pending.promise);
      mockUserState.user = { ...mockUserState.user, [field]: `${field}-b` };
      await rerender();
      expect(request).toHaveBeenCalledTimes(2);
      expect(text()).not.toContain(displayed("A"));
      await act(async () => { pending.resolve(payload("B")); });
      expect(text()).toContain(displayed("B"));
    },
  );

  it("ignores A finishing after the new account B response", async () => {
    const old = deferred<ReturnType<typeof payload>>();
    request.mockReturnValueOnce(old.promise).mockResolvedValueOnce(payload("B"));
    await mount();
    mockUserState.user = { ...mockUserState.user, id: "b", accessToken: "access-b" };
    await rerender();
    expect(text()).toContain(displayed("B"));
    await act(async () => { old.resolve(payload("A")); });
    expect(text()).toContain(displayed("B"));
    expect(text()).not.toContain(displayed("A"));
  });

  it("rejects the first request after switching A to B and back to the exact A session", async () => {
    const old = deferred<ReturnType<typeof payload>>();
    const originalSession = mockUserState.user;
    request.mockReturnValueOnce(old.promise).mockResolvedValueOnce(payload("B")).mockResolvedValueOnce(payload("new"));
    await mount();
    mockUserState.user = { ...originalSession, id: "b", accessToken: "access-b" };
    await rerender();
    mockUserState.user = originalSession;
    await rerender();
    expect(text()).toContain(displayed("new"));
    await act(async () => { old.resolve(payload("old")); });
    expect(text()).toContain(displayed("new"));
    expect(text()).not.toContain(displayed("old"));
  });

  it.each(["id", "region", "accessToken", "entitlementsToken"] as const)(
    "checks live store %s before React has rendered the new session",
    async (field) => {
      const pending = deferred<ReturnType<typeof payload>>();
      request.mockReturnValueOnce(pending.promise);
      await mount();
      mockUserState.user = { ...mockUserState.user, [field]: `${field}-b` };
      await act(async () => { pending.resolve(payload("A")); });
      expect(text()).not.toContain(displayed("A"));
    },
  );

  it("does not reload on unrelated user balance updates", async () => {
    await mount();
    mockUserState.user = { ...mockUserState.user, balances: { ...mockUserState.user.balances, vp: 999 } };
    await rerender();
    expect(request).toHaveBeenCalledTimes(1);
    expect(text()).toContain(displayed("A"));
  });

  it.each(["id", "region", "accessToken", "entitlementsToken"] as const)(
    "does not load with missing %s",
    async (field) => {
      mockUserState.user = { ...mockUserState.user, [field]: "" };
      await mount();
      expect(request).not.toHaveBeenCalled();
      expect(renderer!.root.findByType(AppRefreshControl)).toBeDefined();
    },
  );

  it("discards failures after unmount", async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    request.mockReturnValueOnce(pending.promise);
    await mount();
    errorLog.mockClear();
    act(() => renderer!.unmount());
    await act(async () => { pending.reject(new Error("unmounted request")); });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("keeps displayed data if a same-session refresh returns null", async () => {
    await mount();
    request.mockResolvedValueOnce(null);
    await act(async () => { await refresh(); });
    expect(text()).toContain(displayed("A"));
  });

  it("keeps displayed data if a same-session refresh rejects", async () => {
    await mount();
    request.mockRejectedValueOnce(new Error("temporary network error"));
    await act(async () => { await refresh(); });
    expect(text()).toContain(displayed("A"));
    expect(renderer!.root.findByType(AppRefreshControl).props.refreshing).toBe(false);
  });

  it("does not let an old failure finish the next session's loading", async () => {
    const old = deferred<ReturnType<typeof payload>>();
    const current = deferred<ReturnType<typeof payload>>();
    request.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await mount();
    mockUserState.user = { ...mockUserState.user, accessToken: "access-b" };
    await rerender();
    await act(async () => { old.reject(new Error("expired request")); });
    expect(text()).toContain(Screen === AboutScreen ? "about_page.loading" : "contracts_page.loading");
    await act(async () => { current.resolve(payload("B")); });
    expect(text()).toContain(displayed("B"));
  });

  it("logs only redacted error metadata for the current session", async () => {
    request.mockRejectedValueOnce({ config: { headers: { Authorization: "Bearer screen-private-token" } } });
    await mount();
    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("screen-private-token");
  });

  if (Screen === AboutScreen) {
    it("loads boolean overrides and lets a local toggle update the visible value", async () => {
      mockStorage.mockResolvedValueOnce('{"featureA":false}');
      await mount();
      expect(renderer!.root.findByType(Switch).props.value).toBe(false);
      await act(async () => { await renderer!.root.findByType(Switch).props.onValueChange(true); });
      expect(renderer!.root.findByType(Switch).props.value).toBe(true);
    });

    it.each(['{"featureA":"false"}', '{broken', 'null', '[]'])(
      "keeps valid API data when cached toggle data is invalid: %s",
      async (raw) => {
        mockStorage.mockResolvedValueOnce(raw);
        await mount();
        expect(text()).toContain(displayed("A"));
        expect(renderer!.root.findByType(Switch).props.value).toBe(true);
      },
    );
  }

  if (Screen === ContractsScreen) {
    it("keeps contract names after a definitions refresh fails", async () => {
      await mount();
      mockDefinitions.mockRejectedValueOnce(new Error("definitions unavailable"));
      await act(async () => { await refresh(); });
      expect(text()).toContain("A");
    });
  }
});

describe("account screen request ownership", () => {
  const emptyData = { label: "empty" };
  const load = jest.fn<Promise<AccountScreenLoadResult<typeof emptyData>>, []>();
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let result: ReturnType<typeof useAccountScreenData<typeof emptyData>>;
  let errorLog: jest.SpyInstance;
  function Probe() {
    result = useAccountScreenData(load, emptyData, "[screen] load error");
    return <Text>{result.data.label}</Text>;
  }
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<Probe />); }); };
  const rerender = async () => { await act(async () => { renderer!.update(<Probe />); }); };
  const response = (label: string) => ({ data: { label }, errors: [] });

  beforeEach(() => {
    load.mockReset().mockResolvedValue(response("initial"));
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "access-a", entitlementsToken: "ent-a" };
  });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; errorLog.mockRestore(); });

  it("accepts only the latest of overlapping requests within the same session", async () => {
    await mount();
    const old = deferred<AccountScreenLoadResult<typeof emptyData>>();
    load.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("latest"));
    let oldTask!: Promise<void>;
    act(() => { oldTask = result.reload(); });
    await act(async () => { await result.reload(); });
    expect(result!.data.label).toBe("latest");
    await act(async () => { old.resolve(response("old")); await oldTask; });
    expect(result!.data.label).toBe("latest");
  });

  it("invalidates a retained reload after A to B to A, even with identical credentials", async () => {
    const originalSession = mockUserState.user;
    await mount();
    const retained = result!.reload;
    mockUserState.user = { ...originalSession, id: "b" };
    await rerender();
    mockUserState.user = originalSession;
    await rerender();
    await act(async () => { await retained(); });
    expect(load).toHaveBeenCalledTimes(3);
    expect(result!.data.label).toBe("initial");
  });

  it("ignores retained reload and edits after unmount", async () => {
    await mount();
    const retained = result!;
    const edit = jest.fn((data: typeof emptyData) => data);
    act(() => renderer!.unmount());
    await retained.reload();
    retained.updateData(edit);
    expect(load).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
  });

  it("keeps displayed data after an unexpected loader exception", async () => {
    await mount();
    load.mockImplementationOnce(() => { throw new Error("unexpected loader error"); });
    await act(async () => { await result.reload(); });
    expect(result!.data.label).toBe("initial");
    expect(result!.loading).toBe(false);
    expect(errorLog).toHaveBeenCalled();
  });

  it("ignores a loader exception when the live session changes before React renders", async () => {
    const pending = deferred<AccountScreenLoadResult<typeof emptyData>>();
    load.mockReturnValueOnce(pending.promise);
    await mount();
    errorLog.mockClear();
    mockUserState.user = { ...mockUserState.user, entitlementsToken: "ent-new" };
    await act(async () => { pending.reject(new Error("old loader failure")); });
    expect(result!.loading).toBe(true);
    expect(result!.data.label).toBe("empty");
    expect(errorLog).not.toHaveBeenCalled();
  });
});
