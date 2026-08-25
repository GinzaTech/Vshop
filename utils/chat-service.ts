// Import XMPPClient để giao tiếp qua giao thức XMPP
import { XMPPClient } from "./xmpp-client";
// Import chat store (zustand) để quản lý trạng thái chat
import { useChatStore } from "./chat-store";
// Import các hàm API Valorant liên quan đến chat
import {
  getPASToken,
  getPartyMucToken,
  getPlayerNames,
  getRiotClientConfig,
} from "./valorant-api";
// Import jwtDecode để decode JWT token
import { jwtDecode } from "jwt-decode";
// Import Buffer từ buffer để decode base64
import { Buffer } from "buffer";

// Map các region -> chat host fallback (khi không lấy được từ server)
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

// Instance duy nhất của XMPPClient
let xmppClientInstance: XMPPClient | null = null;
// Key để xác định danh sách bạn bè đang được resolve tên
let rosterNameResolveKey: string | null = null;
// Key của kết nối đang hoạt động (accessToken:entitlementsToken:region)
let activeConnectionKey: string | null = null;
// User ID hiện tại (đã normalize)
let currentUserId: string | null = null;
// Timer để thử lại resolve tên bạn bè
let rosterNameRetryTimer: ReturnType<typeof setTimeout> | null = null;
// Timer để thử kết nối lại
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
// Số lần đã thử kết nối lại
let reconnectAttempt = 0;
// Các connection key đang được khởi tạo, tránh tạo hai socket XMPP cùng lúc.
const initializingConnectionKeys = new Set<string>();
// Một lần focus có thể trùng với pull-to-refresh; dùng chung request đang chạy.
let rosterRefreshPromise: Promise<void> | null = null;
// Tăng sau mỗi roster response, kể cả roster rỗng, để phân biệt response mới.
let rosterRevision = 0;

/**
 * Chuẩn hóa friend ID từ JID (Jabber ID) hoặc PUUID.
 * Loại bỏ resource và domain, chỉ lấy phần user ID.
 * @param jidOrId - JID hoặc ID cần chuẩn hóa
 * @returns string - ID đã chuẩn hóa (lowercase, trim)
 */
const normalizeFriendId = (jidOrId: string) =>
  jidOrId.split("/")[0].split("@")[0].trim().toLowerCase();
/**
 * Chuẩn hóa sender từ message trong party chat.
 * @param sender - Tên sender (có thể là JID)
 * @returns string - ID đã chuẩn hóa
 */
const normalizeRoomSender = (sender: string) => normalizeFriendId(sender.split("/").pop() || sender);
/**
 * Kiểm tra chuỗi có phải định dạng UUID không.
 * @param value - Chuỗi cần kiểm tra
 * @returns boolean - true nếu là UUID
 */
const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

/**
 * Xoá timer reconnect nếu đang chạy.
 */
function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/**
 * Lên lịch thử kết nối lại sau một khoảng thời gian.
 * Sử dụng exponential backoff (2.5s, 5s, 10s, 20s) tối đa 30s.
 * @param connectionKey - Key của kết nối
 * @param accessToken - Access token
 * @param entitlementsToken - Entitlements token
 * @param region - Region (tuỳ chọn)
 * @param userId - User ID (tuỳ chọn)
 */
function scheduleReconnect(
  connectionKey: string,
  accessToken: string,
  entitlementsToken: string,
  region?: string,
  userId?: string
) {
  if (reconnectTimer || activeConnectionKey !== connectionKey) return;

  const delay = Math.min(30_000, 2500 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (activeConnectionKey === connectionKey) {
      void initChatService(
        accessToken,
        entitlementsToken,
        region,
        userId
      );
    }
  }, delay);
}

/**
 * Decode chuỗi base64 thành UTF-8.
 * @param value - Chuỗi base64 cần decode
 * @returns string - Chuỗi UTF-8 đã decode
 */
