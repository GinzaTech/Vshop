import { createProfileLoadoutQueue, type ProfileLoadoutChange } from "~/features/profile/profile-loadout-queue";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";

const initial = (): PlayerLoadoutResponse => ({ Subject: "self", Version: 1, SourceApiVersion: "v3",
  Guns: [{ ID: "gun", SkinID: "old", SkinLevelID: "old-level", ChromaID: "old-chroma", Attachments: ["attachment"], CharmID: "buddy" }],
  Sprays: [], ActiveExpressions: [{ TypeID: "spray", AssetID: "old-spray" }], DynamicOptions: { untouched: true },
  Identity: { PlayerCardID: "card", PlayerTitleID: "title", AccountLevel: 4, PreferredLevelBorderID: "border", HideAccountLevel: false }, Incognito: false });
const gun = (id: string): ProfileLoadoutChange => ({ key: "gun:gun", apply: (source) => ({ ...source,
  Guns: source.Guns.map((entry) => entry.ID === "gun" ? { ...entry, SkinID: id, SkinLevelID: `${id}-level`, ChromaID: `${id}-chroma` } : entry) }),
  matches: (source) => source.Guns[0]?.SkinID === id && source.Guns[0]?.SkinLevelID === `${id}-level` && source.Guns[0]?.ChromaID === `${id}-chroma` });
const title = (id: string): ProfileLoadoutChange => ({ key: "identity:title", apply: (source) => ({ ...source, Identity: { ...source.Identity, PlayerTitleID: id } }),
  matches: (source) => source.Identity.PlayerTitleID === id });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
const tick = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

