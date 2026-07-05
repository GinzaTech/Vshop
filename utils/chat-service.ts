import { XMPPClient } from "./xmpp-client";
import { useChatStore } from "./chat-store";
import {
  getPASToken,
  getPartyMucToken,
  getPlayerNames,
  getRiotClientConfig,
} from "./valorant-api";
import { jwtDecode } from "jwt-decode";

const fallbackChatHosts: Record<string, string> = {
  ap: "jp1.chat.si.riotgames.com",
  asia: "jp1.chat.si.riotgames.com",
  br: "br.chat.si.riotgames.com",
  br1: "br.chat.si.riotgames.com",
  eu: "euw1.chat.si.riotgames.com",
  kr: "kr1.chat.si.riotgames.com",
  kr1: "kr1.chat.si.riotgames.com",
  latam: "la1.chat.si.riotgames.com",
  na: "na2.chat.si.riotgames.com",
  na1: "na2.chat.si.riotgames.com",
};

let xmppClientInstance: XMPPClient | null = null;
let rosterNameResolveKey: string | null = null;
let activeConnectionKey: string | null = null;
let currentPartyUserId: string | null = null;

const normalizeFriendId = (jidOrId: string) => jidOrId.split("@")[0];
const normalizeRoomSender = (sender: string) => normalizeFriendId(sender.split("/").pop() || sender);

function decodeBase64Utf8(value: string) {
  return globalThis.atob(value);
}

function getPartyIdFromPresence(status: string) {
  const presenceMatch = /<valorant[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(status);
  if (!presenceMatch) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(presenceMatch[1])) return null;

  try {
    const payload = JSON.parse(decodeBase64Utf8(presenceMatch[1]));
    const partyId =
      payload?.partyPresenceData?.partyId ||
      payload?.partyId ||
      null;
    return typeof partyId === "string" && partyId ? partyId : null;
  } catch (error) {
    if (__DEV__) {
      console.log("[XMPP] Failed to parse party presence", error);
    }
    return null;
  }
}

async function resolveChatHost(
  accessToken: string,
  entitlementsToken: string,
  pasToken: string
) {
  const clientConfig = await getRiotClientConfig(
    accessToken,
    entitlementsToken
  ).catch(() => null);
  const pasPayload = jwtDecode<{
    affinity?: string;
    affinities?: { chat?: string; live?: string; pbe?: string };
  }>(pasToken);

  const affinity =
    pasPayload.affinities?.chat ||
    pasPayload.affinity ||
    pasPayload.affinities?.live ||
    pasPayload.affinities?.pbe ||
    "na1";
  const configuredHost =
    clientConfig?.["chat.affinities"]?.[affinity] ||
    fallbackChatHosts[affinity];
  const host = configuredHost || (
    affinity.includes(".chat.si.riotgames.com")
      ? affinity
      : `${affinity}.chat.si.riotgames.com`
  );
  const xmppRegion =
    clientConfig?.["chat.affinity_domains"]?.[affinity] ||
    host.split(".chat.si.riotgames.com")[0];

  if (__DEV__) {
    console.log("[XMPP] Resolved chat affinity", {
      affinity,
      host,
      xmppRegion,
    });
  }

  return { host, xmppRegion };
}

