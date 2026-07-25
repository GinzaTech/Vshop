// Import hàm create từ zustand để tạo store
import { create } from "zustand";

// Interface định nghĩa cấu trúc một tin nhắn chat
export interface ChatMessage {
  id: string;        // ID duy nhất của tin nhắn
  from: string;      // Người gửi ("me" hoặc friend ID)
  to: string;        // Người nhận ("me" hoặc friend ID)
  body: string;      // Nội dung tin nhắn
  timestamp: number; // Thời gian gửi (Unix timestamp ms)
}

// Interface định nghĩa cấu trúc một người bạn trong danh bạ
export interface ChatFriend {
  id: string;       // Riot PUUID
  gameName: string; // Tên hiển thị trong game
  tagLine: string;  // Tag line (VD: #NA1)
  status: string;   // Trạng thái (VD: "Valorant", "Mobile",...)
  show: string;     // Trạng thái online: "online", "dnd", "chat", "away", "offline"
  jid?: string;     // Jabber ID (XMPP)
}

// Interface định nghĩa toàn bộ state và actions của chat store
interface ChatState {
  // Trạng thái kết nối chat
  status: "disconnected" | "connecting" | "authenticated" | "error";
  // Danh sách bạn bè (key là friend ID đã normalize)
  friends: Record<string, ChatFriend>;
  // Tin nhắn riêng tư (key là friend ID, value là mảng ChatMessage)
  messages: Record<string, ChatMessage[]>;
  // Presence đang chờ xử lý (khi friend chưa có trong danh sách)
  pendingPresence: Record<string, { status: string; show: string }>;
  // Phòng party chat hiện tại (null nếu chưa tham gia)
  partyChatRoom: string | null;
  // Party ID hiện tại từ presence
  currentPartyId: string | null;
  // Tin nhắn party chat (key là room name)
  partyMessages: Record<string, ChatMessage[]>;

  // Actions
  setStatus: (status: "disconnected" | "connecting" | "authenticated" | "error") => void;
  setFriends: (friends: ChatFriend[]) => void;
  updateFriendNames: (names: { id: string; gameName: string; tagLine: string }[]) => void;
  updateFriendPresence: (id: string, status: string, show: string) => void;
  addMessage: (friendId: string, message: ChatMessage) => void;
  setPartyChatRoom: (room: string | null) => void;
  setCurrentPartyId: (partyId: string | null) => void;
  addPartyMessage: (room: string, message: ChatMessage) => void;
  resetChatSession: () => void;
}

/**
 * Chuẩn hóa chat ID: loại bỏ resource và domain, lower case.
 * @param value - ID cần chuẩn hóa
 * @returns string - ID đã chuẩn hóa
 */
const normalizeChatId = (value: string) =>
  value.split("/")[0].split("@")[0].trim().toLowerCase();

// Tạo zustand store cho chat
export const useChatStore = create<ChatState>((set) => ({
  // State mặc định
  status: "disconnected",
  friends: {},
  messages: {},
  pendingPresence: {},
  partyChatRoom: null,
  currentPartyId: null,
  partyMessages: {},

  // Cập nhật trạng thái kết nối
  setStatus: (status) => set({ status }),

  // Thiết lập danh sách bạn bè, giữ lại gameName và presence từ state cũ nếu có
  setFriends: (friends) =>
    set((state) => {
      const nextFriends: Record<string, ChatFriend> = {};

      for (const friend of friends) {
        const friendId = normalizeChatId(friend.id);
        const existing = state.friends[friendId];
        const pendingPresence = state.pendingPresence[friendId];
        nextFriends[friendId] = {
          ...friend,
          id: friendId,
          gameName:
            existing?.gameName && existing.gameName !== "Unknown"
              ? existing.gameName
              : friend.gameName,
          tagLine: existing?.tagLine || friend.tagLine,
          status: pendingPresence?.status ?? existing?.status ?? friend.status,
          show: pendingPresence?.show ?? existing?.show ?? friend.show,
        };
      }

      return { friends: nextFriends, pendingPresence: {} };
    }),

  // Cập nhật tên hiển thị của bạn bè (GameName, TagLine)
  updateFriendNames: (names) =>
    set((state) => {
      const nextFriends = { ...state.friends };

      for (const name of names) {
        const friendId = normalizeChatId(name.id);
        nextFriends[friendId] = {
          ...(nextFriends[friendId] || {
            id: friendId,
            status: "",
            show: "offline",
          }),
          gameName: name.gameName,
          tagLine: name.tagLine,
        };
      }

      return { friends: nextFriends };
    }),

  // Cập nhật presence (trạng thái online) của một bạn bè
  // Nếu friend chưa có trong danh sách, lưu vào pendingPresence
  updateFriendPresence: (id, status, show) =>
    set((state) => {
      const friendId = normalizeChatId(id);
      const friend = state.friends[friendId];

      if (!friend) {
        return {
          pendingPresence: {
            ...state.pendingPresence,
            [friendId]: { status, show },
          },
        };
      }

      return {
        friends: {
          ...state.friends,
          [friendId]: {
            ...friend,
            status,
            show,
          },
        },
      };
    }),

  // Thêm tin nhắn vào lịch sử chat (kiểm tra trùng lặp trước khi thêm)
  // Sắp xếp tin nhắn theo thời gian tăng dần
  addMessage: (friendId, message) =>
    set((state) => {
      const normalizedFriendId = normalizeChatId(friendId);
      const currentMessages = state.messages[normalizedFriendId] || [];
      // Kiểm tra trùng lặp: cùng ID hoặc cùng nội dung trong 2 giây
      const isDuplicate = currentMessages.some(
        (item) =>
          item.id === message.id ||
          (item.from === message.from &&
            item.body === message.body &&
            Math.abs(item.timestamp - message.timestamp) < 2000)
      );

      if (isDuplicate) return state;

      return {
        messages: {
          ...state.messages,
          [normalizedFriendId]: [...currentMessages, message].sort(
            (left, right) => left.timestamp - right.timestamp
          ),
        },
      };
    }),

  // Thiết lập phòng party chat hiện tại
  setPartyChatRoom: (room) => set({ partyChatRoom: room }),

  // Thiết lập party ID hiện tại
  setCurrentPartyId: (partyId) => set({ currentPartyId: partyId }),

  // Thêm tin nhắn vào party chat (kiểm tra trùng lặp)
  addPartyMessage: (room, message) =>
    set((state) => {
      const currentMessages = state.partyMessages[room] || [];
      const isDuplicate = currentMessages.some(
        (item) =>
          item.id === message.id ||
          (item.from === message.from &&
            item.body === message.body &&
            Math.abs(item.timestamp - message.timestamp) < 2000)
      );

      if (isDuplicate) return state;

      return {
        partyMessages: {
          ...state.partyMessages,
          [room]: [...currentMessages, message],
        },
      };
    }),

  // Reset toàn bộ session chat về trạng thái ban đầu
  resetChatSession: () =>
    set({
      status: "disconnected",
      friends: {},
      messages: {},
      pendingPresence: {},
      partyChatRoom: null,
      currentPartyId: null,
      partyMessages: {},
    }),
}));
