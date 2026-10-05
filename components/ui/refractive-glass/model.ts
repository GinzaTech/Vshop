export const GLASS_VISIBLE_LIMIT = 32;
export const GLASS_CLIP_LIMIT = 6;
export const GLASS_ROUNDED_LIMIT = 3;
export const GLASS_REGISTRATION_LIMIT = 256;
export type GlassRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type GlassMeasured = Readonly<{ pageX: number; pageY: number; width: number; height: number }>;
export type GlassProjectedCard = Readonly<{ id: string; rect: GlassRect; clip: GlassRect; roundedClip: GlassRect; clipRadius: number;
  roundedMasks: readonly Readonly<{ rect: GlassRect; radius: number }>[] }>;
function valid(measure: GlassMeasured | null): measure is GlassMeasured {
  "worklet";
  return Boolean(measure && [measure.pageX, measure.pageY, measure.width, measure.height].every(Number.isFinite)
    && measure.width > 0 && measure.height > 0);
}
function intersect(a: GlassRect, b: GlassRect): GlassRect {
  "worklet";
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}
export function projectGlassCard(id: string, card: GlassMeasured | null, viewport: GlassMeasured | null,
  clips: readonly Readonly<{ measure: GlassMeasured | null; radius: number; height?: number }>[]): GlassProjectedCard | null {
  "worklet";
  if (!valid(card) || !valid(viewport) || clips.length > GLASS_CLIP_LIMIT) return null;
  const rect = { x: card.pageX - viewport.pageX, y: card.pageY - viewport.pageY, width: card.width, height: card.height };
  let clip: GlassRect = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  let roundedClip: GlassRect = { x: 0, y: 0, width: 0, height: 0 }, clipRadius = 0;
  const roundedMasks: { rect: GlassRect; radius: number }[] = [];
  for (const boundary of clips) {
    if (!valid(boundary.measure) || !Number.isFinite(boundary.radius) || boundary.radius < 0) return null;
    const height = boundary.height ?? boundary.measure.height;
    if (!Number.isFinite(height) || height <= 0) return null;
    const box = { x: boundary.measure.pageX - viewport.pageX, y: boundary.measure.pageY - viewport.pageY,
      width: boundary.measure.width, height };
    clip = intersect(clip, box);
    if (clip.width <= 0 || clip.height <= 0) return null;
    if (boundary.radius > 0) {
      if (roundedMasks.length >= GLASS_ROUNDED_LIMIT) return null;
      roundedClip = box; clipRadius = boundary.radius;
      roundedMasks.push({ rect: box, radius: boundary.radius });
    }
  }
  return { id, rect, clip, roundedClip, clipRadius, roundedMasks };
}
export function packGlassProjection(width: number, height: number, cards: readonly GlassProjectedCard[]) {
  "worklet";
  const sized = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const visible = sized ? cards.filter(card => {
    const box = intersect(card.rect, card.clip);
    return box.width > 0 && box.height > 0;
  }).sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height).slice(0, GLASS_VISIBLE_LIMIT) : [];
  const vector = (name: "rect" | "clip" | "roundedClip") => Array.from({ length: GLASS_VISIBLE_LIMIT }, (_, index) => {
    const box = visible[index]?.[name];
    return box ? [box.x, box.y, box.width, box.height] : [0, 0, 0, 0];
  }).flat();
  const masks = Array.from({ length: GLASS_VISIBLE_LIMIT * GLASS_ROUNDED_LIMIT }, (_, index) =>
    visible[Math.floor(index / GLASS_ROUNDED_LIMIT)]?.roundedMasks[index % GLASS_ROUNDED_LIMIT]);
  return { cards: vector("rect"), clips: vector("clip"), roundedClips: masks.flatMap(mask =>
    mask ? [mask.rect.x, mask.rect.y, mask.rect.width, mask.rect.height] : [0, 0, 0, 0]),
    clipRadii: Array.from({ length: GLASS_VISIBLE_LIMIT }, (_, index) => [
      visible[index]?.roundedMasks[0]?.radius ?? 0, visible[index]?.roundedMasks[1]?.radius ?? 0,
      visible[index]?.roundedMasks[2]?.radius ?? 0, 0,
    ]).flat(),
    cardCount: visible.length, visibleIds: visible.map(card => card.id) };
}
