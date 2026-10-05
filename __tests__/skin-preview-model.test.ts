import { buildSkinPreviewMedia, type SkinPreviewSource } from "~/utils/skin-preview";

const skin: SkinPreviewSource = {
  uuid: "skin", displayName: "CYRAX Stinger", contentTierUuid: "tier", displayIcon: "https://example.com/base.png",
  levels: [{ uuid: "one", displayName: "Level 1", assetPath: "", streamedVideo: "https://example.com/level-video" }],
  chromas: [{ uuid: "blue", displayName: "Blue", assetPath: "", fullRender: "https://example.com/blue.png", swatch: "https://example.com/swatch.png", streamedVideo: "https://example.com/blue-video" }],
};
it("retains still art and optional video together, including real chroma swatches and rarity", () => {
  const entries = buildSkinPreviewMedia(skin);
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ group: "level", imageUri: skin.displayIcon, imageCacheId: "skin:skin:display", videoUri: skin.levels![0].streamedVideo, contentTierUuid: "tier" });
  expect(entries[1]).toMatchObject({ group: "chroma", imageUri: skin.chromas![0].fullRender, swatchUri: skin.chromas![0].swatch, videoUri: skin.chromas![0].streamedVideo });
  expect(entries.map(entry => entry.uri)).toEqual([skin.levels![0].streamedVideo, skin.chromas![0].streamedVideo]);
});
it("keeps image-only entries honest and never mutates caller metadata", () => {
  const input = { ...skin, levels: [{ uuid: "still", displayName: "Still", assetPath: "", displayIcon: "https://example.com/still.png" }], chromas: [] };
  const original = JSON.stringify(input);
  Object.freeze(input.levels[0]); Object.freeze(input.levels); Object.freeze(input);
  expect(buildSkinPreviewMedia(input)[0]).toMatchObject({ kind: "image", imageUri: input.levels[0].displayIcon });
  expect(buildSkinPreviewMedia(input)[0].videoUri).toBeUndefined();
  expect(JSON.stringify(input)).toBe(original);
});
it("does not invent playable media or variants for unavailable items", () => {
  expect(buildSkinPreviewMedia({ uuid: "empty", displayName: "Empty", levels: [], chromas: [] })).toEqual([]);
});
it("uses real chroma art for a level whose base and level icons are unavailable", () => {
  const partial = { ...skin, displayIcon: undefined, chromas: [{ ...skin.chromas![0], displayIcon: undefined }] };
  expect(buildSkinPreviewMedia(partial)[0].imageUri).toBe(skin.chromas![0].fullRender);
});
