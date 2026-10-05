import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { CachedImage } from "~/components/CachedImage";
import type { OwnedWeaponCollectionItem } from "~/components/GalleryProfile";
import {
  CollectionCheckerExport,
  CollectionCheckerExportProvider,
  type CollectionCheckerProfile,
} from "~/components/profile/CollectionCheckerExport";

jest.setTimeout(15_000);

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockCapture = jest.fn();
const mockCreateAsset = jest.fn();
const mockToast = jest.fn();

// Exercise the native export implementation, not its web no-op entry point.
jest.mock("~/components/profile/CollectionCheckerExport", () =>
  jest.requireActual("~/components/profile/CollectionCheckerExport.tsx"),
);
jest.mock("expo-media-library", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  Asset: { create: (uri: string) => mockCreateAsset(uri) },
}));
jest.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => mockCapture(...args),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: (options: unknown) => mockToast(options) },
}));
jest.mock("~/components/GalleryProfile", () => ({
  WEAPON_NAME_ORDER: ["Vandal"],
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");

const profile: CollectionCheckerProfile = {
  gameName: "Collection test",
  tagLine: "QA",
  region: "ap",
  level: 10,
  rank: null,
  balances: { vp: 0, rad: 0, kc: 0 },
};
const makeItems = (count: number): OwnedWeaponCollectionItem[] =>
  Array.from({ length: count }, (_, index) => ({
    collectionId: `collection-${index}`,
    weaponId: "vandal",
    weaponName: "Vandal",
    category: "Rifles",
    skinId: `skin-${index}`,
    skinLevelId: `level-${index}`,
    chromaId: `chroma-${index}`,
    skinName: `Test skin ${String(index).padStart(3, "0")}`,
    contentTierUuid: "60bca009-4182-7998-dee7-b8a2558dc369",
    image: `https://example.invalid/skin-${index}.png`,
  }));

describe("collection checker export batching", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let capturedNames: string[][];
  let capturedTargets: unknown[];
  const root = () => {
    if (!renderer) throw new Error("Export provider has not been mounted");
    return renderer.root;
  };
  const button = () => root().findByProps({
    accessibilityRole: "button",
    accessibilityLabel: "Tải ảnh bộ sưu tập skin hiếm trở lên",
  });
  const renderedSkinNames = () => root().findAllByType(Text)
    .map((node) => node.props.children as unknown)
    .filter((value): value is string => typeof value === "string" && value.startsWith("Test skin "));
  const sheets = () => root().findAllByType(View)
    .filter((node) => node.props.collapsable === false && typeof node.props.onLayout === "function");
  const advance = async (ms: number) => {
    await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
  };
  const mount = async (
    items: OwnedWeaponCollectionItem[],
    exportProfile = profile,
    disabled = false,
  ) => {
    await act(async () => {
      renderer = TestRenderer.create(
        <CollectionCheckerExportProvider items={items} profile={exportProfile} disabled={disabled}>
          <CollectionCheckerExport />
        </CollectionCheckerExportProvider>,
      );
    });
  };
  const startExport = async () => {
    await act(async () => { button().props.onPress(); });
  };
  const layoutSheet = async () => {
    await act(async () => { sheets()[0].props.onLayout(); });
  };
  const finishImages = async () => {
    await act(async () => {
      root().findAllByType(CachedImage).forEach((image) => image.props.onLoadEnd());
    });
  };
  const expectIdle = () => {
    expect(button().props.disabled).toBe(false);
    expect(button().props.accessibilityState).toEqual({ disabled: false });
    expect(root().findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(sheets()).toHaveLength(0);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    capturedNames = [];
    capturedTargets = [];
    mockGetPermissions.mockReset().mockResolvedValue({ granted: true });
    mockRequestPermissions.mockReset().mockResolvedValue({ granted: true });
    mockCreateAsset.mockReset().mockResolvedValue({ id: "mock-asset" });
    mockToast.mockReset();
    mockCapture.mockReset().mockImplementation(async (target: { current: unknown }) => {
      capturedNames.push(renderedSkinNames());
      capturedTargets.push(target.current);
      return "file:///mock-collection.jpg";
    });
    jest.spyOn(global, "requestAnimationFrame").mockImplementation((callback) =>
      setTimeout(() => callback(Date.now()), 16) as unknown as number,
    );
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([24, 25, 48, 49, 72])(
    "renders all %i eligible skins before capturing once and clearing busy state",
    async (count) => {
      const items = makeItems(count);
      await mount(items);
      expect(mockCapture).not.toHaveBeenCalled();
      await startExport();
      expect(button().props.disabled).toBe(true);
      expect(root().findAllByType(ActivityIndicator)).toHaveLength(1);
      expect(renderedSkinNames()).toHaveLength(Math.min(count, 24));
      await layoutSheet();
      for (let expected = 48; expected < count + 24; expected += 24) {
        if (expected - 24 >= count) break;
        await advance(15);
        expect(renderedSkinNames()).toHaveLength(Math.min(expected - 24, count));
        expect(mockCapture).not.toHaveBeenCalled();
        await advance(1);
        expect(renderedSkinNames()).toHaveLength(Math.min(expected, count));
      }
      expect(mockCapture).not.toHaveBeenCalled();
      await finishImages();
      await advance(32);
      expect(mockGetPermissions).toHaveBeenCalledWith(true, ["photo"]);
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(capturedTargets).toHaveLength(1);
      expect(capturedTargets[0]).not.toBeNull();
      expect(mockCapture.mock.calls[0][1]).toEqual({ format: "jpg", quality: 0.92, result: "tmpfile" });
      expect(capturedNames).toEqual([items.map((item) => item.skinName)]);
      expect(mockCreateAsset).toHaveBeenCalledTimes(1);
      expect(mockCreateAsset).toHaveBeenCalledWith("file:///mock-collection.jpg");
      expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ type: "success" }));
      expectIdle();
      await advance(5_000);
      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCreateAsset).toHaveBeenCalledTimes(1);
    },
  );

  it("waits for layout and the image timeout after every batch is rendered", async () => {
    await mount(makeItems(49));
    await startExport();
    await advance(16);
    await advance(16);
    expect(renderedSkinNames()).toHaveLength(49);
    await advance(4_000);
    expect(mockCapture).not.toHaveBeenCalled();
    await layoutSheet();
    await advance(32);
    expect(capturedNames[0]).toHaveLength(49);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expectIdle();
  });

  it("deduplicates image readiness and waits for the remaining image", async () => {
    await mount(makeItems(2));
    await startExport();
    await layoutSheet();
    const images = root().findAllByType(CachedImage);
    await act(async () => {
      images[0].props.onLoadEnd();
      images[0].props.onError();
    });
    await advance(32);
    expect(mockCapture).not.toHaveBeenCalled();
    await act(async () => { images[1].props.onError(); });
    await advance(32);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expectIdle();
  });

  it("requests photo permission before export when permission is not granted yet", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    await mount(makeItems(1));
    await startExport();
    expect(mockRequestPermissions).toHaveBeenCalledWith(true, ["photo"]);
    await layoutSheet();
    await finishImages();
    await advance(32);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expectIdle();
  });

  it("clears busy state without capturing or saving when permission is denied", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });
    await mount(makeItems(49));
    await startExport();
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ type: "error" }));
    expectIdle();
  });

  it.each(["capture", "save"])("clears busy state on %s failure and permits a fresh export", async (stage) => {
    if (stage === "capture") mockCapture.mockRejectedValueOnce(new Error("mock capture failed"));
    else mockCreateAsset.mockRejectedValueOnce(new Error("mock save failed"));
    await mount(makeItems(1));
    await startExport();
    await layoutSheet();
    await finishImages();
    await advance(32);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCreateAsset).toHaveBeenCalledTimes(stage === "capture" ? 0 : 1);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ type: "error" }));
    expectIdle();
    await startExport();
    await layoutSheet();
    await finishImages();
    await advance(32);
    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ type: "success" }));
    expectIdle();
  });

  it("cancels pending batches when the provider unmounts", async () => {
    await mount(makeItems(72));
    await startExport();
    await layoutSheet();
    act(() => renderer?.unmount());
    renderer = undefined;
    await advance(5_000);
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it.each([null, 20])("waits for both avatar uses and the rank image (tier %s)", async (currentTier) => {
    await mount(makeItems(1), {
      ...profile,
      avatarUri: "https://example.invalid/avatar.png",
      avatarCacheId: currentTier ? "avatar-cache" : undefined,
      rank: {
        currentTier, currentName: "Diamond", currentIcon: "https://example.invalid/rank.png",
        peakTier: 20, peakName: "Diamond", peakIcon: null,
        actSeasonId: null, actWins: null, actLosses: null, actGames: null,
      },
    });
    await startExport();
    await layoutSheet();
    const images = root().findAllByType(CachedImage);
    expect(images).toHaveLength(4);
    await act(async () => { images.slice(0, 3).forEach((image) => image.props.onLoadEnd()); });
    await advance(32);
    expect(mockCapture).not.toHaveBeenCalled();
    await act(async () => { images[3].props.onLoadEnd(); });
    await advance(32);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expectIdle();
  });

  it("exports only eligible tiers in weapon, rarity and name order without changing the input", async () => {
    const base = makeItems(8);
    const items = [
      { ...base[0], skinName: "Test skin Zebra", image: undefined },
      { ...base[1], skinName: "Test skin Ultra", contentTierUuid: "411e4a55-4e59-7757-41f0-86a53f101bb5", chromaId: "" },
      { ...base[2], skinName: "Test skin Exclusive", contentTierUuid: "e046854e-406c-37f4-6607-19a9ba8426fc", chromaId: "", skinLevelId: "" },
      { ...base[3], skinName: "Test skin Alpha", contentTierUuid: undefined, contentTierName: "Premium" },
      { ...base[4], weaponName: "Guardian", skinName: "Test skin Guardian" },
      { ...base[5], weaponName: "Sheriff", skinName: "Test skin Sheriff" },
      { ...base[6], contentTierUuid: "12683d76-48d7-84a3-4e09-6985794f0445" },
      { ...base[7], contentTierUuid: "unknown-tier" },
    ];
    const original = items.map((item) => ({ ...item }));
    await mount(items, { ...profile, gameName: "", tagLine: undefined, region: "" });
    await startExport();
    await layoutSheet();
    await finishImages();
    await advance(32);
    expect(capturedNames).toEqual([[
      "Test skin Ultra", "Test skin Exclusive", "Test skin Alpha", "Test skin Zebra",
      "Test skin Guardian", "Test skin Sheriff",
    ]]);
    expect(items).toEqual(original);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expectIdle();
  });

  it("keeps a completed 49-card sheet busy through a pending capture and rejects another download", async () => {
    let resolveCapture!: (uri: string) => void;
    mockCapture.mockImplementationOnce(async () => {
      capturedNames.push(renderedSkinNames());
      return new Promise<string>((resolve) => { resolveCapture = resolve; });
    });
    await mount(makeItems(49).map((item) => ({ ...item, image: undefined })));
    await startExport();
    await layoutSheet();
    await advance(16);
    await advance(16);
    await advance(32);
    expect(capturedNames[0]).toHaveLength(49);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(button().props.disabled).toBe(true);
    await startExport();
    await advance(5_000);
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    await act(async () => { resolveCapture("file:///mock-pending.jpg"); });
    expect(mockCreateAsset).toHaveBeenCalledTimes(1);
    expect(mockCreateAsset).toHaveBeenCalledWith("file:///mock-pending.jpg");
    expectIdle();
  });
});