function decodeBase64Utf8(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

/**
 * Trích xuất party ID từ chuỗi presence XMPP của Valorant.
 * Presence chứa XML với phần dữ liệu base64 trong thẻ <p>.
 * @param status - Chuỗi status từ presence
 * @returns string | null - Party ID hoặc null nếu không tìm thấy
 */
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

/**
 * Giải quyết host và region XMPP cho chat dựa trên PAS token và client config.
 * @param accessToken - Access token
 * @param entitlementsToken - Entitlements token
 * @param pasToken - PAS token
 * @returns Promise<{ host: string; xmppRegion: string }> - Host và region XMPP
 */
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

/**
 * Public API: Khởi tạo dịch vụ chat (kết nối XMPP đến Riot).
 * Tạo XMPPClient mới, đăng ký các sự kiện, và connect.
 * Xử lý reconnect nếu kết nối thất bại.
 * @param accessToken - Access token
 * @param entitlementsToken - Entitlements token
 * @param region - Region (tuỳ chọn)
 * @param userId - User ID (tuỳ chọn)
 */
export async function initChatService(
  accessToken: string,
  entitlementsToken: string,
  region?: string,
  userId?: string
) {
  // Key xác định duy nhất một kết nối
  const connectionKey = `${accessToken}:${entitlementsToken}:${region || ""}`;
  const connectionChanged = activeConnectionKey !== connectionKey;
  if (userId) {
    currentUserId = normalizeFriendId(userId);
  }
  // Nếu cùng socket đang kết nối hoặc đã xác thực thì giữ lại. Trạng thái
  // disconnected/error phải dựng lại vì socket cũ không còn dùng được.
  const chatStatus = useChatStore.getState().status;
  if (
    xmppClientInstance &&
    activeConnectionKey === connectionKey &&
    (chatStatus === "connecting" || chatStatus === "authenticated")
  ) {
    return;
  }

  if (initializingConnectionKeys.has(connectionKey)) return;
  initializingConnectionKeys.add(connectionKey);

  try {
    clearReconnectTimer();
    if (connectionChanged) reconnectAttempt = 0;

    if (rosterNameRetryTimer) {
      clearTimeout(rosterNameRetryTimer);
      rosterNameRetryTimer = null;
    }
    rosterNameResolveKey = null;

    // Ngắt kết nối client cũ nếu có
    const previousClient = xmppClientInstance;
    xmppClientInstance = null;
    activeConnectionKey = connectionKey;
    previousClient?.disconnect();

    try {
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

      if (activeConnectionKey !== connectionKey) return;

      const client = new XMPPClient({
        rsoToken: accessToken,
        pasToken,
        entitlementsToken,
        host,
        xmppRegion,
      });
      xmppClientInstance = client;
    // Hàm kiểm tra client hiện tại còn là active không
    const isActiveClient = () =>
      xmppClientInstance === client && activeConnectionKey === connectionKey;

    // Sự kiện: trạng thái kết nối thay đổi
    client.onStateChange = (state) => {
      if (!isActiveClient()) return;
      useChatStore.getState().setStatus(state);
      if (state === "authenticated") {
        reconnectAttempt = 0;
        clearReconnectTimer();
      } else if (state === "error") {
        scheduleReconnect(
          connectionKey,
          accessToken,
          entitlementsToken,
          region,
          userId
        );
      }
    };

    // Sự kiện: nhận danh sách bạn bè (roster)
    client.onRoster = (friends) => {
      if (!isActiveClient()) return;
      rosterRevision += 1;
      const friendIds = friends.map((friend) => normalizeFriendId(friend.jid));
      useChatStore.getState().setFriends(
        friends.map((friend) => {
          const friendId = normalizeFriendId(friend.jid);
          const rosterName = friend.name?.trim();
          return {
            id: friendId,
            jid: friend.jid.split("/")[0],
            gameName:
              rosterName &&
              rosterName !== friendId &&
              !looksLikeUuid(rosterName)
                ? rosterName
                : "Unknown",
            tagLine: "",
            status: "",
            show: "offline",
          };
        })
      );

      // Resolve tên bạn bè từ API nếu có region
      if (region && friendIds.length > 0) {
        const resolveKey = `${connectionKey}:${friendIds
          .slice()
          .sort()
          .join(",")}`;
        if (rosterNameResolveKey !== resolveKey) {
          rosterNameResolveKey = resolveKey;
          void resolveRosterNames(
            accessToken,
            entitlementsToken,
            region,
            friendIds
          ).then((resolved) => {
            if (resolved || rosterNameResolveKey !== resolveKey) return;

            // Nếu chưa resolve được, thử lại sau 2.5s
            rosterNameRetryTimer = setTimeout(() => {
              rosterNameRetryTimer = null;
              void resolveRosterNames(
                accessToken,
                entitlementsToken,
                region,
                friendIds
              );
            }, 2500);
          });
        }
      }
    };

    // Sự kiện: nhận presence (trạng thái online/offline/game)
    client.onPresence = (from, status, show, raw) => {
      if (!isActiveClient()) return;
      const fromUserId = normalizeFriendId(from);
      const partyId =
        currentUserId && fromUserId === currentUserId
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

    // Sự kiện: nhận tin nhắn từ bạn bè
    client.onMessage = (message) => {
      if (!isActiveClient()) return;
      const fromId = normalizeFriendId(message.from);
      const toId = normalizeFriendId(message.to);
      const sentByCurrentUser = Boolean(currentUserId && fromId === currentUserId);
      const friendId = sentByCurrentUser ? toId : fromId;

      if (!friendId) return;

      useChatStore.getState().addMessage(friendId, {
        id: message.id,
        from: sentByCurrentUser ? "me" : friendId,
        to: sentByCurrentUser ? friendId : "me",
        body: message.body,
        timestamp: message.timestamp,
      });
    };

    // Sự kiện: nhận tin nhắn từ party chat
    client.onGroupMessage = (room, from, body) => {
      if (!isActiveClient()) return;
      const senderId = normalizeRoomSender(from);
      useChatStore.getState().addPartyMessage(room, {
        id: `${room}:${senderId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        from: senderId === currentUserId ? "me" : senderId,
        to: room,
        body,
        timestamp: Date.now(),
      });
    };

      client.connect();
    } catch (error) {
      // Chat retries with exponential backoff and session recovery may replace
      // stale credentials shortly afterwards. Avoid an intrusive LogBox error
      // for this recoverable state while keeping the failure visible in logs.
      if (__DEV__) console.log("[XMPP] Initialization failed; retry scheduled", error);
      activeConnectionKey = connectionKey;
      useChatStore.getState().setStatus("error");
      scheduleReconnect(
        connectionKey,
        accessToken,
        entitlementsToken,
        region,
        userId
      );
    }
  } finally {
    initializingConnectionKeys.delete(connectionKey);
  }
}

/**
 * Public API: Đảm bảo dịch vụ chat đã được khởi tạo và kết nối.
 * Ném lỗi nếu không thể kết nối.
 * @param accessToken - Access token
 * @param entitlementsToken - Entitlements token
 * @param region - Region (tuỳ chọn)
 * @param userId - User ID (tuỳ chọn)
 */
export async function ensureChatService(
  accessToken: string,
  entitlementsToken: string,
  region?: string,
  userId?: string
) {
  await initChatService(accessToken, entitlementsToken, region, userId);
  if (!xmppClientInstance || useChatStore.getState().status === "error") {
    throw new Error("Could not connect to Riot chat service");
  }
}

/**
 * Chờ cho đến khi chat được xác thực (authenticated).
 * Timeout sau timeoutMs mili giây.
 * @param timeoutMs - Thời gian chờ tối đa (mặc định 15s)
 */
async function waitForChatAuthentication(timeoutMs = 15_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = useChatStore.getState().status;
    if (status === "authenticated") return;
    if (status === "error") {
      throw new Error("Could not connect to Riot chat service");
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Riot chat connection timed out. Please refresh party chat.");
}

async function waitForRosterRevision(
  previousRevision: number,
  timeoutMs = 10_000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (rosterRevision > previousRevision) return;
    const status = useChatStore.getState().status;
    if (status === "error" || status === "disconnected") {
      throw new Error("Riot chat disconnected while loading friends");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Riot friends list request timed out");
}

/**
 * Kết nối chat nếu cần rồi luôn yêu cầu roster mới từ Riot. Hàm này được gọi
 * khi màn Bạn bè nhận focus và khi người dùng kéo để refresh.
 */
export async function refreshFriendsRoster({
  accessToken,
  entitlementsToken,
  region,
  userId,
}: {
  accessToken: string;
  entitlementsToken: string;
  region: string;
  userId: string;
}) {
  if (rosterRefreshPromise) return rosterRefreshPromise;

  const refreshTask = (async () => {
    await initChatService(accessToken, entitlementsToken, region, userId);
    await waitForChatAuthentication();

    let previousRevision = rosterRevision;
    let requested = xmppClientInstance?.requestRoster() ?? false;

    // Socket có thể chết mà state chưa kịp cập nhật. Đánh dấu lỗi để
    // initChatService dựng client mới rồi thử đúng một lần nữa.
    if (!requested) {
      useChatStore.getState().setStatus("error");
      await initChatService(accessToken, entitlementsToken, region, userId);
      await waitForChatAuthentication();
      previousRevision = rosterRevision;
      requested = xmppClientInstance?.requestRoster() ?? false;
    }

    if (!requested) {
      throw new Error("Could not request Riot friends list");
    }

    await waitForRosterRevision(previousRevision);
  })();

  rosterRefreshPromise = refreshTask;
  try {
    await refreshTask;
  } finally {
    if (rosterRefreshPromise === refreshTask) {
      rosterRefreshPromise = null;
    }
  }
}

/**
 * Public API: Theo dõi presence của party hiện tại.
 * Đảm bảo chat service đã được kết nối.
 * @param params - Object chứa accessToken, entitlementsToken, region, userId
 */
export async function watchOwnPartyPresence({
  accessToken,
  entitlementsToken,
  region,
  userId,
}: {
  accessToken: string;
  entitlementsToken: string;
  region: string;
  userId: string;
}) {
  currentUserId = normalizeFriendId(userId);
  await ensureChatService(accessToken, entitlementsToken, region, userId);
}

/**
 * Resolve tên hiển thị (GameName) cho danh sách bạn bè từ API Valorant.
 * Chia danh sách thành các chunk 50 người để tránh quá tải API.
 * @param accessToken - Access token
 * @param entitlementsToken - Entitlements token
 * @param region - Region
 * @param friendIds - Danh sách friend IDs
 * @returns Promise<boolean> - true nếu resolve thành công
 */
async function resolveRosterNames(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  friendIds: string[]
) {
  try {
    // Loại bỏ các ID trùng lặp
    const seenFriendIds = new Set<string>();
    const uniqueFriendIds: string[] = [];
    for (const value of friendIds) {
      const friendId = normalizeFriendId(value);
      if (friendId && !seenFriendIds.has(friendId)) {
        seenFriendIds.add(friendId);
        uniqueFriendIds.push(friendId);
      }
    }

    // Name Service hỗ trợ nhiều PUUID trong cùng request. Gửi toàn bộ roster
    // qua resolver dùng chung để chỉ tạo một request và tái sử dụng cache cho
    // match details/combat session/chat.
    const names = await getPlayerNames(
      accessToken,
      entitlementsToken,
      uniqueFriendIds,
      region
    );

    // Cập nhật tên bạn bè trong store
    useChatStore.getState().updateFriendNames(
      names.map((name) => ({
        id: normalizeFriendId(name.Subject),
        gameName: name.GameName || "Unknown",
        tagLine: name.TagLine || "",
      }))
    );
    return names.length > 0;
  } catch (error) {
    rosterNameResolveKey = null;
    if (__DEV__) {
      console.log("[XMPP] Failed to resolve roster names", error);
    }
    return false;
  }
}

/**
 * Public API: Gửi tin nhắn chat đến một bạn bè.
 * @param toId - ID của người nhận
 * @param message - Nội dung tin nhắn
 * @throws Error nếu chat chưa kết nối
 */
export function sendChatMessage(toId: string, message: string) {
  const friendId = normalizeFriendId(toId);
  const friend = useChatStore.getState().friends[friendId];

  if (
    !xmppClientInstance ||
    useChatStore.getState().status !== "authenticated"
  ) {
    throw new Error("Riot chat is not connected yet");
  }

  const sent = xmppClientInstance.sendMessage(friend?.jid || friendId, message);
  if (!sent) {
    throw new Error("Could not write the message to Riot chat");
  }

  useChatStore.getState().addMessage(friendId, {
    id: sent.id,
    from: "me",
    to: friendId,
    body: message,
    timestamp: sent.timestamp,
  });
}

/**
 * Public API: Yêu cầu lịch sử chat với một bạn bè.
 * @param toId - ID của bạn bè
 * @returns boolean - true nếu request được gửi thành công
 */
export function requestChatHistory(toId: string) {
  const friendId = normalizeFriendId(toId);
  const friend = useChatStore.getState().friends[friendId];

  if (
    !xmppClientInstance ||
    useChatStore.getState().status !== "authenticated"
  ) {
    return false;
  }

  return xmppClientInstance.requestMessageHistory(friend?.jid || friendId);
}

/**
 * Public API: Tham gia phòng chat party (XMPP MUC).
 * Lấy MUC token, chờ xác thực, và join room.
 * @param params - Object chứa accessToken, entitlementsToken, region, partyId, userId, roomName
 * @returns Promise<string> - Tên phòng đã join
 */
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
  currentUserId = normalizeFriendId(userId);
  await ensureChatService(accessToken, entitlementsToken, region, userId);

  if (__DEV__) {
    console.log("[XMPP] Joining party chat", {
      partyId,
      region,
      roomName,
    });
  }

  // Lấy MUC token và chờ xác thực song song
  const [mucToken] = await Promise.all([
    getPartyMucToken(accessToken, entitlementsToken, region, partyId),
    waitForChatAuthentication(),
  ]);
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

/**
 * Public API: Gửi tin nhắn đến party chat (XMPP MUC).
 * @param message - Nội dung tin nhắn
 * @throws Error nếu phòng chat chưa kết nối
 */
export function sendPartyXmppMessage(message: string) {
  const chatState = useChatStore.getState();
  const room = chatState.partyChatRoom;
  const body = message.trim();
  if (!body) return;
  if (!xmppClientInstance || !room || chatState.status !== "authenticated") {
    throw new Error("Party chat room is not connected");
  }

  const sent = xmppClientInstance.sendGroupMessage(room, body);
  if (!sent) {
    throw new Error("Could not send message to party chat");
  }

  useChatStore.getState().addPartyMessage(room, {
    id: `${room}:me:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    from: "me",
    to: room,
    body,
    timestamp: Date.now(),
  });
}

/**
 * Public API: Ngắt kết nối dịch vụ chat hoàn toàn.
 * Xoá tất cả timer, ngắt kết nối XMPP, reset store.
 */
export function disconnectChatService() {
  clearReconnectTimer();
  reconnectAttempt = 0;
  if (rosterNameRetryTimer) {
    clearTimeout(rosterNameRetryTimer);
    rosterNameRetryTimer = null;
  }
  if (xmppClientInstance) {
    xmppClientInstance.disconnect();
    xmppClientInstance = null;
  }
  activeConnectionKey = null;
  rosterNameResolveKey = null;
  rosterRefreshPromise = null;
  rosterRevision = 0;
  currentUserId = null;
  useChatStore.getState().resetChatSession();
}