export async function initChatService(
  accessToken: string,
  entitlementsToken: string,
  region?: string
) {
  const connectionKey = `${accessToken}:${entitlementsToken}:${region || ""}`;
  if (
    xmppClientInstance &&
    activeConnectionKey === connectionKey &&
    useChatStore.getState().status !== "error"
  ) {
    return;
  }

  if (xmppClientInstance) {
    xmppClientInstance.disconnect();
  }

  try {
    activeConnectionKey = connectionKey;
    useChatStore.getState().setStatus("connecting");
    const pasToken = await getPASToken(accessToken);

    if (!pasToken) {
      throw new Error("Could not get PAS token for chat");
    }

    const { host, xmppRegion } = await resolveChatHost(
      accessToken,
      entitlementsToken,
      pasToken
    );

    xmppClientInstance = new XMPPClient({
      rsoToken: accessToken,
      pasToken,
      entitlementsToken,
      host,
      xmppRegion,
    });

    xmppClientInstance.onStateChange = (state) => {
      useChatStore.getState().setStatus(state);
    };

    xmppClientInstance.onRoster = (friends) => {
      const friendIds = friends.map((friend) => normalizeFriendId(friend.jid));
      useChatStore.getState().setFriends(
        friends.map((friend) => ({
          id: normalizeFriendId(friend.jid),
          jid: friend.jid,
          gameName: friend.name || "Unknown",
          tagLine: "",
          status: "",
          show: "offline",
        }))
      );

      if (region && friendIds.length > 0) {
        const resolveKey = `${region}:${friendIds.join(",")}`;
        if (rosterNameResolveKey !== resolveKey) {
          rosterNameResolveKey = resolveKey;
          void resolveRosterNames(
            accessToken,
            entitlementsToken,
            region,
            friendIds
          );
        }
      }
    };

    xmppClientInstance.onPresence = (from, status, show, raw) => {
      const fromUserId = normalizeFriendId(from);
      const partyId =
        currentPartyUserId && fromUserId === currentPartyUserId
          ? getPartyIdFromPresence(raw)
          : null;
      if (partyId) {
        if (__DEV__ && useChatStore.getState().currentPartyId !== partyId) {
          console.log("[XMPP] Presence party id", partyId);
        }
        useChatStore.getState().setCurrentPartyId(partyId);
      }
      useChatStore
        .getState()
        .updateFriendPresence(normalizeFriendId(from), status, show);
    };

    xmppClientInstance.onMessage = (from, body) => {
      const friendId = normalizeFriendId(from);
      useChatStore.getState().addMessage(friendId, {
        id: Math.random().toString(36).substring(7),
        from: friendId,
        to: "me",
        body,
        timestamp: Date.now(),
      });
    };

    xmppClientInstance.onGroupMessage = (room, from, body) => {
      const senderId = normalizeRoomSender(from);
      useChatStore.getState().addPartyMessage(room, {
        id: `${room}:${senderId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        from: senderId === currentPartyUserId ? "me" : senderId,
        to: room,
        body,
        timestamp: Date.now(),
      });
    };

    xmppClientInstance.connect();
  } catch (error) {
    console.error("Failed to initialize chat service:", error);
    activeConnectionKey = null;
    useChatStore.getState().setStatus("error");
  }
}

export async function ensureChatService(
  accessToken: string,
  entitlementsToken: string,
  region?: string
) {
  await initChatService(accessToken, entitlementsToken, region);
  if (!xmppClientInstance || useChatStore.getState().status === "error") {
    throw new Error("Could not connect to Riot chat service");
  }
}

async function resolveRosterNames(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  friendIds: string[]
) {
  try {
    const names = await getPlayerNames(
      accessToken,
      entitlementsToken,
      Array.from(new Set(friendIds)),
      region
    );

    useChatStore.getState().updateFriendNames(
      names.map((name) => ({
        id: name.Subject,
        gameName: name.GameName || "Unknown",
        tagLine: name.TagLine || "",
      }))
    );
  } catch (error) {
    if (__DEV__) {
      console.log("[XMPP] Failed to resolve roster names", error);
    }
  }
}

export function sendChatMessage(toId: string, message: string) {
  if (xmppClientInstance) {
    const friend = useChatStore.getState().friends[toId];
    xmppClientInstance.sendMessage(friend?.jid || toId, message);
    useChatStore.getState().addMessage(toId, {
      id: Math.random().toString(36).substring(7),
      from: "me",
      to: toId,
      body: message,
      timestamp: Date.now(),
    });
  }
}

export async function joinPartyXmppChat({
  accessToken,
  entitlementsToken,
  region,
  partyId,
  userId,
  roomName,
}: {
  accessToken: string;
  entitlementsToken: string;
  region: string;
  partyId: string;
  userId: string;
  roomName?: string | null;
}) {
  currentPartyUserId = userId;
  await ensureChatService(accessToken, entitlementsToken, region);

  const mucToken = await getPartyMucToken(
    accessToken,
    entitlementsToken,
    region,
    partyId
  );
  const room = mucToken?.Room || roomName;
  if (!mucToken?.Token) {
    throw new Error(`Could not get party chat token for party ${partyId}`);
  }
  if (!room) {
    throw new Error("Could not join party chat room");
  }

  const client = xmppClientInstance;
  if (!client || useChatStore.getState().status === "error") {
    throw new Error("Party chat connection is not available");
  }

  client.joinRoom(room, mucToken.Token, userId);
  useChatStore.getState().setPartyChatRoom(room);
  return room;
}

export function sendPartyXmppMessage(message: string) {
  const room = useChatStore.getState().partyChatRoom;
  if (!xmppClientInstance || !room) {
    throw new Error("Party chat room is not connected");
  }

  xmppClientInstance.sendGroupMessage(room, message);
  useChatStore.getState().addPartyMessage(room, {
    id: `${room}:me:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    from: "me",
    to: room,
    body: message,
    timestamp: Date.now(),
  });
}

export function disconnectChatService() {
  if (xmppClientInstance) {
    xmppClientInstance.disconnect();
    xmppClientInstance = null;
    activeConnectionKey = null;
  }
}
