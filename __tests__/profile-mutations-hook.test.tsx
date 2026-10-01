import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useProfileMutations } from "~/features/profile/useProfileMutations";
import { createProfileLoadoutRegistry, profileLoadoutRegistry } from "~/features/profile/profile-loadout-queue-registry";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { invalidateSessionOperations } from "~/utils/session-operations";
import type { EquippedWeapon } from "~/components/GalleryProfile";
import type { OwnedSkinOption } from "~/features/profile/profile-loadout";
import { VItemTypes } from "~/utils/misc";

const mockUser = { id: "self", region: "ap", accessToken: "access", entitlementsToken: "ent" };
let mockLiveUser = mockUser;
const mockWrite = jest.fn();
const mockRead = jest.fn();
const mockSetCache = jest.fn();
jest.mock("~/utils/profile-cache", () => ({ PROFILE_LOADOUT_CACHE_VERSION: 5 }));
jest.mock("~/features/profile/confirm-loadout", () => ({ confirmProfileLoadout: jest.fn() }));
let mockCache: unknown;
jest.mock("~/utils/valorant-api", () => ({ updatePlayerLoadoutV3First: (...args: unknown[]) => mockWrite(...args),
  playerLoadout: (...args: unknown[]) => mockRead(...args) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockLiveUser }) } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ cacheByAuth: { "ap:self": mockCache }, setProfileCache: mockSetCache }) } }));
