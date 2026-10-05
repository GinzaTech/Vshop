import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image as ExpoImage } from "expo-image";
import { buildImageCacheKey } from "~/utils/image-cache";
import { runWhenIdle } from "~/utils/idle-task";
import { useProfileCollectionImageDelivery } from "~/features/profile/useProfileCollectionImageDelivery";
import type { useProfileCollection } from "~/features/profile/useProfileCollection";
import type { OwnedWeaponCollectionItem } from "~/components/GalleryProfile";
import type { TFunction } from "i18next";

jest.mock("expo-image", () => ({ Image: { prefetch: jest.fn(), getCachePathAsync: jest.fn(), writeToCacheAsync: jest.fn() } }));
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: jest.fn() }));
const pending: { run: () => void; cancel: jest.Mock }[] = [];
const publicUri = (id: number) => `https://media.valorant-api.com/weaponskinchromas/chroma-${id}/displayicon.png`;
const items = (count = 18): OwnedWeaponCollectionItem[] => Array.from({ length: count }, (_, i) => ({
  collectionId: `skin-${i}`, weaponId: `weapon-${i}`, weaponName: "Vandal", category: "Rifles",
  skinId: `skin-${i}`, skinLevelId: `level-${i}`, chromaId: `chroma-${i}`, skinName: `Skin ${i}`, image: publicUri(i),
}));
type Rows = ReturnType<typeof useProfileCollection>["profileListRowsByTab"]["collection"];
const rows = (entries = items()): Rows => [{ key: "row", kind: "collection-row", items: entries }];
const translate = ((key: string) => key) as TFunction;
type Props = Parameters<typeof useProfileCollectionImageDelivery>[0];
let result: ReturnType<typeof useProfileCollectionImageDelivery>;
function Harness(props: Props) {
  const delivery = useProfileCollectionImageDelivery(props);
  React.useLayoutEffect(() => { result = delivery; }, [delivery]);
  return null;
}
let renderer: TestRenderer.ReactTestRenderer;
function mount(overrides: Partial<Props> = {}) {
  const props: Props = { rows: rows(), authKey: "account-a", focused: true, t: translate, ...overrides };
  act(() => { renderer = TestRenderer.create(<Harness {...props} />); });
  return props;
}
async function step() {
  const task = pending.shift();
  if (!task) throw new Error("Expected an idle image task");
  await act(async () => { task.run(); await Promise.resolve(); await Promise.resolve(); });
}
beforeEach(() => {
  pending.splice(0);
  jest.clearAllMocks();
  jest.mocked(runWhenIdle).mockImplementation(run => { const task = { run, cancel: jest.fn() }; pending.push(task); return task; });
  jest.mocked(ExpoImage.prefetch).mockResolvedValue(true);
  jest.mocked(ExpoImage.getCachePathAsync).mockImplementation(async key => key.startsWith("https:") ? "file:///cache/public.png" : null);
  jest.mocked(ExpoImage.writeToCacheAsync).mockResolvedValue(undefined);
});
afterEach(() => { act(() => renderer?.unmount()); });

describe("bounded Profile collection thumbnail delivery", () => {
  it("warms only the first 12 current rows, yields per image, and seeds the exact render cache IDs", async () => {
    const entries = items();
    const snapshot = JSON.stringify(entries);
    mount({ rows: rows(entries) });
    expect(ExpoImage.prefetch).not.toHaveBeenCalled();
    expect(result.size).toBe(12);
    for (let i = 0; i < 12; i += 1) {
      expect(pending).toHaveLength(1);
      await step();
      expect(ExpoImage.prefetch).toHaveBeenNthCalledWith(i + 1, publicUri(i), "memory-disk");
      expect(ExpoImage.writeToCacheAsync).toHaveBeenNthCalledWith(i + 1, "file:///cache/public.png", buildImageCacheKey(`skin-image:chroma-${i}:display`));
    }
    expect(pending).toHaveLength(0);
    expect(JSON.stringify(entries)).toBe(snapshot);
  });

  it("reuses the keyed cache without another prefetch", async () => {
    jest.mocked(ExpoImage.getCachePathAsync).mockResolvedValue("file:///existing.png");
    mount({ rows: rows(items(1)) });
    await step();
    expect(ExpoImage.getCachePathAsync).toHaveBeenCalledWith(buildImageCacheKey("skin-image:chroma-0:display"));
    expect(ExpoImage.prefetch).not.toHaveBeenCalled();
    expect(ExpoImage.writeToCacheAsync).not.toHaveBeenCalled();
  });

  it("encodes the bare Android disk-cache path as a file URI before seeding the managed key", async () => {
    jest.mocked(ExpoImage.getCachePathAsync).mockImplementation(async key => key.startsWith("https:") ? "/data/user/0/cache/public image#1%.png" : null);
    mount({ rows: rows(items(1)) });
    await step();
    expect(ExpoImage.writeToCacheAsync).toHaveBeenCalledWith(
      "file:///data/user/0/cache/public%20image%231%25.png", buildImageCacheKey("skin-image:chroma-0:display"),
    );
  });

  it.each(["blur", "account", "data", "locale", "unmount"] as const)("cancels queued old-source warmup on %s", async change => {
    const props = mount();
    const stale = pending[0];
    if (change === "unmount") act(() => renderer.unmount());
    else act(() => renderer.update(<Harness {...props} {...(change === "blur" ? { focused: false } : change === "account" ? { authKey: "account-b" } : change === "data" ? { rows: rows(items(1)) } : { t: ((key: string) => `vi:${key}`) as TFunction })} />));
    expect(stale.cancel).toHaveBeenCalledTimes(1);
    await act(async () => { stale.run(); await Promise.resolve(); });
    expect(ExpoImage.prefetch).not.toHaveBeenCalled();
    expect(ExpoImage.writeToCacheAsync).not.toHaveBeenCalled();
  });

  it("stops after an in-flight public prefetch resolves when blurred", async () => {
    let finish!: (value: boolean) => void;
    jest.mocked(ExpoImage.prefetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const props = mount();
    await step();
    expect(ExpoImage.prefetch).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<Harness {...props} focused={false} />));
    await act(async () => { finish(true); await Promise.resolve(); });
    expect(ExpoImage.writeToCacheAsync).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
  });

  it("retains priority-set identity across focus and warms only HTTPS public metadata images", async () => {
    const entries = items(4);
    const mixed = [entries[0], entries[0], { ...entries[1], image: "https://riot.example/private.png" }, { ...entries[2], image: "http://media.valorant-api.com/insecure.png" }, { ...entries[3], image: undefined }];
    const props = mount({ rows: rows(mixed) });
    const first = result;
    act(() => renderer.update(<Harness {...props} focused={false} />));
    expect(result).toBe(first);
    act(() => renderer.update(<Harness {...props} focused />));
    pending.splice(0, pending.length - 1);
    await step();
    expect(ExpoImage.prefetch).toHaveBeenCalledTimes(1);
    expect(ExpoImage.prefetch).toHaveBeenCalledWith(publicUri(0), "memory-disk");
    expect(pending).toHaveLength(0);
  });

  it("keeps normal delivery available after warm failures and reports the failure once per bounded run", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.mocked(ExpoImage.prefetch).mockResolvedValue(false);
    mount({ rows: rows(items(2)) });
    await step();
    await step();
    expect(ExpoImage.prefetch).toHaveBeenCalledTimes(2);
    expect(ExpoImage.writeToCacheAsync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(pending).toHaveLength(0);
    warn.mockRestore();
  });
});
