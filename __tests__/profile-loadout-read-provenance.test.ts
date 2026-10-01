import { createProfileLoadoutQueue, type ProfileLoadoutChange } from "~/features/profile/profile-loadout-queue";
import { cacheUpdatedLoadout, clearCachedLoadout, getCachedPlayerLoadout, invalidateLoadoutReads } from "~/services/riot/loadout-cache";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";

jest.mock("~/services/riot/request-context", () => ({
  getPlayerResourceKey: (region: string, id: string) => `${region}|${id}`,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const change = (field: "PlayerCardID" | "PlayerTitleID", value: string): ProfileLoadoutChange => ({
  key: field,
  apply: (base) => ({ ...base, Identity: { ...base.Identity, [field]: value } }),
  matches: (base) => base.Identity[field] === value,
});

describe("loadout cache-to-queue read provenance", () => {
  beforeEach(clearCachedLoadout);
  afterEach(clearCachedLoadout);

  it.each(["v2", "v3"] as const)("never treats an invalidated force GET's cached fallback as %s reconciliation proof", async (api) => {
    const initial: PlayerLoadoutResponse = {
      Subject: "local-provenance", Version: 1, SourceApiVersion: api,
      Guns: [], Sprays: [], ActiveExpressions: [], DynamicOptions: {}, Incognito: false,
      Identity: { PlayerCardID: "old-card", PlayerTitleID: "old-title", AccountLevel: 1,
        PreferredLevelBorderID: "border", HideAccountLevel: false },
    };
    let server = initial;
    cacheUpdatedLoadout("ap", initial.Subject, initial);
    const lostReceipt = deferred<PlayerLoadoutResponse>();
    const lateNetwork = deferred<PlayerLoadoutResponse | null>();
    const forceRead = (load: () => Promise<PlayerLoadoutResponse | null>) =>
      getCachedPlayerLoadout("token", "ent", "ap", initial.Subject, { force: true }, load);
    const write = jest.fn(async (payload: PlayerLoadoutResponse) => {
      invalidateLoadoutReads("ap", initial.Subject);
      if (write.mock.calls.length === 1) {
        // Server applied the full payload but the caller never receives its ACK.
        server = { ...payload, Version: 2 };
        try { return await lostReceipt.promise; }
        finally { invalidateLoadoutReads("ap", initial.Subject); }
      }
      server = { ...payload, Version: server.Version + 1 };
      cacheUpdatedLoadout("ap", initial.Subject, server);
      return server;
    });
    const queue = createProfileLoadoutQueue({ initial, write, isCurrent: () => true,
      read: () => forceRead(async () => null), onConfirmed: () => undefined, onError: () => undefined });
    void queue.enqueue(change("PlayerCardID", "new-card")); await flush();
    void queue.enqueue(change("PlayerTitleID", "new-title"));
    const oldRefresh = forceRead(() => lateNetwork.promise);
    lostReceipt.reject(new Error("receipt lost")); await queue.whenIdle();
    expect(queue.getSnapshot()).toMatchObject({ uncertain: true, pending: true });
    lateNetwork.resolve(server);
    const invalidated = await oldRefresh;
    expect(invalidated).toBeNull();
    if (invalidated) queue.reconcileFromRead(invalidated);
    await queue.whenIdle();
    expect(write).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().display.Identity).toMatchObject({ PlayerCardID: "new-card", PlayerTitleID: "new-title" });

    const fresh = await forceRead(async () => server);
    expect(fresh).not.toBeNull();
    expect(queue.reconcileFromRead(fresh!)).toBe(true);
    await queue.whenIdle();
    expect(write).toHaveBeenCalledTimes(2);
    expect(server.Identity).toMatchObject({ PlayerCardID: "new-card", PlayerTitleID: "new-title" });
    expect(queue.getSnapshot()).toMatchObject({ uncertain: false, pending: false });
  });
});
