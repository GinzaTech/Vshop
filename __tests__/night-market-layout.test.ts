import { getNightMarketArtHeight, getNightMarketGridLayout } from "~/utils/night-market-layout";

const input = { width: 411, fontScale: 1, viewportHeight: 850, gridTop: 140,
  footerHeight: 48, bottomClearance: 102, itemCount: 6 };

it("budgets two columns and three rows including measured header/footer, gaps and navigation clearance", () => {
  expect(getNightMarketGridLayout(input)).toEqual({ columns: 2, cardWidth: 181, cardHeight: 178 });
  expect(getNightMarketGridLayout({ ...input, gridTop: 170 }).cardHeight).toBe(168);
  expect(getNightMarketGridLayout({ ...input, footerHeight: 78 }).cardHeight).toBe(168);
  expect(getNightMarketGridLayout({ ...input, bottomClearance: 132 }).cardHeight).toBe(168);
});

it.each([320, 411])("large fonts and narrow %sdp use natural height", (width) => {
  expect(getNightMarketGridLayout({ ...input, width, fontScale: 1.3 }).cardHeight).toBeUndefined();
  if (width === 320) expect(getNightMarketGridLayout({ ...input, width }).cardHeight).toBeUndefined();
});

it.each([0, 2, 7])("does not force a six-offer fitting budget onto %s items", (itemCount) => {
  expect(getNightMarketGridLayout({ ...input, itemCount }).cardHeight).toBeUndefined();
});

it("keeps readable narrow/tablet columns and rejects incomplete or insufficient measurements", () => {
  expect(getNightMarketGridLayout({ ...input, width: 280 })).toMatchObject({ columns: 1, cardWidth: 240, cardHeight: undefined });
  expect(getNightMarketGridLayout({ ...input, width: 700 })).toMatchObject({ columns: 3, cardWidth: 214 });
  expect(getNightMarketGridLayout({ ...input, viewportHeight: 480 }).cardHeight).toBeUndefined();
  for (const field of ["viewportHeight", "gridTop", "footerHeight", "fontScale", "bottomClearance"] as const) {
    expect(getNightMarketGridLayout({ ...input, [field]: Number.NaN }).cardHeight).toBeUndefined();
  }
  expect(getNightMarketGridLayout({ ...input, bottomClearance: -1 }).cardHeight).toBeUndefined();
  expect(getNightMarketGridLayout({ ...input, width: Number.NaN })).toMatchObject({ cardWidth: 48, cardHeight: undefined });
});

it("only reduces artwork, caps it at natural height, and permits natural scrolling for long text", () => {
  expect(getNightMarketArtHeight(181, 178, 96)).toBe(80);
  expect(getNightMarketArtHeight(181, 400, 96)).toBe(181 / 1.5);
  expect(getNightMarketArtHeight(181, 178, 140)).toBeUndefined();
  expect(getNightMarketArtHeight(181, undefined, 96)).toBeUndefined();
  expect(getNightMarketArtHeight(181, Number.NaN, 96)).toBeUndefined();
  expect(getNightMarketArtHeight(181, 178, 0)).toBeUndefined();
  expect(getNightMarketArtHeight(181, 178, Number.NaN)).toBeUndefined();
  expect(getNightMarketArtHeight(Number.NaN, 178, 96)).toBeUndefined();
});
