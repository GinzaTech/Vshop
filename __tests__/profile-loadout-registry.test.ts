import { createProfileLoadoutRegistry, type LoadoutOwner } from "~/features/profile/profile-loadout-queue-registry";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
const initial = (): PlayerLoadoutResponse => ({ Subject: "self", Version: 1, SourceApiVersion: "v3", Guns: [], Sprays: [],
  ActiveExpressions: [], DynamicOptions: {}, Incognito: false,
  Identity: { PlayerCardID: "card", PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false } });
const owner: LoadoutOwner = { id: "self", region: "ap", accessToken: "a", entitlementsToken: "e", generation: 1 };
const change = { key: "card", apply: (base: PlayerLoadoutResponse) => ({ ...base, Identity: { ...base.Identity, PlayerCardID: "new" } }),
  matches: (base: PlayerLoadoutResponse) => base.Identity.PlayerCardID === "new" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((res) => { resolve = res; }); return { promise, resolve }; }
const tick = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
describe("bounded loadout owners", () => {
  const options = () => ({ initial: initial(), isCurrent: () => true, write: jest.fn(async (base: PlayerLoadoutResponse) => ({ ...base, Version: 2 })),
    read: jest.fn(async () => initial()), onConfirmed: jest.fn(), onError: jest.fn() });
  it("reuses the same owner through navigation and remount", async () => {
    const registry = createProfileLoadoutRegistry(); const config = options();
    const queue = registry.acquire(owner, config)!;
    await queue.enqueue(change);
    expect(registry.acquire({ ...owner }, options())).toBe(queue);
    expect(registry.peek(owner)?.getSnapshot().confirmed.Identity.PlayerCardID).toBe("new");
    expect(registry.peek({ ...owner, generation: 2 })).toBeNull();
  });
  it("waits through multiple credential replacements, then force-reconciles before writing", async () => {
    const registry = createProfileLoadoutRegistry(); const pending = deferred<PlayerLoadoutResponse>();
    const oldOptions = options(); oldOptions.write.mockReturnValueOnce(pending.promise);
    const old = registry.acquire(owner, oldOptions)!; const first = old.enqueue(change); await tick();
    const middle = registry.acquire({ ...owner, accessToken: "b" }, { ...options(), initial: change.apply(initial()) })!;
    expect(middle.getSnapshot().confirmed.Identity.PlayerCardID).toBe("card");
    const freshOptions = options(); freshOptions.read.mockResolvedValue({ ...initial(), Version: 10 });
    const fresh = registry.acquire({ ...owner, accessToken: "c" }, freshOptions)!;
    const action = fresh.enqueue(change); await tick();
    expect(freshOptions.read).not.toHaveBeenCalled(); expect(freshOptions.write).not.toHaveBeenCalled();
    freshOptions.write.mockImplementation(async (base) => ({ ...base, Version: 11 }));
    pending.resolve({ ...change.apply(initial()), Version: 9 }); await fresh.whenIdle();
    expect(await first).toBe(false); expect(await action).toBe(true);
    expect(oldOptions.onConfirmed).not.toHaveBeenCalled(); expect(freshOptions.read).toHaveBeenCalledTimes(1);
    expect(freshOptions.write.mock.calls[0][0].Version).toBe(10);
    expect(await middle.enqueue(change)).toBe(false);
  });
  it("retires credentials on logout while retaining the outstanding transport barrier", async () => {
    const registry = createProfileLoadoutRegistry(); const pending = deferred<PlayerLoadoutResponse>();
    const oldOptions = options(); oldOptions.write.mockReturnValueOnce(pending.promise);
    const old = registry.acquire(owner, oldOptions)!; void old.enqueue(change); await tick();
    registry.retire(); expect(registry.peek(owner)).toBeNull();
    const config = options(); const fresh = registry.acquire(owner, config)!;
    void fresh.enqueue(change); await tick(); expect(config.read).not.toHaveBeenCalled();
    pending.resolve(initial()); await fresh.whenIdle(); expect(config.read).toHaveBeenCalledTimes(1);
    expect(config.write).toHaveBeenCalledTimes(1); expect(oldOptions.onConfirmed).not.toHaveBeenCalled();
    registry.retire(); await tick(); expect(registry.peek(owner)).toBeNull();
  });
  it("evicts idle owners but refuses to evict unresolved work at the capacity bound", async () => {
    const registry = createProfileLoadoutRegistry(1); const old = registry.acquire(owner, options())!;
    const second = registry.acquire({ ...owner, id: "second" }, { ...options(), initial: { ...initial(), Subject: "second" } })!;
    expect(registry.peek(owner)).toBeNull(); expect(await old.enqueue(change)).toBe(false);
    const pending = deferred<PlayerLoadoutResponse>(); const config = options(); config.write.mockReturnValueOnce(pending.promise);
    registry.clear(); const active = registry.acquire(owner, config)!; void active.enqueue(change); await tick();
    expect(registry.acquire({ ...owner, id: "third" }, options())).toBeNull();
    registry.clear(); pending.resolve(initial()); await active.whenIdle();
    expect(await second.enqueue(change)).toBe(false);
  });
  it("keeps a validated newer initial authority and auto-reconciles an idle replacement", async () => {
    const registry = createProfileLoadoutRegistry(); registry.acquire(owner, options());
    const fresh = { ...change.apply(initial()), Version: 8 }; const config = { ...options(), initial: fresh };
    config.read.mockResolvedValue(fresh);
    const queue = registry.acquire({ ...owner, accessToken: "renewed" }, config)!;
    expect(queue.getSnapshot().confirmed).toBe(fresh);
    await queue.whenIdle();
    expect(config.read).toHaveBeenCalledTimes(1); expect(config.write).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({ pending: false, uncertain: false, saving: false });
  });
  it.each(["owner", "version", "identity", "tie"])("rejects %s replacement initial and retains the prior authority", async (part) => {
    const registry = createProfileLoadoutRegistry(); const previous = registry.acquire(owner, options())!;
    const changed = change.apply(initial());
    const candidate = part === "owner" ? { ...changed, Subject: "other", Version: 8 } :
      part === "version" ? { ...changed, Version: NaN } :
        part === "identity" ? { ...changed, Version: 8, Identity: { ...changed.Identity, PlayerCardID: null } } : changed;
    const config = { ...options(), initial: candidate as PlayerLoadoutResponse };
    const queue = registry.acquire({ ...owner, entitlementsToken: "renewed" }, config)!;
    expect(queue.getSnapshot().confirmed).toBe(previous.getSnapshot().confirmed);
    await queue.whenIdle(); expect(queue.getSnapshot().confirmed).toEqual(initial());
    expect(config.read).toHaveBeenCalledTimes(1); expect(config.write).not.toHaveBeenCalled();
  });
  it("bounds an unavailable automatic reconcile and recovers only on an explicit retry", async () => {
    const registry = createProfileLoadoutRegistry(); registry.acquire(owner, options());
    const config = options(); config.read.mockRejectedValueOnce(new Error("offline"));
    const queue = registry.acquire({ ...owner, generation: 2 }, config)!;
    await queue.whenIdle(); await tick();
    expect(config.read).toHaveBeenCalledTimes(1); expect(config.write).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({ pending: true, uncertain: true, saving: false });
    queue.reconcile(); await queue.whenIdle();
    expect(config.read).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot()).toMatchObject({ pending: false, uncertain: false });
  });
});
