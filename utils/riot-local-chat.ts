import axios from "axios";
import { Buffer } from "buffer";
import { Platform } from "react-native";

export type LocalChatConversation = {
  cid: string;
  type?: string;
  unread_count?: number;
  muted?: boolean;
};

export type LocalChatMessage = {
  body?: string;
  cid: string;
  game_name?: string;
  game_tag?: string;
  id?: string;
  mid?: string;
  name?: string;
  pid?: string;
  puuid?: string;
  read?: boolean;
  region?: string;
  time?: string;
  type?: "chat" | "groupchat" | "system" | string;
};

type ChatInfoResponse = {
  conversations?: LocalChatConversation[];
};

type ChatHistoryResponse = {
  messages?: LocalChatMessage[];
};

type LocalChatConfig = {
  baseUrl: string;
  authHeader: string;
};

const getLocalChatConfig = (): LocalChatConfig => {
  const host =
    process.env.EXPO_PUBLIC_RIOT_LOCAL_HOST ||
    (Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1");
  const protocol = process.env.EXPO_PUBLIC_RIOT_LOCAL_PROTOCOL || "https";
  const port = process.env.EXPO_PUBLIC_RIOT_LOCAL_PORT;
  const password = process.env.EXPO_PUBLIC_RIOT_LOCAL_PASSWORD;

  if (!port || !password) {
    throw new Error(
      "Missing Riot local chat config. Set EXPO_PUBLIC_RIOT_LOCAL_PORT and EXPO_PUBLIC_RIOT_LOCAL_PASSWORD from the Riot Client lockfile.",
    );
  }

  return {
    baseUrl: `${protocol}://${host}:${port}`,
    authHeader: `Basic ${Buffer.from(`riot:${password}`, "utf8").toString("base64")}`,
  };
};

const riotLocalRequest = async <T>(
  method: "GET" | "POST",
  path: string,
  data?: unknown,
  params?: Record<string, string>,
): Promise<T> => {
  const config = getLocalChatConfig();
  const response = await axios.request<T>({
    method,
    url: `${config.baseUrl}${path}`,
    data,
    params,
    headers: {
      Authorization: config.authHeader,
      "Content-Type": "application/json",
    },
  });

  return response.data;
};

export const getPartyChatInfo = async (): Promise<LocalChatConversation | null> => {
  const data = await riotLocalRequest<ChatInfoResponse>(
    "GET",
    "/chat/v6/conversations/ares-parties",
  );

  return data.conversations?.[0] ?? null;
};

export const getChatHistory = async (cid?: string): Promise<LocalChatMessage[]> => {
  const data = await riotLocalRequest<ChatHistoryResponse>(
    "GET",
    "/chat/v6/messages",
    undefined,
    cid ? { cid } : undefined,
  );

  return data.messages ?? [];
};

export const sendPartyChatMessage = async (
  cid: string,
  message: string,
): Promise<LocalChatMessage[]> => {
  const data = await riotLocalRequest<ChatHistoryResponse>("POST", "/chat/v6/messages/", {
    cid,
    message,
    type: "groupchat",
  });

  return data.messages ?? [];
};
