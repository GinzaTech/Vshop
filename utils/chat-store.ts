import { create } from "zustand";

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
}

export interface ChatFriend {
  id: string; // Riot PUUID
  gameName: string;
  tagLine: string;
  status: string;
  show: string; // online, dnd, chat, away, offline
  jid?: string;
}

interface ChatState {
  status: "disconnected" | "connecting" | "authenticated" | "error";
  friends: Record<string, ChatFriend>;
  messages: Record<string, ChatMessage[]>;
  partyChatRoom: string | null;
  currentPartyId: string | null;
  partyMessages: Record<string, ChatMessage[]>;
  setStatus: (status: "disconnected" | "connecting" | "authenticated" | "error") => void;
  setFriends: (friends: ChatFriend[]) => void;
  updateFriendNames: (
    names: { id: string; gameName: string; tagLine: string }[]
  ) => void;
  updateFriendPresence: (id: string, status: string, show: string) => void;
  addMessage: (friendId: string, message: ChatMessage) => void;
  setPartyChatRoom: (room: string | null) => void;
  setCurrentPartyId: (partyId: string | null) => void;
  addPartyMessage: (room: string, message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  status: "disconnected",
  friends: {},
  messages: {},
  partyChatRoom: null,
  currentPartyId: null,
  partyMessages: {},
  setStatus: (status) => set({ status }),
  setFriends: (friends) =>
    set((state) => {
      const nextFriends = { ...state.friends };

      for (const friend of friends) {
        const existing = nextFriends[friend.id];
        nextFriends[friend.id] = {
          ...friend,
          gameName:
            existing?.gameName && existing.gameName !== "Unknown"
              ? existing.gameName
              : friend.gameName,
          tagLine: existing?.tagLine || friend.tagLine,
          status: existing?.status ?? friend.status,
          show: existing?.show ?? friend.show,
        };
      }

      return { friends: nextFriends };
    }),
  updateFriendNames: (names) =>
    set((state) => {
      const nextFriends = { ...state.friends };

      for (const name of names) {
        nextFriends[name.id] = {
          ...(nextFriends[name.id] || {
            id: name.id,
            status: "",
            show: "offline",
          }),
          gameName: name.gameName,
          tagLine: name.tagLine,
        };
      }

      return { friends: nextFriends };
    }),
  updateFriendPresence: (id, status, show) =>
    set((state) => ({
      friends: {
        ...state.friends,
        [id]: {
          ...(state.friends[id] || { id, gameName: "Unknown", tagLine: "" }),
          status,
          show,
        },
      },
    })),
  addMessage: (friendId, message) =>
    set((state) => {
      const currentMessages = state.messages[friendId] || [];
      return {
        messages: {
          ...state.messages,
          [friendId]: [...currentMessages, message],
        },
      };
    }),
  setPartyChatRoom: (room) => set({ partyChatRoom: room }),
  setCurrentPartyId: (partyId) => set({ currentPartyId: partyId }),
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
}));
