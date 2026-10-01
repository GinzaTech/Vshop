import { GLASS_MATERIAL } from "~/constants/DesignSystem";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it("keeps small active and inactive navigation labels readable on the frosted lens", () => {
  const background = luminance("#ebebeb");
  for (const foreground of [GLASS_MATERIAL.active, GLASS_MATERIAL.inactive]) {
    expect(foreground).toMatch(/^#[a-f0-9]{6}$/i);
    expect((background + 0.05) / (luminance(foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