describe("Profile latest-intent serialized loadout queue", () => {
  let current: boolean;
  let write: jest.Mock<Promise<PlayerLoadoutResponse>, [PlayerLoadoutResponse]>;
  let read: jest.Mock<Promise<PlayerLoadoutResponse | null>, []>;
  let onConfirmed: jest.Mock; let onError: jest.Mock;
  const make = () => createProfileLoadoutQueue({ initial: initial(), isCurrent: () => current, write, read, onConfirmed, onError });
  beforeEach(() => { current = true; write = jest.fn(async (payload) => ({ ...payload, Version: payload.Version + 1 }));
    read = jest.fn(async () => initial()); onConfirmed = jest.fn(); onError = jest.fn(); });

  it("shows choices synchronously, coalesces unsent same-slot taps, and builds the next payload from the acknowledged version", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); const first = queue.enqueue(gun("A")); await tick();
    const second = queue.enqueue(gun("B")); const last = queue.enqueue(gun("C")); const other = queue.enqueue(title("new-title"));
    expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("C");
    expect(queue.getSnapshot().display.Identity.PlayerTitleID).toBe("new-title"); expect(write).toHaveBeenCalledTimes(1);
    pending.resolve({ ...write.mock.calls[0][0], Version: 9 }); await queue.whenIdle();
    expect(write).toHaveBeenCalledTimes(2); expect(write.mock.calls[1][0]).toMatchObject({ Version: 9, Identity: { PlayerTitleID: "new-title" },
      Guns: [expect.objectContaining({ SkinID: "C", CharmID: "buddy", Attachments: ["attachment"] })], DynamicOptions: { untouched: true } });
    expect(queue.getSnapshot().confirmed.Version).toBe(10); expect(queue.getSnapshot().pending).toBe(false);
    expect(await first).toBe(true); expect(await second).toBe(false); expect(await last).toBe(true); expect(await other).toBe(true);
  });

  it("coalesces a same-tick burst without mutating the initial or introducing parallel PUTs", async () => {
    const source = initial(); const queue = createProfileLoadoutQueue({ initial: source, isCurrent: () => current, write, read, onConfirmed, onError });
    for (let index = 0; index < 40; index++) void queue.enqueue(gun(`skin-${index}`));
    expect(source.Guns[0].SkinID).toBe("old"); await queue.whenIdle();
    expect(write).toHaveBeenCalledTimes(1); expect(write.mock.calls[0][0].Guns[0].SkinID).toBe("skin-39");
  });

  it("rolls back only a failed current field while keeping newer choices in other fields", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); const first = queue.enqueue(gun("A")); await tick(); const next = queue.enqueue(title("next-title"));
    pending.reject(new Error("network")); await queue.whenIdle();
    expect(await first).toBe(false); expect(await next).toBe(true); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("old");
    expect(queue.getSnapshot().display.Identity.PlayerTitleID).toBe("next-title"); expect(onError).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
  });

  it("does not roll back or report an old failure over a newer same-field choice", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); void queue.enqueue(gun("A")); await tick(); const next = queue.enqueue(gun("B"));
    pending.reject(new Error("network")); await queue.whenIdle(); expect(await next).toBe(true);
    expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("B"); expect(onError).not.toHaveBeenCalled();
  });

  it("accepts a read that proves an ambiguous write applied, without retrying the same mutation", async () => {
    write.mockRejectedValueOnce(new Error("timeout")); read.mockResolvedValueOnce({ ...gun("A").apply(initial()), Version: 2 });
    const queue = make(); const accepted = queue.enqueue(gun("A")); await queue.whenIdle();
    expect(await accepted).toBe(true); expect(write).toHaveBeenCalledTimes(1); expect(onError).not.toHaveBeenCalled();
  });

  it("retains unresolved choices but stops mutation dispatch when reconciliation is unavailable", async () => {
    write.mockRejectedValueOnce(new Error("timeout")); read.mockResolvedValueOnce(null);
    const queue = make(); void queue.enqueue(gun("A")); await queue.whenIdle();
    expect(queue.getSnapshot()).toMatchObject({ pending: true, saving: false, uncertain: true });
    expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("A"); expect(write).toHaveBeenCalledTimes(1);
    read.mockResolvedValueOnce(initial()); const next = queue.enqueue(title("next")); await queue.whenIdle(); expect(await next).toBe(true);
    expect(write).toHaveBeenCalledTimes(2); expect(write.mock.calls[1][0].Guns[0].SkinID).toBe("old");
  });

  it("rejects wrong-owner, malformed or older write receipts and reconciles before a later payload", async () => {
    for (const result of [{ ...initial(), Subject: "other" }, { ...initial(), Version: 0 }, { ...initial(), Version: NaN }]) {
      write.mockResolvedValueOnce(result); const queue = make(); const action = queue.enqueue(gun("A")); await queue.whenIdle();
      expect(await action).toBe(false); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("old");
    }
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("does not let hydration or refresh lower authority or replace intent during a write", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); void queue.enqueue(gun("A")); await tick();
    queue.adopt(initial()); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("A");
    pending.resolve({ ...gun("A").apply(initial()), Version: 4 }); await queue.whenIdle();
    expect(queue.adopt(initial())).toBe(false); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("A");
  });

  it("retires work without late publications or dispatch after ownership changes", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); const listener = jest.fn(); queue.subscribe(listener);
    const first = queue.enqueue(gun("A")); await tick(); const second = queue.enqueue(title("later"));
    current = false; const before = listener.mock.calls.length; pending.resolve({ ...gun("A").apply(initial()), Version: 2 }); await queue.whenIdle();
    expect(await first).toBe(false); expect(await second).toBe(false); expect(listener).toHaveBeenCalledTimes(before);
    expect(onConfirmed).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled(); expect(write).toHaveBeenCalledTimes(1);
  });

  it("allows subscribers to leave without canceling already authorized background choices", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    const queue = make(); const listener = jest.fn(); const unsubscribe = queue.subscribe(listener);
    const first = queue.enqueue(gun("A")); await tick(); const second = queue.enqueue(title("later")); unsubscribe();
    const before = listener.mock.calls.length; pending.resolve({ ...gun("A").apply(initial()), Version: 2 }); await queue.whenIdle();
    expect(await first).toBe(true); expect(await second).toBe(true); expect(listener).toHaveBeenCalledTimes(before); expect(write).toHaveBeenCalledTimes(2);
  });

  it("keeps a later choice visible when reconciliation fails, settles blocked callers, and resumes only after an explicit reconcile", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise); read.mockResolvedValueOnce(null);
    const queue = make(); const first = queue.enqueue(gun("A")); await tick(); const next = queue.enqueue(title("later"));
    pending.reject(new Error("timeout")); await queue.whenIdle();
    expect(await first).toBe(false); expect(await next).toBe(false);
    expect(queue.getSnapshot()).toMatchObject({ pending: true, saving: false, uncertain: true, display: { Identity: { PlayerTitleID: "later" } } });
    expect(write).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
    read.mockResolvedValueOnce({ ...initial(), Version: 7 }); queue.reconcile(); await queue.whenIdle();
    expect(write).toHaveBeenCalledTimes(2); expect(write.mock.calls[1][0]).toMatchObject({ Version: 7, Guns: [expect.objectContaining({ SkinID: "old" })], Identity: { PlayerTitleID: "later" } });
  });

  it("does not report an unresolved old failure over a newer same-field choice", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise); read.mockRejectedValueOnce(new Error("offline"));
    const queue = make(); void queue.enqueue(gun("A")); await tick(); void queue.enqueue(gun("B"));
    pending.reject(new Error("timeout")); await queue.whenIdle();
    expect(onError).not.toHaveBeenCalled(); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("B");
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("settles a choice when an already uncertain owner cannot reconcile, without dispatching a PUT", async () => {
    read.mockResolvedValue(null);
    const queue = createProfileLoadoutQueue({ initial: initial(), isCurrent: () => current, write, read, onConfirmed, onError, reconcileFirst: true });
    const action = queue.enqueue(title("later")); await queue.whenIdle();
    expect(await action).toBe(false); expect(write).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1); expect(queue.getSnapshot().display.Identity.PlayerTitleID).toBe("later");
  });
  it("retires during a force read without late errors or publication", async () => {
    const pending = deferred<PlayerLoadoutResponse | null>(); write.mockRejectedValueOnce(new Error("timeout")); read.mockReturnValueOnce(pending.promise);
    const queue = make(); const action = queue.enqueue(gun("A")); await tick();
    current = false; pending.resolve(initial()); await queue.whenIdle();
    expect(await action).toBe(false); expect(onError).not.toHaveBeenCalled(); expect(onConfirmed).not.toHaveBeenCalled();
  });
  it("keeps a valid PUT accepted when persistence and a subscriber throw, and still drains later choices", async () => {
    const pending = deferred<PlayerLoadoutResponse>(); write.mockReturnValueOnce(pending.promise);
    onConfirmed.mockImplementation(() => { throw new Error("cache full"); });
    const queue = make(); const observer = jest.fn(() => { throw new Error("view failed"); }); const healthy = jest.fn();
    queue.subscribe(observer); queue.subscribe(healthy);
    const first = queue.enqueue(gun("A")); await tick(); const second = queue.enqueue(title("later"));
    pending.resolve({ ...write.mock.calls[0][0], Version: 6 }); await queue.whenIdle();
    expect(await first).toBe(true); expect(await second).toBe(true);
    expect(write).toHaveBeenCalledTimes(2); expect(read).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
    expect(healthy).toHaveBeenCalled(); expect(queue.getSnapshot()).toMatchObject({ saving: false, pending: false, uncertain: false });
    expect(queue.getSnapshot().observerErrorCount).toBeGreaterThan(0);
  });
  it("settles every caller without an automatic microtask retry when beforeStart rejects", async () => {
    const beforeStart = jest.fn(async () => { throw new Error("predecessor failed"); });
    onError.mockImplementation(() => { throw new Error("toast failed"); });
    const queue = createProfileLoadoutQueue({ initial: initial(), isCurrent: () => current, write, read, onConfirmed, onError, beforeStart });
    const first = queue.enqueue(gun("A")); const second = queue.enqueue(title("later"));
    await queue.whenIdle(); await tick();
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(beforeStart).toHaveBeenCalledTimes(1); expect(write).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({ saving: false, uncertain: true });
  });
  it("treats synchronous reconciliation exceptions as unavailable authority and never repeats the mutation", async () => {
    write.mockRejectedValueOnce(new Error("timeout")); read.mockImplementationOnce(() => { throw new Error("read failed synchronously"); });
    const queue = make(); const result = queue.enqueue(gun("A")); await queue.whenIdle();
    expect(await result).toBe(false); expect(write).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({ saving: false, uncertain: true });
  });
  it("rejects conflicting same-version hydration after a known receipt without inventing a version", async () => {
    const queue = make(); await queue.enqueue(gun("A")); await queue.whenIdle();
    const acknowledged = queue.getSnapshot().confirmed;
    expect(queue.adopt({ ...initial(), Version: acknowledged.Version })).toBe(false);
    expect(queue.getSnapshot().confirmed).toBe(acknowledged); expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("A");
    expect(queue.adopt({ ...initial(), Version: acknowledged.Version + 1 })).toBe(true);
    expect(queue.getSnapshot().confirmed.Version).toBe(acknowledged.Version + 1);
  });
  it("blocks later PUTs when reconciliation propagates conflicting data at the already acknowledged version", async () => {
    const queue = make(); await queue.enqueue(gun("A")); await queue.whenIdle();
    write.mockRejectedValueOnce(new Error("timeout")); read.mockResolvedValueOnce({ ...initial(), Version: 2 });
    const next = queue.enqueue(title("later")); await queue.whenIdle();
    expect(await next).toBe(false); expect(queue.getSnapshot()).toMatchObject({ saving: false, uncertain: true });
    expect(queue.getSnapshot().display.Guns[0].SkinID).toBe("A"); expect(write).toHaveBeenCalledTimes(2);
  });
  it("settles a broken local patch without corrupting authority or blocking another field", async () => {
    const queue = make(); const failed = queue.enqueue({ key: "broken", apply: () => { throw new Error("local patch failed"); }, matches: () => false });
    const valid = queue.enqueue(title("later")); await queue.whenIdle();
    expect(await failed).toBe(false); expect(await valid).toBe(true); expect(write).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({ saving: false, pending: false, uncertain: false });
  });
  it("isolates a throwing acceptance predicate from an otherwise valid raw receipt", async () => {
    const queue = make(); const action = queue.enqueue({ ...gun("A"), matches: () => { throw new Error("predicate failed"); } });
    await queue.whenIdle(); expect(await action).toBe(false);
    expect(queue.getSnapshot().confirmed.Guns[0].SkinID).toBe("A"); expect(read).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({ saving: false, pending: false, uncertain: false });
  });
  it("allows identical same-version hydration but rejects conflicting attachment and dynamic JSON data", () => {
    const source = { ...initial(), DynamicOptions: { nested: { SourceApiVersion: "keep", modes: ["one", null] } } };
    const queue = createProfileLoadoutQueue({ initial: source, isCurrent: () => current, write, read, onConfirmed, onError });
    expect(queue.adopt(JSON.parse(JSON.stringify(source)) as PlayerLoadoutResponse)).toBe(true);
    expect(queue.adopt({ ...source, Guns: source.Guns.map((gun) => ({ ...gun, Attachments: [] })) })).toBe(false);
    expect(queue.adopt({ ...source, DynamicOptions: { nested: { SourceApiVersion: "changed", modes: ["one", null] } } })).toBe(false);
    expect(queue.getSnapshot().confirmed.DynamicOptions).toEqual(source.DynamicOptions);
  });
  it("accepts external reconciliation only after the transport barrier and only for valid current authority", async () => {
    const barrier = deferred<void>();
    read.mockResolvedValueOnce(null);
    const queue = createProfileLoadoutQueue({ initial: initial(), isCurrent: () => current, write, read, onConfirmed, onError,
      beforeStart: () => barrier.promise, reconcileFirst: true });
    queue.reconcile(); await tick();
    expect(queue.reconcileFromRead({ ...initial(), Version: 5 })).toBe(false);
    barrier.resolve(); await queue.whenIdle();
    expect(queue.reconcileFromRead({ ...initial(), Subject: "other", Version: 5 })).toBe(false);
    expect(queue.reconcileFromRead({ ...initial(), Version: 0 })).toBe(false);
    expect(queue.reconcileFromRead(gun("different").apply(initial()))).toBe(false);
    expect(queue.getSnapshot().uncertain).toBe(true);
    expect(queue.reconcileFromRead({ ...initial(), Version: 5 })).toBe(true);
    expect(queue.getSnapshot()).toMatchObject({ uncertain: false, pending: false });
    expect(queue.reconcileFromRead({ ...initial(), Version: 6 })).toBe(false);
    queue.cancel(); expect(queue.reconcileFromRead({ ...initial(), Version: 6 })).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
});
