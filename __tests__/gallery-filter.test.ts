import {
  getGalleryWishlistId,
  matchesGalleryQuery,
  normalizeGalleryQuery,
  type GalleryFilterSkin,
} from "~/utils/gallery-filter";

const makeSkin = (
  displayName: string,
  levels: GalleryItem["levels"] = [],
): GalleryFilterSkin =>
  ({
    displayName,
    levels,
  });

describe("gallery filtering", () => {
  it("treats regex metacharacters as plain search text", () => {
    const query = normalizeGalleryQuery(" [Prime] ");

    expect(matchesGalleryQuery(makeSkin("Vandal [Prime]"), query)).toBe(true);
    expect(matchesGalleryQuery(makeSkin("Prime Vandal"), query)).toBe(false);
  });

  it("does not assume every skin has a level", () => {
    expect(getGalleryWishlistId(makeSkin("Level-less skin"))).toBeNull();
  });

  it("returns the first level id used by the wishlist", () => {
    const skin = makeSkin("Prime Vandal", [
      { uuid: "level-id" } as GalleryItem["levels"][number],
    ]);

    expect(getGalleryWishlistId(skin)).toBe("level-id");
  });
});
