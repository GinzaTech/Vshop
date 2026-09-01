import { getPrimaryTabContentBottomPadding } from "~/constants/Layout";

describe("primary tab content spacing", () => {
  it("keeps content above the floating bar with and without a safe-area inset", () => {
    expect(getPrimaryTabContentBottomPadding(0)).toBe(100);
    expect(getPrimaryTabContentBottomPadding(24)).toBe(116);
  });
});
