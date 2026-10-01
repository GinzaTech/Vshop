import {
  BUNDLE_CAROUSEL_CONTENT_PADDING,
  BUNDLE_CAROUSEL_GAP,
  BUNDLE_CARD_GUTTER,
  formatBundleCountdown,
  formatVp,
  getBundleItemMaxPriceTextLength,
  getBundleItemWidth,
  hasBundleDiscount,
} from "~/utils/bundle-display";

describe("formatVp", () => {
  it("groups thousands with dot separators like the Valorant client", () => {
    expect(formatVp(6640)).toBe("6.640");
    expect(formatVp(5310)).toBe("5.310");
    expect(formatVp(2675)).toBe("2.675");
    expect(formatVp(1766)).toBe("1.766");
    expect(formatVp(999)).toBe("999");
    expect(formatVp(1000000)).toBe("1.000.000");
  });

  it("renders zero and clamps negative input to zero", () => {
    expect(formatVp(0)).toBe("0");
    expect(formatVp(-50)).toBe("0");
  });

  it("truncates fractional VP values instead of rounding", () => {
    expect(formatVp(10.9)).toBe("10");
  });
});

describe("formatBundleCountdown", () => {
  const now = 1_782_643_200_000; // mốc cố định, không phụ thuộc Date.now()

  it("renders the full day/hour/minute/second countdown", () => {
    expect(
      formatBundleCountdown(
        now + (((21 * 24 + 6) * 60 + 4) * 60 + 27) * 1000,
        now
      )
    ).toBe("21d 06:04:27");
  });

  it("omits the day segment for sub-day countdowns", () => {
    expect(
      formatBundleCountdown(now + ((6 * 60 + 4) * 60 + 27) * 1000, now)
    ).toBe("06:04:27");
    expect(formatBundleCountdown(now + 27_000, now)).toBe("00:00:27");
  });

  it("reports ended bundles", () => {
    expect(formatBundleCountdown(now - 1, now)).toBe("Ended");
    expect(formatBundleCountdown(now, now)).toBe("Ended");
  });
});

describe("hasBundleDiscount", () => {
  it("only flags a strikethrough price when the base price is strictly higher", () => {
    expect(hasBundleDiscount(6640, 5310)).toBe(true);
    expect(hasBundleDiscount(2675, 1766)).toBe(true);
  });

  it("hides the old price for equal, lower or missing base prices", () => {
    expect(hasBundleDiscount(5310, 5310)).toBe(false);
    expect(hasBundleDiscount(100, 5310)).toBe(false);
    expect(hasBundleDiscount(undefined, 5310)).toBe(false);
  });
});

describe("getBundleItemWidth", () => {
  it("derives compact cells from the card width at the reference portrait sizes", () => {
    // Card = viewport − 40dp gutters; cell ≈ 24% card width, min 72dp.
    expect(getBundleItemWidth(320)).toBe(72);
    expect(getBundleItemWidth(360)).toBe(77);
    expect(getBundleItemWidth(375)).toBe(80);
    expect(getBundleItemWidth(390)).toBe(84);
    expect(getBundleItemWidth(430)).toBe(94);
  });

  it("caps the cell on tablet widths so a next card stays partially visible", () => {
    expect(getBundleItemWidth(768)).toBe(136);
    expect(getBundleItemWidth(1080)).toBe(136);
    expect(getBundleItemWidth(320)).toBeLessThan(getBundleItemWidth(430));
  });

  it.each([360, 375, 390, 430])(
    "exposes three full cells plus part of the next at %ddp viewport",
    (windowWidth) => {
      const cell = getBundleItemWidth(windowWidth);
      const visibleWidth =
        windowWidth -
        BUNDLE_CARD_GUTTER -
        2 * BUNDLE_CAROUSEL_CONTENT_PADDING;
      // Ba cell đầy + gap luôn vừa vùng nhìn thấy…
      expect(3 * cell + 2 * BUNDLE_CAROUSEL_GAP).toBeLessThanOrEqual(visibleWidth);
      // …nhưng cell thứ tư không vừa — tạo hiệu ứng "peek" của tham chiếu.
      expect(4 * cell + 3 * BUNDLE_CAROUSEL_GAP).toBeGreaterThan(visibleWidth);
    }
  );

  it("widens cells for large system font scales without ever shrinking them", () => {
    const base = getBundleItemWidth(390);
    expect(getBundleItemWidth(390, { fontScale: 1.35 })).toBeGreaterThan(base);
    expect(getBundleItemWidth(390, { fontScale: 2 })).toBeGreaterThan(
      getBundleItemWidth(390, { fontScale: 1.35 })
    );
    // Font nhỏ hơn mặc định không được làm hẹp cell.
    expect(getBundleItemWidth(390, { fontScale: 0.85 })).toBe(base);
    // Trần tuyệt đối giữ cell hợp lý ở font scale cực đại.
    expect(getBundleItemWidth(1080, { fontScale: 3 })).toBe(200);
  });

  it("widens cells for long VP values so digits are never squeezed", () => {
    const base = getBundleItemWidth(390);
    expect(getBundleItemWidth(390, { maxPriceLength: 9 })).toBeGreaterThan(base);
    expect(getBundleItemWidth(390, { maxPriceLength: 4 })).toBe(base);
    expect(
      getBundleItemWidth(390, { maxPriceLength: 9, fontScale: 1.3 })
    ).toBeGreaterThan(getBundleItemWidth(390, { maxPriceLength: 9 }));
  });
});

describe("getBundleItemMaxPriceTextLength", () => {
  it("returns zero for an empty bundle", () => {
    expect(getBundleItemMaxPriceTextLength([])).toBe(0);
  });

  it("uses the longest formatted price across items", () => {
    expect(
      getBundleItemMaxPriceTextLength([
        { uuid: "a", displayName: "A", price: 999 },
        { uuid: "b", displayName: "B", price: 17_766, originalPrice: 999_999 },
      ])
    ).toBe("999.999".length);
    expect(
      getBundleItemMaxPriceTextLength([{ uuid: "a", displayName: "A", price: 5_310 }])
    ).toBe("5.310".length);
  });

  it("ignores a missing base price", () => {
    expect(
      getBundleItemMaxPriceTextLength([
        { uuid: "a", displayName: "A", price: 1_766, originalPrice: undefined },
      ])
    ).toBe("1.766".length);
  });
});
