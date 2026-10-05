import { getProfilePickerGeometry } from "~/features/profile/profile-picker-geometry";

describe("Profile picker geometry only", () => {
  it.each([[374, 1, 3], [373, 1, 2], [390, 1.29, 3], [390, 1.3, 2], [320, 2, 2]])(
    "uses width %i / font scale %s for %i columns without shrinking native fonts", (width, fontScale, columns) => {
      const layout = getProfilePickerGeometry({ width, height: 844, fontScale });
      expect(layout.columns).toBe(columns);
      expect(layout.cardWidth * columns + 8 * (columns - 1)).toBeCloseTo(width - 64);
      expect(layout.cardWidth).toBeGreaterThanOrEqual(48);
      expect(layout.viewportHeight).toBe(692);
      expect(layout.artHeight).toBe(columns === 3 ? 62 : 72);
    },
  );

  it("keeps a positive scene bound and minimum touch width with tiny window dimensions", () => {
    const layout = getProfilePickerGeometry({ width: 100, height: 0, fontScale: 1 });
    expect(layout.viewportHeight).toBe(1);
    expect(layout.cardWidth).toBe(48);
  });

  it("targets 45–60% normal-phone weapon card area while preserving native font sizes", () => {
    const layout = getProfilePickerGeometry({ width: 390, height: 844, fontScale: 1 });
    // Representative two-line name, one chroma-hint row, two tier/level rows,
    // and a selected label. Native device layout remains separate evidence.
    const baselineWidth = (390 - 64) * 0.48;
    const baselineHeight = 24 + 104 + 10 + 34 + 18 + 10 + 60 + 24;
    const compactHeight = 16 + layout.artHeight + 4 + 34 + 22 + 4 + 52 + 24;
    const ratio = layout.cardWidth * compactHeight / (baselineWidth * baselineHeight);
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.60);
  });

  it.each([[390, 1, 3, 62], [360, 1, 2, 72], [390, 1.4, 2, 72]])(
    "grows spray/expression body area and art 20%% at width %i / font scale %s while keeping %i columns",
    (width, fontScale, columns, baselineArtHeight) => {
      const viewport = { width, height: 844, fontScale };
      const baseline = getProfilePickerGeometry(viewport);
      expect(baseline).toMatchObject({ columns, artHeight: baselineArtHeight, optionMinHeight: 48, optionPaddingVertical: 8 });
      for (const kind of ["spray", "expression"] as const) {
        const enlarged = getProfilePickerGeometry(viewport, kind);
        expect(enlarged.columns).toBe(baseline.columns);
        expect(enlarged.cardWidth).toBe(baseline.cardWidth);
        expect(enlarged.viewportHeight).toBe(baseline.viewportHeight);
        expect(enlarged.artHeight).toBeCloseTo(baselineArtHeight * 1.2);
        expect(enlarged.optionMinHeight).toBeCloseTo(48 * 1.2);
        // Fixed two-line native name (34), visual gap (4), and borders (2).
        const bodyHeight = 2 * baseline.optionPaddingVertical + baseline.artHeight + 34 + 4 + 2;
        const enlargedBodyHeight = 2 * enlarged.optionPaddingVertical + enlarged.artHeight + 34 + 4 + 2;
        expect(enlarged.cardWidth * enlargedBodyHeight / (baseline.cardWidth * bodyHeight)).toBeCloseTo(1.2);
      }
    },
  );

  it.each(["weapon", "player-card", "player-title"] as const)("keeps the exact compact baseline for %s", (kind) => {
    const viewport = { width: 390, height: 844, fontScale: 1 };
    expect(getProfilePickerGeometry(viewport, kind)).toEqual(getProfilePickerGeometry(viewport));
  });
});
