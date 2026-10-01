import { getGlassNavigationMetrics, getLensLeft, getNavigationContentMetrics, getNavigationTravelDuration, retargetSceneWeights } from "~/features/navigation/navigation-model";

jest.mock("react-native-reanimated", () => ({
  Easing: { cubic: () => 0, out: (value: unknown) => value, inOut: (value: unknown) => value, bezier: () => () => 0 },
  ReduceMotion: { System: "system" },
}));

describe("liquid navigation geometry and interruption", () => {
  it("preserves default text geometry and aligns the traveling glyph with enlarged labels", () => {
    expect(getNavigationContentMetrics(1)).toEqual({ labelHeight: 13, glyphTop: 6 });
    expect(getNavigationContentMetrics(1.2)).toEqual({ labelHeight: 16, glyphTop: 4.5 });
    expect(getNavigationContentMetrics(1.5)).toEqual({ labelHeight: 17, glyphTop: 4 });
    expect(getNavigationContentMetrics(3)).toEqual(getNavigationContentMetrics(1.5));
    expect(getNavigationContentMetrics(0.85)).toEqual({ labelHeight: 12, glyphTop: 6.5 });
  });
  it.each([undefined, NaN, Infinity, -1, 0])("uses default geometry for invalid or missing font scale %s", (fontScale) => {
    expect(getNavigationContentMetrics(fontScale)).toEqual({ labelHeight: 13, glyphTop: 6 });
  });
  it("uses five equal slots and a clamped lens on phone/tablet", () => {
    const phone = getGlassNavigationMetrics(360, 0);
    expect(phone).toMatchObject({ width: 332, bottom: 14, height: 54 });
    expect(phone.slotWidth).toBeCloseTo((332 - 6) / 5);
    expect(phone.lensWidth).toBeCloseTo(phone.slotWidth * 1.26);
    expect(getGlassNavigationMetrics(320, 24).lensWidth).toBe(76);
    expect(getGlassNavigationMetrics(1000, 34)).toMatchObject({ width: 420, bottom: 38, lensWidth: 90 });
  });
  it("centers the initial deep link without assuming the first route", () => {
    const metrics = getGlassNavigationMetrics(360, 0);
    expect(getLensLeft(2, metrics.slotWidth, metrics.lensWidth)).toBeCloseTo(163 - metrics.lensWidth / 2);
  });
  it("bounds travel without queueing duration by distance", () => {
    expect(getNavigationTravelDuration(0, 1)).toBe(310);
    expect(getNavigationTravelDuration(0, 4)).toBe(385);
    expect(getNavigationTravelDuration(4, 0)).toBe(385);
  });
  it("retargets a partially visible stack from its current weights without a blank frame", () => {
    const current = [0.35, 0.65, 0, 0, 0];
    expect(retargetSceneWeights(current, 4, 0)).toEqual(current);
    expect(retargetSceneWeights(current, 4, 0.5)).toEqual([0.175, 0.325, 0, 0, 0.5]);
    expect(retargetSceneWeights(current, 4, 1)).toEqual([0, 0, 0, 0, 1]);
    expect(current).toEqual([0.35, 0.65, 0, 0, 0]);
  });
});
