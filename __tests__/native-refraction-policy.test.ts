import { canUseNativeRefraction, validRefractionTarget } from "~/features/navigation/native-refraction-policy";

describe("native backdrop refraction safety policy", () => {
  it("requires the matching Android native renderer", () => {
    expect(canUseNativeRefraction("android", 33, 1)).toBe(true);
    expect(canUseNativeRefraction("android", "35", 1)).toBe(true);
  });
  it.each([
    ["android", 32, 1], ["ios", 35, 1], ["web", 35, 1],
    ["android", NaN, 1], ["android", 35, null], ["android", 35, 2],
  ])("keeps the existing material for %s %s %s", (os, version, api) => {
    expect(canUseNativeRefraction(String(os), version as string | number, api)).toBe(false);
  });
  it.each([null, undefined, -1, 0, NaN, Infinity, 1.2, "12"])("rejects invalid target %s", (tag) => {
    expect(validRefractionTarget(tag)).toBe(false);
  });
  it("accepts a positive native tag", () => expect(validRefractionTarget(17)).toBe(true));
});