const initial = (): PlayerLoadoutResponse => ({ Subject: "self", Version: 1, SourceApiVersion: "v3",
  Guns: [{ ID: "gun", SkinID: "old", SkinLevelID: "old-level", ChromaID: "old-chroma", Attachments: ["keep"], CharmID: "buddy" }],
  Sprays: [{ EquipSlotID: "slot", SprayID: "old", SprayLevelID: null }],
  ActiveExpressions: [{ TypeID: VItemTypes.Spray, AssetID: "old" }, { TypeID: VItemTypes.Flex, AssetID: "old-flex" }],
  DynamicOptions: { untouched: true }, Incognito: false, Identity: { PlayerCardID: "card", PlayerTitleID: "title",
    AccountLevel: 3, PreferredLevelBorderID: "border", HideAccountLevel: false } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((res) => { resolve = res; }); return { promise, resolve }; }
const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
describe("Profile mutation integration", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let actions: ReturnType<typeof useProfileMutations>;
  let props: Parameters<typeof useProfileMutations>[0];
  const sync = jest.fn(); const dismiss = jest.fn(); const error = jest.fn();
  function Harness() { actions = useProfileMutations(props); return null; }
  beforeEach(async () => {
    profileLoadoutRegistry.clear(); jest.clearAllMocks(); mockLiveUser = mockUser;
    mockCache = { authKey: "ap:self", loadoutSnapshot: initial(), ownedSkinItemIds: [], ownedSprayItemIds: [],
      ownedFlexItemIds: [], ownedPlayerCardItemIds: [], ownedPlayerTitleItemIds: [], competitiveRank: null, updatedAt: 0 };
    mockWrite.mockImplementation(async (...args: unknown[]) => ({ ...(args[4] as PlayerLoadoutResponse), Version: 7 }));
    mockRead.mockResolvedValue(initial());
    props = { user: mockUser, hasAuth: true, authKey: "ap:self", loadoutSnapshot: initial(), loadoutSnapshotRef: { current: initial() },
      pendingLoadoutRef: { current: null }, loadoutMutationVersionRef: { current: 0 }, syncLoadoutState: sync,
      handleDismissPicker: dismiss, showLoadoutUpdateError: error, setUpdatingLoadout: jest.fn(), setPickerError: jest.fn(),
      setPickerState: jest.fn(), setIdentityPickerQuery: jest.fn(), setPickerLoading: jest.fn(), setActiveWeaponChroma: jest.fn(),
      loadoutDetails: [], buildOwnedSkinOptions: jest.fn(), handleOpenWeaponPicker: jest.fn(), setProfileCache: mockSetCache,
      cachedProfile: mockCache, t: (key: string) => key } as unknown as Parameters<typeof useProfileMutations>[0];
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
  });
  afterEach(() => { act(() => renderer.unmount()); profileLoadoutRegistry.clear(); });
  it("updates and dismisses immediately, permits another identity selection, and serializes full writes", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(pending.promise);
    let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => { first = actions.handleEquipIdentity("player-card", "new-card"); });
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ Identity: expect.objectContaining({ PlayerCardID: "new-card" }) }));
    await act(flush);
    act(() => { second = actions.handleEquipIdentity("player-title", "new-title"); });
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ Identity: expect.objectContaining({ PlayerCardID: "new-card", PlayerTitleID: "new-title" }) }));
    expect(dismiss).toHaveBeenCalledTimes(2); expect(mockWrite).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ ...mockWrite.mock.calls[0][4], Version: 6 }); await first; await second; });
    expect(mockWrite.mock.calls[1][4].Version).toBe(6);
    expect(mockSetCache.mock.calls.every(([cache]) => cache.loadoutSnapshot.Version >= 6)).toBe(true);
  });
  it("leaves authorized writes running after unmount without calling UI setters", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(pending.promise);
    act(() => { void actions.handleEquipIdentity("player-card", "new"); }); await act(flush);
    act(() => { void actions.handleEquipIdentity("player-title", "next"); renderer.unmount(); });
    const count = sync.mock.calls.length;
    pending.resolve({ ...mockWrite.mock.calls[0][4], Version: 6 }); await flush();
    expect(mockWrite).toHaveBeenCalledTimes(2); expect(sync).toHaveBeenCalledTimes(count);
  });
  it("rejects retained callbacks when tokens or generation change", async () => {
    const retained = actions.handleEquipIdentity;
    mockLiveUser = { ...mockUser, accessToken: "different" };
    await act(async () => { await retained("player-card", "new"); });
    expect(mockWrite).not.toHaveBeenCalled(); expect(dismiss).not.toHaveBeenCalled();
    mockLiveUser = mockUser; invalidateSessionOperations();
    await act(async () => { await retained("player-title", "new"); });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  const weapon = { weaponId: "gun", weaponName: "Rifle" } as EquippedWeapon;
  const skin: OwnedSkinOption = { id: "new", name: "New", skinId: "new", skinLevelId: "new-level", chromaId: "new-chroma", chromas: [], selected: false };
  it("rebases weapon/chroma and both expression modes while retaining buddy, attachments, identity and dynamic fields", async () => {
    await act(async () => {
      const skinWrite = actions.handleEquipWeapon(weapon, skin);
      const sprayWrite = actions.handleEquipExpression({ slotIndex: 0, kind: "spray", id: "old", name: "Old" }, { id: "new-spray", kind: "spray", assetId: "new-spray", name: "New", selected: false });
      const flexWrite = actions.handleEquipExpression({ slotIndex: 1, kind: "flex", id: "old-flex", name: "Old" }, { id: "new-flex", kind: "flex", assetId: "new-flex", name: "New", selected: false });
      await Promise.all([skinWrite, sprayWrite, flexWrite]);
    });
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0][4]).toMatchObject({ Guns: [expect.objectContaining({ SkinID: "new", SkinLevelID: "new-level", ChromaID: "new-chroma", CharmID: "buddy", Attachments: ["keep"] })],
      DynamicOptions: { untouched: true }, Identity: initial().Identity,
      ActiveExpressions: [{ TypeID: VItemTypes.Spray, AssetID: "new-spray" }, { TypeID: VItemTypes.Flex, AssetID: "new-flex" }] });
  });
  it("uses the same queue for legacy spray slots and identity", async () => {
    act(() => renderer.unmount()); profileLoadoutRegistry.clear();
    const base = { ...initial(), SourceApiVersion: "v2" as const };
    props = { ...props, loadoutSnapshot: base, loadoutSnapshotRef: { current: base } };
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    await act(async () => {
      await Promise.all([actions.handleEquipSpray({ id: "old", name: "Old", slot: "slot" }, { id: "new", sprayId: "new", sprayLevelId: "level", name: "New", selected: false }),
        actions.handleEquipIdentity("player-title", "next")]);
    });
    expect(mockWrite).toHaveBeenCalledTimes(1); expect(mockWrite.mock.calls[0][4]).toMatchObject({ SourceApiVersion: "v2", Sprays: [{ EquipSlotID: "slot", SprayID: "new", SprayLevelID: "level" }], Identity: { PlayerTitleID: "next" } });
    expect(await actions.handleEquipExpression({ slotIndex: 0, kind: "flex", id: "old", name: "Old" }, { id: "new", kind: "flex", assetId: "new", name: "New", selected: false })).toBe(false);
  });
  it("quick-equips collection choices while saving and opens the picker only for selected or unavailable options", async () => {
    props = { ...props, loadoutDetails: [weapon], buildOwnedSkinOptions: jest.fn(() => [skin]) };
    await act(async () => { renderer.update(<Harness />); });
    await act(async () => { actions.handleEquipCollectionSkin({ weaponId: "gun", skinId: "new" } as Parameters<typeof actions.handleEquipCollectionSkin>[0]); await flush(); });
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(props.handleOpenWeaponPicker).not.toHaveBeenCalled();
    act(() => { actions.handleEquipCollectionSkin({ weaponId: "gun", skinId: "missing" } as Parameters<typeof actions.handleEquipCollectionSkin>[0]); });
    expect(props.handleOpenWeaponPicker).toHaveBeenCalledWith(weapon);
    act(() => { actions.handleEquipCollectionSkin({ weaponId: "missing", skinId: "new" } as Parameters<typeof actions.handleEquipCollectionSkin>[0]); });
    expect(props.handleOpenWeaponPicker).toHaveBeenCalledTimes(1);
  });
  it("rejects unavailable slots and unauthenticated calls without changing display", async () => {
    await act(async () => {
      await actions.handleEquipWeapon({ ...weapon, weaponId: "missing" }, skin);
      await actions.handleEquipSpray({ id: "old", name: "Old", slot: "missing" }, { id: "new", name: "New", sprayId: "new", sprayLevelId: null, selected: false });
      await actions.handleEquipExpression({ slotIndex: 8, kind: "flex", id: "old", name: "Old" }, { id: "new", kind: "flex", assetId: "new", name: "New", selected: false });
    });
    expect(mockWrite).not.toHaveBeenCalled();
    props = { ...props, hasAuth: false }; await act(async () => { renderer.update(<Harness />); });
    await act(async () => { await actions.handleEquipIdentity("player-title", "new"); });
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it("reports a current failed revision and rolls back only it", async () => {
    mockWrite.mockRejectedValueOnce(new Error("timeout"));
    await act(async () => { await actions.handleEquipIdentity("player-card", "new"); });
    expect(error).toHaveBeenCalledTimes(1); expect(sync).toHaveBeenLastCalledWith(initial());
    expect(mockWrite).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
  });
  it("reattaches to the owner after remount and reports only new errors to the new view", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(pending.promise);
    act(() => { void actions.handleEquipIdentity("player-card", "new"); }); await act(flush);
    act(() => renderer.unmount());
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ Identity: expect.objectContaining({ PlayerCardID: "new" }) }));
    await act(async () => { pending.resolve(initial()); await flush(); });
    expect(error).toHaveBeenCalledTimes(1); expect(mockWrite).toHaveBeenCalledTimes(1);
  });
  it("runs an isolated injected QA transport without any Riot HTTP or persistent account cache writes", async () => {
    act(() => renderer.unmount()); profileLoadoutRegistry.clear();
    const registry = createProfileLoadoutRegistry(); let current = true; let generation = 1;
    const write = jest.fn(async (_owner, payload: PlayerLoadoutResponse) => ({ ...payload, Version: 8 }));
    const read = jest.fn(async () => initial()); const confirmed = jest.fn();
    props = { ...props, loadoutRuntime: { registry, getGeneration: () => generation, isCurrent: () => current, write, read, onConfirmed: confirmed } };
    // QA authority is confined to the injected runtime. The real session can remain unrelated.
    mockLiveUser = { ...mockUser, id: "real-other", accessToken: "real-other-token" };
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    await act(async () => { await actions.handleEquipIdentity("player-card", "qa-card"); });
    expect(write).toHaveBeenCalledTimes(1); expect(confirmed).toHaveBeenCalledWith(expect.objectContaining({ Version: 8 }));
    expect(mockWrite).not.toHaveBeenCalled(); expect(mockRead).not.toHaveBeenCalled(); expect(mockSetCache).not.toHaveBeenCalled();
    const retained = actions.handleEquipIdentity; current = false;
    await act(async () => { await retained("player-title", "retired"); }); expect(write).toHaveBeenCalledTimes(1);
    current = true; generation += 1;
    await act(async () => { await retained("player-title", "retired"); }); expect(write).toHaveBeenCalledTimes(1);
    registry.clear();
  });
});
