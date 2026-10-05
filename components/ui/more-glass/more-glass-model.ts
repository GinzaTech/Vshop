import type { LayoutRectangle } from "react-native";
import { MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";

export const MORE_GLASS_CARD_COUNT = 10;
export type MoreGlassRects = readonly (LayoutRectangle | null)[];
function validRect(rect: LayoutRectangle) {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0;
}
export function updateMoreGlassRect(rects: MoreGlassRects, index: number, layout: LayoutRectangle): MoreGlassRects {
  if (!Number.isInteger(index) || index < 0 || index >= MORE_GLASS_CARD_COUNT || !validRect(layout)) return rects;
  const existing = rects[index];
  if (existing && (Object.keys(layout) as (keyof LayoutRectangle)[])
    .every((key) => Math.abs(existing[key] - layout[key]) < 0.5)) return rects;
  return Array.from({ length: MORE_GLASS_CARD_COUNT }, (_, slot) => slot === index
    ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height }
    : rects[slot] ?? null);
}
const rgb = (color: string) => [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
export function buildMoreGlassUniforms(width: number, height: number, rects: MoreGlassRects) {
  const sized = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const inBounds = (rect: LayoutRectangle | null | undefined) => Boolean(sized && rect && validRect(rect)
    && rect.x + rect.width <= width + 0.5 && rect.y + rect.height <= height + 0.5);
  const cards = Array.from({ length: MORE_GLASS_CARD_COUNT }, (_, index) => {
    const rect = rects[index];
    return rect && inBounds(rect) ? [rect.x, rect.y, rect.width, rect.height] : [0, 0, 0, 0];
  }).flat();
  return {
    resolution: [sized ? width : 1, sized ? height : 1], cards,
    baseColor: rgb(MORE_GLASS_MATERIAL.background), silverColor: rgb(MORE_GLASS_MATERIAL.silver),
    cornerRadius: MORE_GLASS_MATERIAL.radius, whiteVeil: MORE_GLASS_MATERIAL.whiteVeil,
    refraction: MORE_GLASS_MATERIAL.refraction, bevelWidth: MORE_GLASS_MATERIAL.bevelWidth,
    zoom: MORE_GLASS_MATERIAL.magnification,
    ready: sized && rects.length === MORE_GLASS_CARD_COUNT
      && Array.from({ length: MORE_GLASS_CARD_COUNT }, (_, index) => inBounds(rects[index])).every(Boolean),
  };
}
