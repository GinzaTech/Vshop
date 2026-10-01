import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { isLoadoutResponse, sameLoadoutData } from "~/services/riot/loadout-response";

export type ProfileLoadoutChange = {
  key: string;
  apply: (source: PlayerLoadoutResponse) => PlayerLoadoutResponse;
  matches: (source: PlayerLoadoutResponse) => boolean;
};
type Intent = ProfileLoadoutChange & { revision: number; settle: (accepted: boolean) => void };
export type ProfileLoadoutSnapshot = {
  display: PlayerLoadoutResponse; confirmed: PlayerLoadoutResponse;
  revision: number; pending: boolean; saving: boolean; uncertain: boolean;
  errorRevision: number;
  observerErrorCount: number;
};
type Options = {
  initial: PlayerLoadoutResponse; isCurrent: () => boolean;
  write: (payload: PlayerLoadoutResponse) => Promise<PlayerLoadoutResponse>;
  read: () => Promise<PlayerLoadoutResponse | null>;
  onConfirmed: (server: PlayerLoadoutResponse) => void;
  onError: (error: unknown) => void;
  beforeStart?: () => Promise<void>;
  reconcileFirst?: boolean;
};

/** One full-payload write at a time; display intent never becomes server authority. */
export function createProfileLoadoutQueue(options: Options) {
  let confirmed = options.initial;
  let intents = new Map<string, Intent>();
  let unresolved: Intent[] = [];
  let sending: Intent[] = [];
  let revision = 0;
  let errorRevision = 0;
  let observerErrorCount = 0;
  let saving = false;
  let uncertain = options.reconcileFirst ?? false;
  let canceled = false;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const current = () => !canceled && options.isCurrent();
  let snapshot: ProfileLoadoutSnapshot;
  const observe = (callback: () => void) => {
    try { callback(); } catch { observerErrorCount += 1; }
  };
  const apply = (base: PlayerLoadoutResponse, intent: Intent) => {
    try {
      const next = intent.apply(base);
      if (!isLoadoutResponse(next, base.Subject, base.Version) || next.Version !== base.Version) throw new Error("Invalid local loadout change");
      return next;
    } catch (error: unknown) {
      observerErrorCount += 1;
      remove(intent);
      intent.settle(false);
      errorRevision += 1;
      observe(() => options.onError(error));
      return base;
    }
  };
  const publish = () => {
    snapshot = { confirmed, display: [...intents.values()].reduce(apply, confirmed),
      revision, saving, uncertain, errorRevision, observerErrorCount, pending: intents.size > 0 || uncertain };
    if (current()) listeners.forEach((listener) => observe(listener));
    snapshot = { ...snapshot, observerErrorCount };
  };
  const remove = (intent: Intent) => {
    if (intents.get(intent.key)?.revision === intent.revision) {
      intents = new Map(intents);
      intents.delete(intent.key);
      return true;
    }
    return false;
  };
  const matches = (intent: Intent, server: PlayerLoadoutResponse) => {
    try { return intent.matches(server); } catch { observerErrorCount += 1; return false; }
  };
  const acceptServer = (server: PlayerLoadoutResponse) => {
    confirmed = server;
    observe(() => options.onConfirmed(server));
  };
  const reportError = (error: unknown) => { errorRevision += 1; observe(() => options.onError(error)); publish(); };
  const reconcileServer = (server: PlayerLoadoutResponse | null) => {
    if (!current() || !isLoadoutResponse(server, confirmed.Subject, confirmed.Version)) return false;
    if (server.Version === confirmed.Version && !sameLoadoutData(server, confirmed)) return false;
    acceptServer(server);
    uncertain = false;
    let failedCurrent = false;
    for (const intent of unresolved) {
      const applied = matches(intent, server);
      failedCurrent = remove(intent) && !applied || failedCurrent;
      intent.settle(applied);
    }
    unresolved = [];
    if (failedCurrent) reportError(new Error("Loadout change was not confirmed"));
    publish();
    return true;
  };
  const reconcile = async () => {
    let server: PlayerLoadoutResponse | null;
    try { server = await options.read(); } catch { server = null; }
    return reconcileServer(server);
  };
  const cancel = () => {
    canceled = true;
    intents.forEach((intent) => intent.settle(false));
    sending.forEach((intent) => intent.settle(false));
    unresolved.forEach((intent) => intent.settle(false));
    intents = new Map();
    unresolved = [];
    listeners.clear();
  };
  const drain = async () => {
    await options.beforeStart?.();
    if (!current()) { cancel(); return; }
    if (uncertain && !await reconcile()) {
      if (!current()) { cancel(); return; }
      intents.forEach((intent) => intent.settle(false));
      if (intents.size) reportError(new Error("Loadout reconciliation unavailable"));
      publish();
      return;
    }
    while (intents.size && current()) {
      const prepared = [...intents.values()];
      const payload = prepared.reduce(apply, confirmed);
      const batch = prepared.filter((intent) => intents.get(intent.key)?.revision === intent.revision);
      if (!batch.length) continue;
      sending = batch;
      saving = true;
      publish();
      try {
        const receipt = await options.write(payload);
        if (!current()) { cancel(); return; }
        if (!isLoadoutResponse(receipt, confirmed.Subject, confirmed.Version)) throw new Error("Invalid loadout receipt");
        acceptServer(receipt);
        let failedCurrent = false;
        for (const intent of batch) {
          const applied = matches(intent, receipt);
          failedCurrent = remove(intent) && !applied || failedCurrent;
          intent.settle(applied);
        }
        if (failedCurrent) reportError(new Error("Loadout change was not confirmed"));
      } catch (error: unknown) {
        if (!current()) { cancel(); return; }
        uncertain = true;
        unresolved = batch;
        if (!await reconcile()) {
          if (!current()) { cancel(); return; }
          // A blocked outcome completes callers without discarding their visible choices.
          intents.forEach((intent) => intent.settle(false));
          batch.forEach((intent) => intent.settle(false));
          if (batch.some((intent) => intents.get(intent.key)?.revision === intent.revision)) reportError(error);
          break;
        }
      } finally {
        sending = [];
        saving = false;
        publish();
      }
    }
  };
  const start = () => {
    if (running) return;
    running = Promise.resolve().then(drain).catch((error: unknown) => {
      if (!current()) { cancel(); return; }
      uncertain = true;
      intents.forEach((intent) => intent.settle(false));
      sending.forEach((intent) => intent.settle(false));
      reportError(error);
    }).finally(() => {
      saving = false;
      sending = [];
      publish();
      running = null;
      if (intents.size && !uncertain && current()) start();
    });
  };
  publish();
  return {
    enqueue(change: ProfileLoadoutChange): Promise<boolean> {
      if (!current()) return Promise.resolve(false);
      const previous = intents.get(change.key);
      if (previous && !sending.includes(previous)) previous.settle(false);
      const result = new Promise<boolean>((settle) => {
        intents = new Map(intents).set(change.key, { ...change, revision: ++revision, settle });
      });
      publish();
      start();
      return result;
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    adopt(server: PlayerLoadoutResponse) {
      if (!current() || saving || uncertain || !isLoadoutResponse(server, confirmed.Subject, confirmed.Version)) return false;
      if (server.Version === confirmed.Version && !sameLoadoutData(server, confirmed)) return false;
      confirmed = server;
      publish();
      return true;
    },
    cancel,
    reconcile() { if (current() && uncertain) start(); },
    reconcileFromRead(server: PlayerLoadoutResponse) {
      if (!current() || !uncertain || saving || running) return false;
      const accepted = reconcileServer(server);
      if (accepted && intents.size) start();
      return accepted;
    },
    async whenIdle() { while (running) await running; },
  };
}
export type ProfileLoadoutQueue = ReturnType<typeof createProfileLoadoutQueue>;
