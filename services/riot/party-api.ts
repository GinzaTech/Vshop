import type { RiotScreenSession } from "~/hooks/useRiotScreenSession";
import type { PartyResponse } from "./api-types";
import { riotApiClient } from "./client";
import { buildRiotApiUrl, type RiotEndpointParams } from "./endpoints";
import { extraHeaders } from "./request-context";

export function requirePartyText(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid party ${label}`);
  }
  return value.trim();
}

export function parsePartyRiotId(riotId: string): { name: string; tag: string } {
  if (typeof riotId !== "string" || riotId.length > 128 || /[\u0000-\u001f\u007f]/.test(riotId)) throw new Error("Invalid party Riot ID");
  const parts = riotId.split("#");
  if (parts.length !== 2) throw new Error("Invalid party Riot ID");
  return { name: requirePartyText(parts[0], "friend name"), tag: requirePartyText(parts[1], "friend tag") };
}

export function requirePartyCode(code: string): string {
  const trimmed = requirePartyText(code, "code");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) throw new Error("Invalid party code");
  return trimmed;
}

export async function joinPartyWithCode(session: RiotScreenSession, code: string): Promise<{ CurrentPartyID: string }> {
  const receipt = await requestPartyMutation(session, { name: "party-join-by-code", code: requirePartyCode(code) });
  if (!receipt || typeof receipt !== "object" || !("CurrentPartyID" in receipt) || typeof receipt.CurrentPartyID !== "string") {
    throw new Error("Invalid party join confirmation");
  }
  return { CurrentPartyID: requirePartyText(receipt.CurrentPartyID, "joined ID") };
}

function requestHeaders(session: RiotScreenSession) {
  requirePartyText(session.id, "player");
  return {
    ...extraHeaders(), "Content-Type": "application/json",
    Authorization: `Bearer ${requireCredential(session.accessToken)}`,
    "X-Riot-Entitlements-JWT": requireCredential(session.entitlementsToken),
  };
}

// JWTs are larger than display IDs; validate presence without the display text limit.
function requireCredential(value: string): string {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) throw new Error("Missing party credentials");
  return value;
}

export async function requestPartyMutation(session: RiotScreenSession, params: RiotEndpointParams, data?: object): Promise<unknown> {
  const headers = requestHeaders(session);
  const response = await riotApiClient.request<unknown>({
    url: buildRiotApiUrl({ ...params, region: session.region }), method: "POST",
    headers, validateStatus: () => true, ...(data ? { data } : {}),
  });
  if (response.status < 200 || response.status >= 300) throw new Error(`Party action failed (HTTP ${response.status})`);
  if (!response.data || typeof response.data !== "object" || Array.isArray(response.data)) throw new Error("Party action returned no confirmation");
  return response.data;
}

/** Reverse-doc contract: /endpoint/change-queue, queueID is intentionally lowercase. */
export async function setPartyQueue(session: RiotScreenSession, partyId: string, queueId: string) {
  return requestPartyMutation(session, { name: "party-queue", matchId: requirePartyText(partyId, "ID") }, { queueID: requirePartyText(queueId, "queue") });
}

/** Reverse-doc contract: /endpoint/set-party-accessibility. */
export async function setPartyAccessibility(session: RiotScreenSession, partyId: string, accessibility: "OPEN" | "CLOSED") {
  if (accessibility !== "OPEN" && accessibility !== "CLOSED") return Promise.reject(new Error("Invalid party accessibility"));
  return requestPartyMutation(session, { name: "party-accessibility", matchId: requirePartyText(partyId, "ID") }, { accessibility });
}

/** Reverse-doc contract: /endpoint/party-invite; Riot ID path, no PUUID body. */
export async function invitePartyFriend(session: RiotScreenSession, partyId: string, name: string, tag: string) {
  return requestPartyMutation(session, { name: "party-invite-by-name", matchId: requirePartyText(partyId, "ID"), friendName: requirePartyText(name, "friend name"), friendTag: requirePartyText(tag, "friend tag") });
}

async function read(session: RiotScreenSession, params: RiotEndpointParams): Promise<unknown | null> {
  const response = await riotApiClient.request<unknown>({ url: buildRiotApiUrl({ ...params, region: session.region }), method: "GET", headers: requestHeaders(session), validateStatus: () => true });
  if (response.status === 404) return null;
  if (response.status < 200 || response.status >= 300) throw new Error(`Party refresh failed (HTTP ${response.status})`);
  if (!response.data || typeof response.data !== "object") throw new Error("Invalid party response");
  return response.data;
}

/** Disambiguate nullable legacy combat results without treating 5xx as party absence. */
export async function getPartyState(session: RiotScreenSession, isCurrent: () => boolean = () => true): Promise<PartyResponse | null> {
  if (!isCurrent()) throw new Error("Party refresh is no longer current");
  const player = await read(session, { name: "party-player", userId: session.id });
  if (!isCurrent()) throw new Error("Party refresh is no longer current");
  if (player === null) return null;
  if (!("CurrentPartyID" in (player as object)) || typeof (player as { CurrentPartyID?: unknown }).CurrentPartyID !== "string") throw new Error("Invalid party discovery response");
  const partyId = (player as { CurrentPartyID: string }).CurrentPartyID;
  if (!partyId.trim()) return null;
  const party = await read(session, { name: "party", matchId: partyId });
  if (!isCurrent()) throw new Error("Party refresh is no longer current");
  if (party === null) return null;
  const value = party as Partial<PartyResponse>;
  if (value.ID !== partyId || !Array.isArray(value.Members)) throw new Error("Invalid party detail response");
  return value as PartyResponse;
}
