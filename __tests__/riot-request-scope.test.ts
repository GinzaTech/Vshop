import { createRequestScope } from "~/services/riot/request-scope";
import { invalidateSessionOperations } from "~/utils/session-operations";

it("uses opaque dedupe identities and separates request variants", () => {
  const scope = createRequestScope();
  const first = scope.observe("ap|player", "secret-access", "secret-entitlement");
  const same = scope.observe("ap|player", "secret-access", "secret-entitlement");
  expect(first.key()).toBe(same.key());
  expect(first.key()).not.toContain("secret");
  expect(first.key("force")).not.toBe(first.key("cached"));
});

it.each(["access", "entitlement", "generation", "clear", "resource-clear"])("invalidates work on %s", (change) => {
  const scope = createRequestScope();
  const old = scope.observe("player", "access", "entitlement");
  const assertOld = old.start();
  if (change === "access") scope.observe("player", "renewed", "entitlement");
  if (change === "entitlement") scope.observe("player", "access", "renewed");
  if (change === "generation") invalidateSessionOperations();
  if (change === "clear") scope.clear();
  if (change === "resource-clear") scope.clear("player");
  expect(assertOld).toThrow(expect.objectContaining({ code: "SESSION_CHANGED" }));
});

it("rejects older completions while preserving other resources", () => {
  const scope = createRequestScope();
  const first = scope.observe("one", "access", "ent");
  const assertFirst = first.start();
  const assertSecond = first.start();
  const assertOther = scope.observe("two", "access", "ent").start();
  expect(assertFirst).toThrow();
  expect(assertSecond).not.toThrow();
  scope.clear("one");
  expect(assertOther).not.toThrow();
});

it("bounds retained credential identities and invalidates evicted pending work", () => {
  const scope = createRequestScope();
  const first = scope.observe("first", "access", "ent");
  const recent = scope.observe("recent", "access", "ent");
  for (let index = 0; index < 998; index += 1) scope.observe(`player-${index}`, "access", "ent");
  scope.observe("recent", "access", "ent");
  scope.observe("overflow", "access", "ent");
  expect(first.assertCurrent).toThrow();
  expect(recent.assertCurrent).not.toThrow();
});
