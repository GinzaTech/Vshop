import { riotApiClient } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { extraHeaders } from "~/services/riot/request-context";
import { isCurrentRiotScreenSession, type RiotScreenSession } from "~/hooks/useRiotScreenSession";
import { getSessionGeneration, SessionChangedError } from "~/utils/session-operations";

export type PregameAgentAction = {
  session: RiotScreenSession;
  expectedMatchId: string;
  agentId: string;
  isCurrent: () => boolean;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Only the explicit Lock handler calls this service. Both writes stay bound to
 * the displayed match even when Riot advances to a different lobby mid-request. */
export async function selectAndLockPregameAgent({ session, expectedMatchId, agentId, isCurrent }: PregameAgentAction): Promise<LockCharacterResponse> {
  for (const value of [session.id, session.region, session.accessToken, session.entitlementsToken, expectedMatchId, agentId]) {
    if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error("Missing or invalid pregame action input");
  }
  const generation = getSessionGeneration();
  const assertCurrent = () => {
    if (!isCurrent() || !isCurrentRiotScreenSession(session) || generation !== getSessionGeneration()) throw new SessionChangedError();
  };
  const playerUrl = buildRiotApiUrl({ name: "pregame-player", region: session.region, userId: session.id });
  const selectUrl = buildRiotApiUrl({ name: "select-agent", region: session.region, matchId: expectedMatchId, agentId });
  const lockUrl = buildRiotApiUrl({ name: "lock", region: session.region, matchId: expectedMatchId, agentId });
  const headers = { ...extraHeaders(), "X-Riot-Entitlements-JWT": session.entitlementsToken, Authorization: `Bearer ${session.accessToken}` };
  const request = async (url: string, method: "GET" | "POST") => {
    assertCurrent();
    const response = await riotApiClient.request<unknown>({ url, method, headers });
    assertCurrent();
    // Explicit status checks also cover native adapters that resolve HTTP errors.
    if (response.status !== 200 || !record(response.data)) throw new Error("Pregame action failed");
    return response.data;
  };
  const verifyMatch = async () => {
    const player = await request(playerUrl, "GET");
    if (player.MatchID !== expectedMatchId || player.Subject !== session.id) throw new Error("The active pregame match changed");
    assertCurrent();
  };
  await verifyMatch();
  await request(selectUrl, "POST");
  await verifyMatch();
  const result = await request(lockUrl, "POST");
  const ally = result.AllyTeam;
  if (result.ID !== expectedMatchId || typeof result.Version !== "number" ||
    !["character_select_active", "provisioned"].includes(String(result.PregameState)) ||
    !Array.isArray(result.Teams) || !record(ally) || !Array.isArray(ally.Players) ||
    !ally.Players.some((player: unknown) => record(player) && player.Subject === session.id &&
      player.CharacterID === agentId && player.CharacterSelectionState === "locked")) {
    throw new Error("Riot did not confirm the selected agent was locked");
  }
  assertCurrent();
  // The transport schema is LockCharacterResponse; validate the fields used for
  // confirmation at runtime rather than treating any truthy payload as success.
  return result as unknown as LockCharacterResponse;
}
