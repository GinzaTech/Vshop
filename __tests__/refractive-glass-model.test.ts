import { GLASS_VISIBLE_LIMIT, packGlassProjection, projectGlassCard, type GlassProjectedCard } from "~/components/ui/refractive-glass/model";

const viewport = { pageX: 30, pageY: 100, width: 360, height: 640 };
const card = { pageX: 50, pageY: 160, width: 120, height: 90 };
describe("More-standard shared glass projection", () => {
  it("projects live UI measurements into the viewport, including nested scroll positions", () => {
    expect(projectGlassCard("skin", card, viewport, [])).toMatchObject({ id: "skin", rect: { x: 20, y: 60, width: 120, height: 90 } });
    expect(projectGlassCard("skin", { ...card, pageX: 10, pageY: 80 }, viewport, [])).toMatchObject({ rect: { x: -20, y: -20, width: 120, height: 90 }, clip: { x: 0, y: 0, width: 360, height: 640 } });
  });
  it("clips carousel materials and respects an animated disclosure height", () => {
    const clip = { measure: { pageX: 45, pageY: 150, width: 200, height: 180 }, radius: 0, height: 40 };
    expect(projectGlassCard("skin", card, viewport, [clip])).toMatchObject({ clip: { x: 15, y: 50, width: 200, height: 40 } });
    expect(projectGlassCard("skin", card, viewport, [{ ...clip, height: 0 }])).toBeNull();
  });
  it("retains rounded parent boundaries separately from the viewport intersection", () => {
    const clip = { measure: { pageX: 40, pageY: 120, width: 240, height: 190 }, radius: 24 };
    expect(projectGlassCard("skin", card, viewport, [clip])).toMatchObject({ roundedClip: { x: 10, y: 20, width: 240, height: 190 }, clipRadius: 24 });
  });
  it.each([null, { ...card, width: 0 }, { ...card, height: -1 }, { ...card, pageX: NaN }, { ...card, pageY: Infinity }])("fails closed for invalid measurements %j", measure => {
    expect(projectGlassCard("bad", measure, viewport, [])).toBeNull();
  });
  it("fails closed on an unmeasured clip or an invalid viewport", () => {
    expect(projectGlassCard("bad", card, viewport, [{ measure: null, radius: 0 }])).toBeNull();
    expect(projectGlassCard("bad", card, { ...viewport, width: 0 }, [])).toBeNull();
  });
  it("culls offscreen materials, packs dense uniforms and prioritizes nested leaves", () => {
    const outer = projectGlassCard("outer", { ...card, width: 240, height: 190 }, viewport, [])!;
    const inner = projectGlassCard("inner", card, viewport, [])!;
    const offscreen = projectGlassCard("offscreen", { ...card, pageY: 1000 }, viewport, [])!;
    const projection = packGlassProjection(360, 640, [outer, offscreen, inner]);
    expect(projection.visibleIds).toEqual(["inner", "outer"]);
    expect(projection.cardCount).toBe(2);
    expect(projection.cards).toHaveLength(GLASS_VISIBLE_LIMIT * 4);
    expect(projection.cards.slice(0, 4)).toEqual([20, 60, 120, 90]);
    expect(projection.cards.slice(8).every(value => value === 0)).toBe(true);
  });
  it("bounds the visible budget without mutating the supplied registrations", () => {
    const cards: GlassProjectedCard[] = Array.from({ length: 50 }, (_, index) => projectGlassCard(String(index), { ...card, width: 40 + index }, viewport, [])!);
    const frozen = Object.freeze(cards);
    const projection = packGlassProjection(360, 640, frozen);
    expect(projection.cardCount).toBe(GLASS_VISIBLE_LIMIT);
    expect(projection.visibleIds).toHaveLength(GLASS_VISIBLE_LIMIT);
    expect(frozen).toHaveLength(50);
    expect(projection.visibleIds[0]).toBe("0");
  });
  it("preserves every rounded mask and fails closed if the bounded ancestor chain overflows", () => {
    const clips = [0, 1, 2].map(index => ({ measure: { pageX: 30 + index * 5, pageY: 100 + index * 5, width: 250, height: 200 }, radius: 24 }));
    const card = projectGlassCard("nested", { pageX: 50, pageY: 160, width: 120, height: 90 }, viewport, clips)!;
    expect(card.roundedMasks).toHaveLength(3);
    const uniforms = packGlassProjection(360, 640, [card]);
    expect(uniforms.roundedClips.slice(0, 12)).toEqual([0, 0, 250, 200, 5, 5, 250, 200, 10, 10, 250, 200]);
    expect(uniforms.clipRadii.slice(0, 4)).toEqual([24, 24, 24, 0]);
    expect(projectGlassCard("overflow", { pageX: 50, pageY: 160, width: 120, height: 90 }, viewport, [...clips, clips[0]])).toBeNull();
  });
});
