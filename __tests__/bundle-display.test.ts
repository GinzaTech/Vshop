import {
  formatBundleCountdown,
  formatVp,
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
  it("clamps the item cell to the compact range on small screens", () => {
    expect(getBundleItemWidth(320)).toBe(118);
    expect(getBundleItemWidth(375)).toBe(128);
  });

  it("caps the item cell on tablet widths so a next card stays partially visible", () => {
    expect(getBundleItemWidth(768)).toBeLessThanOrEqual(164);
    expect(getBundleItemWidth(1080)).toBe(164);
    // Thẻ bundle full-width trên phone nhỏ (320 - 2*20 padding) là 280;
    // cell 118 + gap luôn hẹp hơn để lộ một phần card kế tiếp.
    expect(getBundleItemWidth(320)).toBeLessThan(280);
    expect(getBundleItemWidth(320) * 2).toBeLessThan(280);
  });
});
