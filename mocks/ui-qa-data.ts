import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { isLoadoutResponse } from "~/services/riot/loadout-response";
import { createProfileLoadoutRegistry } from "~/features/profile/profile-loadout-queue-registry";
import type { ProfileLoadoutRuntime } from "~/features/profile/useProfileMutations";
import type { OwnedSkinOption } from "~/features/profile/profile-loadout";
import { defaultUser } from "~/utils/valorant-user";
import { VItemTypes } from "~/utils/misc";

// Leave a deterministic observation window on slow instrumented emulators.
// This changes only the isolated DEV transport, never production API timing.
export const QA_WRITE_DELAY_MS = 5000;
export const QA_WEAPON_ID = "9c82e19d-4575-0200-1a81-3eacf00cf872";
// This object is never written to a store. Empty credentials cannot authenticate to Riot.
export const QA_USER: typeof defaultUser = { ...defaultUser, id: "local-ui-qa", region: "qa", name: "Local QA", TagLine: "LOCAL",
  accessToken: "", entitlementsToken: "", idToken: "", ownedSkinIds: [] };

// Public art/UUIDs supplied from valorant-api.com. Ownership and prices below are synthetic QA data.
export const QA_SKINS: OwnedSkinOption[] = [
  ["QASkinA", "9bf19b77-4b33-7203-9f2c-16932970622f", "9f51da57-4623-415a-6313-f49588297d0e", "140a48ad-4daf-a6f8-027c-a5b890eac738"],
  ["QASkinB", "b9ee2457-481c-6776-3f5b-0ca8e8f90c89", "c9678d8c-4327-f397-b0ec-dca3c3d6fb15", "a26e0d1d-4886-7d62-6b4f-1996e706463d"],
  ["QASkinC", "30388628-42f0-606c-82c0-73ad43de997f", "ba42fe63-457a-78ce-4499-47950a698129", "2bd28382-48c6-8579-83e8-e9b64b783de3"],
].map(([name, skinId, skinLevelId, chromaId]) => ({ id: skinId, name, skinId, skinLevelId, chromaId,
  image: `https://media.valorant-api.com/weaponskins/${skinId}/displayicon.png`, selected: false,
  chromas: [{ id: chromaId, name: `${name} chroma`, selected: false }] }));
export const QA_TITLES = [{ id: "qa-title-a", name: "QATitleA" }, { id: "qa-title-b", name: "QATitleB" }];
export const QA_PREVIEW_CARDS: SkinShopItem[] = QA_SKINS.map((skin, index) => ({
  uuid: skin.skinId, displayName: ["QA · Champions 2021 Vandal", "QA · Prime Vandal", "QA · Reaver Vandal"][index],
  displayIcon: skin.image, themeUuid: "qa-local-theme", assetPath: "qa-local", price: 1,
  levels: [{ uuid: skin.skinLevelId, displayName: skin.name, displayIcon: skin.image, assetPath: "qa-local" }],
  chromas: [{ uuid: skin.chromaId, displayName: `${skin.name} chroma`, fullRender: skin.image ?? "", assetPath: "qa-local" }],
}));
export const qaSkinName = (id: string) => QA_SKINS.find((skin) => skin.skinId === id)?.name ?? id;
export const qaTitleName = (id: string) => QA_TITLES.find((title) => title.id === id)?.name ?? id;

export function createQaLoadout(): PlayerLoadoutResponse {
  const skin = QA_SKINS[0];
  return { Subject: QA_USER.id, Version: 1, SourceApiVersion: "v3", Incognito: false,
    Guns: [{ ID: QA_WEAPON_ID, SkinID: skin.skinId, SkinLevelID: skin.skinLevelId, ChromaID: skin.chromaId,
      CharmID: "qa-local-buddy", Attachments: [{ qaPreservedAttachment: true }] }], Sprays: [],
    ActiveExpressions: Array.from({ length: 4 }, (_, slot) => ({ TypeID: VItemTypes.Spray, AssetID: `qa-slot-${slot + 1}` })),
    DynamicOptions: { qaLocalOnly: true },
    Identity: { PlayerCardID: "qa-local-card", PlayerTitleID: QA_TITLES[0].id, AccountLevel: 1, PreferredLevelBorderID: "qa-local-border", HideAccountLevel: false } };
}

export type UiQaTransportStats = {
  writeCount: number; readCount: number; inFlight: number; maxInFlight: number; serverVersion: number;
  failNext: boolean; outcome: "idle" | "sending" | "accepted" | "rejected" | "disposed";
};
const clone = (source: PlayerLoadoutResponse): PlayerLoadoutResponse => JSON.parse(JSON.stringify(source)) as PlayerLoadoutResponse;

/** Only this local in-memory server changes. It has no HTTP, credentials or storage adapter. */
export function createUiQaTransport() {
  const registry = createProfileLoadoutRegistry();
  let server = createQaLoadout(); let disposed = false; let generation = 1;
  let stats: UiQaTransportStats = { writeCount: 0, readCount: 0, inFlight: 0, maxInFlight: 0, serverVersion: 1, failNext: false, outcome: "idle" };
  const listeners = new Set<() => void>();
  const timers = new Map<ReturnType<typeof setTimeout>, (error: Error) => void>();
  const notify = () => { if (!disposed) listeners.forEach((listener) => listener()); };
  const assertAlive = () => { if (disposed) throw new Error("Local QA transport disposed"); };
  const runtime: ProfileLoadoutRuntime = {
    registry, getGeneration: () => generation,
    isCurrent: (owner) => !disposed && owner.id === QA_USER.id && owner.region === QA_USER.region &&
      owner.generation === generation && owner.accessToken === "" && owner.entitlementsToken === "",
    read: async () => { assertAlive(); stats = { ...stats, readCount: stats.readCount + 1 }; notify(); return clone(server); },
    write: async (_owner, payload) => {
      assertAlive();
      const body = clone(payload); const shouldFail = stats.failNext;
      stats = { ...stats, failNext: false, writeCount: stats.writeCount + 1, inFlight: stats.inFlight + 1,
        maxInFlight: Math.max(stats.maxInFlight, stats.inFlight + 1), outcome: "sending" }; notify();
      return new Promise<PlayerLoadoutResponse>((resolve, reject) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          stats = { ...stats, inFlight: stats.inFlight - 1 };
          if (shouldFail || !isLoadoutResponse(body, QA_USER.id, server.Version) || body.Version !== server.Version) {
            stats = { ...stats, outcome: "rejected" }; notify(); reject(new Error("Local QA injected write failure")); return;
          }
          // The simulated server advances its own version; the actual queue must consume this receipt.
          server = { ...body, Version: server.Version + 1 };
          stats = { ...stats, serverVersion: server.Version, outcome: "accepted" }; notify(); resolve(clone(server));
        }, QA_WRITE_DELAY_MS);
        timers.set(timer, reject);
      });
    },
  };
  return {
    runtime,
    getSnapshot: () => stats,
    getServer: () => clone(server),
    armFailure() { assertAlive(); stats = { ...stats, failNext: true }; notify(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() {
      if (disposed) return;
      disposed = true; generation += 1; registry.retire(); listeners.clear();
      timers.forEach((reject, timer) => { clearTimeout(timer); reject(new Error("Local QA transport disposed")); }); timers.clear();
      stats = { ...stats, inFlight: 0, failNext: false, outcome: "disposed" };
    },
  };
}
