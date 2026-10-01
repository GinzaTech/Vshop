import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { useBundleOwnership } from "~/hooks/useBundleOwnership";
import { defaultUser } from "~/utils/valorant-user";
import { VItemTypes } from "~/utils/misc";
import type { ProfileWarmCache } from "~/utils/profile-cache";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockUserState: { user: typeof defaultUser } = { user: defaultUser };
const mockCacheByAuth: Record<string, Partial<ProfileWarmCache>> = {};
const mockOwnedItems = jest.fn();

jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(
    (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState),
    { getState: () => mockUserState },
  ),
}));

jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: Object.assign(
    (selector: (state: { cacheByAuth: typeof mockCacheByAuth }) => unknown) =>
      selector({ cacheByAuth: mockCacheByAuth }),
    { getState: () => ({ cacheByAuth: mockCacheByAuth }) },
  ),
}));

jest.mock("~/utils/valorant-api", () => ({
  ownedItems: (...args: unknown[]) => mockOwnedItems(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const entitlements = (ids: string[]) => ({ Entitlements: ids.map((ItemID) => ({ ItemID })) });

function skinWithIds(ids: { root?: string; level?: string; chroma?: string }): SkinShopItem {
  return {
    uuid: ids.root ?? "unowned-root",
    displayName: "Skin",
    themeUuid: "",
    assetPath: "",
    chromas: [
      {
        uuid: ids.chroma ?? "unowned-chroma",
        displayName: "Standard",
        fullRender: "",
        assetPath: "",
      },
    ],
    levels: [
      { uuid: ids.level ?? "unowned-level", displayName: "Level 1", assetPath: "" },
    ],
    price: 1000,
  };
}

const accessoryWithUuid = (uuid: string): AccessoryShopItem => ({
  uuid,
  displayName: "Accessory",
  price: 300,
});

const accountA = { ...defaultUser, id: "a", region: "ap", accessToken: "access-a", entitlementsToken: "ent-a" };
const accountB = { ...defaultUser, id: "b", region: "ap", accessToken: "access-b", entitlementsToken: "ent-b" };

type HookResult = ReturnType<typeof useBundleOwnership>;

let hookResult: HookResult | undefined;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let errorLog: jest.SpyInstance;

function Probe() {
  const result = useBundleOwnership();
  // Ghi kết quả hook sau render (effect) — tránh side effect trong render.
  React.useEffect(() => {
    hookResult = result;
  });
  return <Text>probe</Text>;
}

const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
  });
};
const rerender = async () => {
  await act(async () => {
    renderer!.update(<Probe />);
  });
};

beforeEach(() => {
  jest.resetAllMocks();
  errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  mockUserState.user = accountA;
  Object.keys(mockCacheByAuth).forEach((key) => delete mockCacheByAuth[key]);
  hookResult = undefined;
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  hookResult = undefined;
  errorLog.mockRestore();
});

describe("useBundleOwnership", () => {
  it.each(["accessToken", "entitlementsToken"] as const)("keeps accepted same-account positives during a failed %s renewal", async (token) => {
    mockOwnedItems.mockResolvedValue(entitlements(["accepted"]));
    await mount();
    mockOwnedItems.mockRejectedValue(new Error("offline"));
    mockUserState.user = { ...accountA, [token]: "renewed-test-credential" };
    await rerender();
    expect(hookResult!.isOwned(skinWithIds({ level: "accepted" }))).toBe(true);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("accepted"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
  });

  it("retires accepted accessory evidence across guest and other-account transitions", async () => {
    mockOwnedItems.mockResolvedValue(entitlements(["accepted-a"]));
    await mount();
    mockOwnedItems.mockResolvedValue(entitlements([]));
    mockUserState.user = defaultUser;
    await rerender();
    expect(hookResult!.isOwned({ ...accessoryWithUuid("accepted-a"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
    mockUserState.user = accountA;
    await rerender();
    expect(hookResult!.isOwned({ ...accessoryWithUuid("accepted-a"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
    mockOwnedItems.mockResolvedValue(entitlements(["accepted-again"]));
    await act(async () => { await hookResult!.reload(); });
    mockUserState.user = { ...accountA, region: "eu" };
    mockOwnedItems.mockResolvedValue(entitlements([]));
    await rerender();
    expect(hookResult!.isOwned({ ...accessoryWithUuid("accepted-again"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
  });

  it("rejects a live-store token change before React rerenders", async () => {
    const pending = deferred<ReturnType<typeof entitlements>>();
    mockOwnedItems.mockReturnValue(pending.promise);
    await mount();
    mockUserState.user = { ...accountA, accessToken: "changed-before-render" };
    await act(async () => { pending.resolve(entitlements(["stale-before-render"])); });
    mockOwnedItems.mockResolvedValue(entitlements([]));
    await rerender();
    expect(hookResult!.isOwned({ ...accessoryWithUuid("stale-before-render"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
  });

  it("requests all seven read-only categories and badges each accessory with exact type evidence", async () => {
    mockOwnedItems.mockImplementation((_access, _ent, _region, _id, itemTypeId) =>
      Promise.resolve({ Subject: "a", ItemTypeID: itemTypeId, ...entitlements([itemTypeId]) }));
    await mount();
    const types = [VItemTypes.SkinLevel, VItemTypes.SkinChroma, VItemTypes.Spray,
      VItemTypes.Flex, VItemTypes.PlayerCard, VItemTypes.PlayerTitle, VItemTypes.Buddy];
    expect(mockOwnedItems.mock.calls.map((call) => call[4])).toEqual(types);
    for (const itemTypeId of types.slice(2)) {
      expect(hookResult!.isOwned({ ...accessoryWithUuid(itemTypeId), itemTypeId })).toBe(true);
      expect(hookResult!.isOwned({ ...accessoryWithUuid(VItemTypes.SkinLevel), itemTypeId })).toBe(false);
    }
    await rerender();
    mockUserState.user = { ...accountA, ownedSkinIds: ["unrelated-user-store-change"] };
    await rerender();
    expect(mockOwnedItems).toHaveBeenCalledTimes(7);
  });

  it("seeds each cached accessory category for the same account without treating skin IDs as accessories", async () => {
    mockCacheByAuth["ap|a"] = {
      ownedSkinItemIds: ["skin-only"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
      ownedPlayerCardItemIds: ["card"], ownedPlayerTitleItemIds: ["title"],
    };
    mockCacheByAuth["ap|b"] = { ownedPlayerCardItemIds: ["foreign-card"] };
    mockOwnedItems.mockReturnValue(new Promise(() => {}));
    await mount();
    for (const [itemTypeId, uuid] of [[VItemTypes.Spray, "spray"], [VItemTypes.Flex, "flex"],
      [VItemTypes.PlayerCard, "card"], [VItemTypes.PlayerTitle, "title"]]) {
      expect(hookResult!.isOwned({ ...accessoryWithUuid(uuid), itemTypeId })).toBe(true);
    }
    expect(hookResult!.isOwned({ ...accessoryWithUuid("foreign-card"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("skin-only"), itemTypeId: VItemTypes.Buddy })).toBe(false);
    expect(hookResult!.isOwned(accessoryWithUuid("card"))).toBe(false);
  });

  it("preserves a failed accessory category while adding successful categories", async () => {
    mockOwnedItems.mockImplementation((_a, _e, _r, _id, type) =>
      Promise.resolve(entitlements(type === VItemTypes.PlayerCard ? ["old-card"] : [])));
    await mount();
    mockOwnedItems.mockImplementation((_a, _e, _r, _id, type) => type === VItemTypes.PlayerCard
      ? Promise.reject(new Error("category unavailable"))
      : Promise.resolve(entitlements(type === VItemTypes.Buddy ? ["new-buddy-level"] : [])));
    await act(async () => { await hookResult!.reload(); });
    expect(hookResult!.isOwned({ ...accessoryWithUuid("old-card"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("buddy-root"), itemTypeId: VItemTypes.Buddy,
      entitlementItemIds: ["new-buddy-level"] })).toBe(true);
    mockOwnedItems.mockRejectedValue(new Error("offline"));
    await act(async () => { await hookResult!.reload(); });
    expect(hookResult!.isOwned({ ...accessoryWithUuid("old-card"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
  });

  it("rejects wrong subjects/types and filters grouped entitlements to the requested category", async () => {
    mockOwnedItems.mockImplementation((_a, _e, _r, _id, type) => {
      if (type === VItemTypes.PlayerCard) return Promise.resolve({ Subject: "b", ...entitlements(["wrong-subject"]) });
      if (type === VItemTypes.Spray) return Promise.resolve({ ItemTypeID: VItemTypes.PlayerTitle, ...entitlements(["wrong-type"]) });
      return Promise.resolve({ Subject: "a", EntitlementsByTypes: [
        { ItemTypeID: VItemTypes.Buddy, Entitlements: [{ ItemID: "buddy-level" }] },
        { ItemTypeID: VItemTypes.PlayerCard, Entitlements: [{ ItemID: "foreign-type-card" }] },
      ] });
    });
    await mount();
    expect(hookResult!.isOwned({ ...accessoryWithUuid("wrong-subject"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("wrong-type"), itemTypeId: VItemTypes.Spray })).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("foreign-type-card"), itemTypeId: VItemTypes.Buddy })).toBe(false);
    expect(hookResult!.isOwned(skinWithIds({ level: "foreign-type-card" }))).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("buddy-level"), itemTypeId: VItemTypes.Buddy })).toBe(true);
  });

  it("rejects generation-retired accessory results without poisoning the next refresh", async () => {
    const pending = deferred<ReturnType<typeof entitlements>>();
    mockOwnedItems.mockReturnValue(pending.promise);
    await mount();
    invalidateSessionOperations();
    await act(async () => { pending.resolve(entitlements(["retired"])); });
    mockOwnedItems.mockResolvedValue(entitlements([]));
    await act(async () => { await hookResult!.reload(); });
    expect(hookResult!.isOwned({ ...accessoryWithUuid("retired"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
  });

  it("latest refresh wins and an older result cannot contaminate subsequent positives", async () => {
    mockOwnedItems.mockResolvedValue(entitlements([]));
    await mount();
    const older = deferred<ReturnType<typeof entitlements>>();
    mockOwnedItems.mockReturnValue(older.promise);
    let olderReload!: Promise<void>;
    act(() => { olderReload = hookResult!.reload(); });
    mockOwnedItems.mockResolvedValue(entitlements(["newer"]));
    await act(async () => { await hookResult!.reload(); });
    await act(async () => { older.resolve(entitlements(["older"])); await olderReload; });
    mockOwnedItems.mockResolvedValue(entitlements([]));
    await act(async () => { await hookResult!.reload(); });
    expect(hookResult!.isOwned({ ...accessoryWithUuid("newer"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("older"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
  });

  it("requests skin inventory with the active account credentials and badges joined skins", async () => {
    mockOwnedItems.mockImplementation((_access, _ent, _region, _id, itemTypeId) =>
      Promise.resolve(
        itemTypeId === VItemTypes.SkinLevel
          ? entitlements(["level-owned"])
          : entitlements(["chroma-owned"])
      )
    );
    await mount();

    expect(mockOwnedItems).toHaveBeenCalledWith("access-a", "ent-a", "ap", "a", VItemTypes.SkinLevel);
    expect(mockOwnedItems).toHaveBeenCalledWith("access-a", "ent-a", "ap", "a", VItemTypes.SkinChroma);

    expect(hookResult!.isOwned(skinWithIds({ level: "level-owned" }))).toBe(true);
    expect(hookResult!.isOwned(skinWithIds({ chroma: "chroma-owned" }))).toBe(true);
    expect(hookResult!.isOwned(skinWithIds({ root: "skin-root" }))).toBe(false);
    // Accessories never receive a badge, even on a UUID collision.
    expect(hookResult!.isOwned(accessoryWithUuid("level-owned"))).toBe(false);
  });

  it("seeds owned IDs from the user store and the same-key profile cache before the response lands", async () => {
    mockUserState.user = { ...accountA, ownedSkinIds: ["seed-root"] };
    mockCacheByAuth["ap|a"] = { ownedSkinItemIds: ["seed-level"] };
    mockCacheByAuth["eu|z"] = { ownedSkinItemIds: ["foreign-id"] };
    const pending = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(pending.promise);

    await mount();
    expect(hookResult!.isOwned(skinWithIds({ root: "seed-root" }))).toBe(true);
    expect(hookResult!.isOwned(skinWithIds({ level: "seed-level" }))).toBe(true);
    // IDs from another account's cache must never leak into this account.
    expect(hookResult!.isOwned(skinWithIds({ chroma: "foreign-id" }))).toBe(false);

    await act(async () => {
      pending.resolve(entitlements(["fetched-level"]));
    });
    expect(hookResult!.isOwned(skinWithIds({ level: "fetched-level" }))).toBe(true);
    // Seed vẫn được giữ sau khi fetch thành công (union, không thay thế).
    expect(hookResult!.isOwned(skinWithIds({ root: "seed-root" }))).toBe(true);
  });

  it("keeps current positives when a refresh fails", async () => {
    mockOwnedItems.mockResolvedValue(entitlements(["level-owned"]));
    await mount();
    expect(hookResult!.isOwned(skinWithIds({ level: "level-owned" }))).toBe(true);

    // Toàn bộ request thất bại → state cũ được giữ nguyên.
    mockOwnedItems.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await hookResult!.reload();
    });
    expect(hookResult!.isOwned(skinWithIds({ level: "level-owned" }))).toBe(true);
  });

  it("keeps positives of the successful type when only one ownership request fails", async () => {
    mockOwnedItems.mockResolvedValue(entitlements(["level-owned"]));
    await mount();

    mockOwnedItems.mockImplementation((_access, _ent, _region, _id, itemTypeId) =>
      itemTypeId === VItemTypes.SkinLevel
        ? Promise.reject(new Error("level endpoint down"))
        : Promise.resolve(entitlements(["chroma-owned"]))
    );
    await act(async () => {
      await hookResult!.reload();
    });

    // Chroma mới fetch được + level từ lần trước vẫn còn.
    expect(hookResult!.isOwned(skinWithIds({ chroma: "chroma-owned" }))).toBe(true);
    expect(hookResult!.isOwned(skinWithIds({ level: "level-owned" }))).toBe(true);
  });

  it("hides the previous account immediately and rejects its late completion", async () => {
    mockUserState.user = accountA;
    mockCacheByAuth["ap|a"] = { ownedSkinItemIds: ["seed-a"] };
    const requestA = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(requestA.promise);
    await mount();

    // Session B phải có request riêng để completion của A không thể vòng về.
    const requestB = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(requestB.promise);
    mockUserState.user = accountB;
    await rerender();
    // Trước khi request của B trả về, dữ liệu của A phải biến mất ngay.
    expect(hookResult!.isOwned(skinWithIds({ level: "seed-a" }))).toBe(false);

    await act(async () => {
      requestA.resolve(entitlements(["level-from-a"]));
    });
    // Completion của A bị bác bỏ.
    expect(hookResult!.isOwned(skinWithIds({ level: "level-from-a" }))).toBe(false);
    expect(hookResult!.isOwned(skinWithIds({ level: "seed-a" }))).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("level-from-a"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);

    // Session B đã tự reload sau rerender; hoàn tất request của B.
    await act(async () => {
      requestB.resolve(entitlements(["level-from-b"]));
    });
    expect(hookResult!.isOwned(skinWithIds({ level: "level-from-b" }))).toBe(true);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("level-from-b"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
    expect(mockOwnedItems).toHaveBeenLastCalledWith("access-b", "ent-b", "ap", "b", expect.any(String));
  });

  it("rejects a completion that arrives after a token refresh", async () => {
    const oldRequest = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(oldRequest.promise);
    await mount();

    // Session token mới có request riêng; completion của token cũ phải bị bỏ.
    const nextRequest = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(nextRequest.promise);
    mockUserState.user = { ...accountA, accessToken: "access-a-2", entitlementsToken: "ent-a-2" };
    await rerender();
    await act(async () => {
      oldRequest.resolve(entitlements(["level-stale"]));
    });
    expect(hookResult!.isOwned(skinWithIds({ level: "level-stale" }))).toBe(false);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("level-stale"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
    await act(async () => { nextRequest.resolve(entitlements(["current-level"])); });
    expect(hookResult!.isOwned({ ...accessoryWithUuid("current-level"), itemTypeId: VItemTypes.PlayerCard })).toBe(true);
    expect(hookResult!.isOwned({ ...accessoryWithUuid("level-stale"), itemTypeId: VItemTypes.PlayerCard })).toBe(false);
  });

  it("discards in-flight completions after unmount", async () => {
    const pending = deferred<{ Entitlements: { ItemID: string }[] }>();
    mockOwnedItems.mockReturnValue(pending.promise);
    await mount();
    act(() => {
      renderer!.unmount();
    });
    renderer = undefined;

    await act(async () => {
      pending.resolve(entitlements(["level-late"]));
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("reload issues a fresh ownership request for the current session", async () => {
    mockOwnedItems.mockResolvedValue(entitlements(["level-owned"]));
    await mount();
    expect(mockOwnedItems).toHaveBeenCalledTimes(7);

    await act(async () => {
      await hookResult!.reload();
    });
    expect(mockOwnedItems).toHaveBeenCalledTimes(14);
    expect(hookResult!.isOwned(skinWithIds({ level: "level-owned" }))).toBe(true);
  });

  it("avoids any request when credentials are missing", async () => {
    mockUserState.user = defaultUser;
    await mount();
    expect(mockOwnedItems).not.toHaveBeenCalled();
    expect(hookResult!.isOwned(skinWithIds({ root: "skin-root" }))).toBe(false);

    await act(async () => {
      await hookResult!.reload();
    });
    expect(mockOwnedItems).not.toHaveBeenCalled();
  });
});
