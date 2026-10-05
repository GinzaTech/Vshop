import type { LayoutRectangle } from "react-native";
import type { MoreGlassRects } from "./more-glass-model";
import { MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";

export const MORE_GLASS_SCENE_CARD_COUNT = 14;
export type MoreGlassPoint = Readonly<{ x: number; y: number }>;
function valid(layout: LayoutRectangle | null | undefined): layout is LayoutRectangle {
  "worklet";
  return Boolean(layout && [layout.x, layout.y, layout.width, layout.height].every(Number.isFinite)
    && layout.x >= 0 && layout.y >= 0 && layout.width > 0 && layout.height > 0);
}
export function updateMoreGlassSceneRect(rects: MoreGlassRects, index: number, layout: LayoutRectangle): MoreGlassRects {
  if (!Number.isInteger(index) || index < 0 || index >= MORE_GLASS_SCENE_CARD_COUNT || !valid(layout)) return rects;
  const old = rects[index];
  if (old && ["x", "y", "width", "height"].every((name) => {
    const key = name as keyof LayoutRectangle;
    return Math.abs(old[key] - layout[key]) < 0.5;
  })) return rects;
  return Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, (_, slot) => slot === index ? { ...layout } : rects[slot] ?? null);
}
export function composeMoreGlassSceneRects(rects: MoreGlassRects, gridOffset: MoreGlassPoint | null): MoreGlassRects {
  const offsetReady = gridOffset && Number.isFinite(gridOffset.x) && Number.isFinite(gridOffset.y)
    && gridOffset.x >= 0 && gridOffset.y >= 0;
  return Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, (_, index) => {
    const rect = rects[index];
    if (!rect || !valid(rect)) return null;
    if (index >= 10) return rect;
    return offsetReady ? { ...rect, x: rect.x + gridOffset.x, y: rect.y + gridOffset.y } : null;
  });
}
const silverColor = [1, 3, 5].map((offset) => parseInt(MORE_GLASS_MATERIAL.silver.slice(offset, offset + 2), 16) / 255);
const pageColor = [1, 3, 5].map((offset) => parseInt(MORE_GLASS_MATERIAL.background.slice(offset, offset + 2), 16) / 255);
export function buildMoreGlassSceneUniforms(width: number, height: number, rects: MoreGlassRects, scrollY = 0) {
  "worklet";
  const sized = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const scrollReady = Number.isFinite(scrollY);
  const validSlot = (index: number) => valid(rects[index]) && rects[index]!.x + rects[index]!.width <= width + 0.5;
  return {
    resolution: [sized ? width : 1, sized ? height : 1],
    cards: Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, (_, index) => {
      const rect = rects[index];
      return rect && validSlot(index) && sized && scrollReady
        ? [rect.x, rect.y - scrollY, rect.width, rect.height] : [0, 0, 0, 0];
    }).flat(),
    cornerRadius: MORE_GLASS_MATERIAL.radius, refraction: MORE_GLASS_MATERIAL.refraction,
    bevelWidth: MORE_GLASS_MATERIAL.bevelWidth, zoom: MORE_GLASS_MATERIAL.magnification,
    whiteVeil: MORE_GLASS_MATERIAL.whiteVeil, wallpaperStrength: MORE_GLASS_MATERIAL.wallpaperStrength,
    silverColor, pageColor,
    ready: Boolean(sized && scrollReady && rects.length === MORE_GLASS_SCENE_CARD_COUNT
      && Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, (_, index) => validSlot(index)).every(Boolean)),
  };
}
