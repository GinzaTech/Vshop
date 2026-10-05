import { recordNavigationResponse, recordNavigationRender } from "~/features/navigation/navigation-response-profile";

type Profile = { enabled: boolean; events: readonly { phase: string; route: string; time: number }[]; renders?: readonly { route: string; actual: number }[] };
const runtime = globalThis as typeof globalThis & { __VSHOP_NAV_RESPONSE__: Profile };
afterEach(() => { runtime.__VSHOP_NAV_RESPONSE__ = { enabled: false, events: [] }; });

it("does no work until explicitly enabled", () => {
  const before = { enabled: false, events: [] };
  runtime.__VSHOP_NAV_RESPONSE__ = before;
  recordNavigationResponse("press", "shop");
  expect(runtime.__VSHOP_NAV_RESPONSE__).toBe(before);
});
it("records an immutable numeric-only snapshot for primary routes", () => {
  const before = { enabled: true, events: [] };
  runtime.__VSHOP_NAV_RESPONSE__ = before;
  recordNavigationResponse("press", "shop");
  expect(before.events).toEqual([]);
  expect(runtime.__VSHOP_NAV_RESPONSE__.events).toHaveLength(1);
  expect(runtime.__VSHOP_NAV_RESPONSE__.events[0]).toEqual({ phase: "press", route: "shop", time: expect.any(Number) });
  expect(Number.isFinite(runtime.__VSHOP_NAV_RESPONSE__.events[0].time)).toBe(true);
});
it("bounds samples and ignores unrelated routes", () => {
  runtime.__VSHOP_NAV_RESPONSE__ = { enabled: true, events: [] };
  recordNavigationResponse("press", "unknown");
  expect(runtime.__VSHOP_NAV_RESPONSE__.events).toEqual([]);
  for (let i = 0; i < 130; i += 1) recordNavigationResponse("commit", "profile");
  expect(runtime.__VSHOP_NAV_RESPONSE__.events).toHaveLength(120);
});

it("retains renderer samples when navigation events arrive and keeps both buffers bounded", () => {
  runtime.__VSHOP_NAV_RESPONSE__ = { enabled: false, events: [] };
  const disabled = runtime.__VSHOP_NAV_RESPONSE__;
  recordNavigationRender("profile", "update", 6, 20, 1, 30);
  expect(runtime.__VSHOP_NAV_RESPONSE__).toBe(disabled);
  runtime.__VSHOP_NAV_RESPONSE__ = { enabled: true, events: [] };
  recordNavigationRender("unknown", "update", 6, 20, 1, 30);
  expect(runtime.__VSHOP_NAV_RESPONSE__.renders).toBeUndefined();
  recordNavigationRender("profile", "update", 6, 20, 1, 30);
  const before = runtime.__VSHOP_NAV_RESPONSE__;
  recordNavigationResponse("commit", "profile");
  expect(runtime.__VSHOP_NAV_RESPONSE__.renders).toBe(before.renders);
  expect(before.events).toEqual([]);
  for (let i = 0; i < 130; i += 1) recordNavigationRender("settings", "update", 4, 8, 1, 10);
  expect(runtime.__VSHOP_NAV_RESPONSE__.renders).toHaveLength(120);
});
