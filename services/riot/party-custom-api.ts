import type { RiotScreenSession } from "~/hooks/useRiotScreenSession";
import type { PartyResponse } from "./api-types";
import { requestPartyMutation, requirePartyText } from "./party-api";

function partyReceipt(value: unknown, partyId: string): PartyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Custom party action returned no confirmation");
  const party = value as Partial<PartyResponse>;
  if (party.ID !== partyId || !Array.isArray(party.Members) || typeof party.State !== "string") throw new Error("Custom party receipt does not match the active party");
  return party as PartyResponse;
}

/** Historical catalog: https://gist.github.com/Kavan72/b6e0bfdf21d610148f64df878b8a2cc5
 * Contemporary live support is NOT VERIFIED; never retry an alternative conversion path. */
export async function makePartyCustom(session: RiotScreenSession, partyId: string): Promise<PartyResponse> {
  const id = requirePartyText(partyId, "ID");
  const party = partyReceipt(await requestPartyMutation(session, { name: "party-make-custom", matchId: id }), id);
  if (party.State !== "CUSTOM_GAME_SETUP") throw new Error("Riot did not confirm Custom room setup");
  return party;
}

/** Original catalog: makedefault?queueID=...; the returned queue must equal the requested queue. */
export async function makePartyDefault(session: RiotScreenSession, partyId: string, queueId: string): Promise<PartyResponse> {
  const id = requirePartyText(partyId, "ID"); const queue = requirePartyText(queueId, "queue");
  if (queue.toLowerCase() === "custom") throw new Error("Custom is a room mode, not a matchmaking queue");
  const party = partyReceipt(await requestPartyMutation(session, { name: "party-make-default", matchId: id, queueId: queue }), id);
  if (party.State !== "DEFAULT" || party.MatchmakingData?.QueueID !== queue) throw new Error("Riot did not confirm the requested default queue");
  return party;
}

/** valclient.py party_start_custom_game and Techchrism Party_StartCustomGame: POST, no body.
 * Primary source: https://github.com/colinhartigan/valclient.py/blob/master/src/valclient/client.py */
export async function startPartyCustomGame(session: RiotScreenSession, partyId: string): Promise<PartyResponse> {
  const id = requirePartyText(partyId, "ID");
  const party = partyReceipt(await requestPartyMutation(session, { name: "party-start-custom", matchId: id }), id);
  if (!["CUSTOM_GAME_STARTING", "CUSTOM_GAME_PLAYING"].includes(party.State ?? "")) {
    throw new Error("Riot did not confirm a Custom start transition");
  }
  return party;
}
