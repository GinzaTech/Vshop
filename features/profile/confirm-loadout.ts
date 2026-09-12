import { playerLoadout } from "~/services/riot/loadout-api";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { getSessionGeneration } from "~/utils/session-operations";
import type { PendingLoadoutUpdate } from "./profile-loadout";

type Credentials = {
  accessToken: string;
  entitlementsToken: string;
  region: string;
  id: string;
};

/** Confirm a mutation against Riot, never against the cached PUT response. */
export async function confirmProfileLoadout(
  user: Credentials,
  expected: PlayerLoadoutResponse,
  pending: PendingLoadoutUpdate,
  getPending: () => PendingLoadoutUpdate | null,
  matches: (latest: PlayerLoadoutResponse, expected: PlayerLoadoutResponse) => boolean,
) {
  const generation = getSessionGeneration();
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  if (generation !== getSessionGeneration() || getPending() !== pending) return null;
  const latest = await playerLoadout(
    user.accessToken, user.entitlementsToken, user.region, user.id, { force: true }
  ).catch(() => null);
  return generation === getSessionGeneration() && getPending() === pending &&
    latest && matches(latest, expected) ? latest : null;
}
