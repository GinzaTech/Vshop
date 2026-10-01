import { createProfileLoadoutQueue, type ProfileLoadoutQueue } from "./profile-loadout-queue";
import { subscribeLoadoutRetirement } from "~/services/riot/loadout-lifecycle";
import { isLoadoutResponse } from "~/services/riot/loadout-response";

export type LoadoutOwner = { id: string; region: string; accessToken: string; entitlementsToken: string; generation: number };
const sameOwner = (left: LoadoutOwner, right: LoadoutOwner) =>
  left.id === right.id && left.region === right.region && left.accessToken === right.accessToken &&
  left.entitlementsToken === right.entitlementsToken && left.generation === right.generation;
type Entry = { owner: LoadoutOwner; queue: ProfileLoadoutQueue; predecessor: Promise<void> };

/** Bounded memory-only owners; a retired transport must settle before its replacement sends. */
export function createProfileLoadoutRegistry(limit = 8) {
  const entries = new Map<string, Entry>();
  const key = (owner: LoadoutOwner) => `${owner.region}|${owner.id}`;
  return {
    peek(owner: LoadoutOwner) {
      const entry = entries.get(key(owner));
      return entry && sameOwner(entry.owner, owner) ? entry.queue : null;
    },
    acquire(owner: LoadoutOwner, options: Parameters<typeof createProfileLoadoutQueue>[0]) {
      const previous = entries.get(key(owner));
      if (previous && sameOwner(previous.owner, owner)) return previous.queue;
      if (!previous && entries.size >= limit) {
        const idle = [...entries].find(([, entry]) => !entry.queue.getSnapshot().pending && !entry.queue.getSnapshot().saving);
        if (!idle) return null;
        idle[1].queue.cancel();
        entries.delete(idle[0]);
      }
      // Cancel only authority/publication, never pretend an in-flight PUT was aborted.
      previous?.queue.cancel();
      const predecessor = previous ? Promise.all([previous.predecessor, previous.queue.whenIdle()]).then(() => undefined) : Promise.resolve();
      const previousConfirmed = previous?.queue.getSnapshot().confirmed;
      // Same-Version display overlays cannot replace authority. A validated newer
      // initial snapshot can already include a trusted GET from the renewed session.
      const initial = previousConfirmed && !isLoadoutResponse(options.initial, owner.id, previousConfirmed.Version + 1) ?
        previousConfirmed : options.initial;
      let registered = false;
      const queue = createProfileLoadoutQueue({ ...options,
        initial,
        beforeStart: previous ? () => predecessor : options.beforeStart,
        reconcileFirst: Boolean(previous) || options.reconcileFirst,
        isCurrent: () => registered && entries.get(key(owner))?.queue === queue && options.isCurrent(),
      });
      entries.set(key(owner), { owner: { ...owner }, queue, predecessor });
      registered = true;
      // Start the required force read even when the user makes no further choice.
      if (previous) queue.reconcile();
      return queue;
    },
    clear() { entries.forEach((entry) => entry.queue.cancel()); entries.clear(); },
    retire() {
      entries.forEach((entry, resource) => {
        entry.queue.cancel();
        const retired = { ...entry, owner: { ...entry.owner, accessToken: "", entitlementsToken: "", generation: -1 } };
        entries.set(resource, retired);
        // Keep a credential-free transport barrier until all predecessor PUTs settle.
        void Promise.all([entry.predecessor, entry.queue.whenIdle()]).then(() => {
          if (entries.get(resource) === retired) entries.delete(resource);
        });
      });
    },
  };
}
export const profileLoadoutRegistry = createProfileLoadoutRegistry();
export type ProfileLoadoutRegistry = ReturnType<typeof createProfileLoadoutRegistry>;
subscribeLoadoutRetirement(() => profileLoadoutRegistry.retire());
