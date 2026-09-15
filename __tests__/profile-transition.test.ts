import { getProfileHeaderGeometry } from "~/features/profile/profile-transition";

describe("profile mode transition geometry", () => {
  it("moves the body with the same progress used to shrink the hero", () => {
    expect(
      getProfileHeaderGeometry({
        collapseOffset: 0,
        expandedCollapseDistance: 360,
        expandedHeroHeight: 300,
        compactHeroHeight: 116,
        modeProgress: 0.5,
      })
    ).toEqual({ collapseDistance: 268, collapseOffset: 0 });
  });

  it("reverses to the exact expanded geometry and clamps stale collapse", () => {
    expect(
      getProfileHeaderGeometry({
        collapseOffset: 260,
        expandedCollapseDistance: 360,
        expandedHeroHeight: 300,
        compactHeroHeight: 116,
        modeProgress: 1,
      })
    ).toEqual({ collapseDistance: 176, collapseOffset: 176 });

    expect(
      getProfileHeaderGeometry({
        collapseOffset: 0,
        expandedCollapseDistance: 360,
        expandedHeroHeight: 300,
        compactHeroHeight: 116,
        modeProgress: 0,
      })
    ).toEqual({ collapseDistance: 360, collapseOffset: 0 });
  });
});
