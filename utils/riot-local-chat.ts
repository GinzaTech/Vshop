// Import axios để gửi HTTP request đến Riot local chat server
import axios from "axios";
// Import Buffer từ buffer để mã hóa Basic Auth
import { Buffer } from "buffer";
// Import Platform từ React Native để kiểm tra hệ điều hành
import { Platform } from "react-native";

/**
 * LocalChatConversation - Kiểu dữ liệu đại diện cho một cuộc hội thoại chat local
 * @property {string} cid - ID của cuộc hội thoại
 * @property {string} [type] - Loại hội thoại
 * @property {number} [unread_count] - Số tin nhắn chưa đọc
 * @property {boolean} [muted] - Có đang tắt tiếng hội thoại này không
 */
export type LocalChatConversation = {
  cid: string;
  type?: string;
  unread_count?: number;
  muted?: boolean;
};

/**
 * LocalChatMessage - Kiểu dữ liệu đại diện cho một tin nhắn chat local
 * @property {string} [body] - Nội dung tin nhắn
 * @property {string} cid - ID cuộc hội thoại
 * @property {string} [game_name] - Tên trong game
 * @property {string} [game_tag] - Tag trong game (VD: #NA1)
 * @property {string} [id] - ID tin nhắn
 * @property {string} [mid] - Message ID
 * @property {string} [name] - Tên người gửi
 * @property {string} [pid] - Player ID
 * @property {string} [puuid] - PUUID của người chơi
 * @property {boolean} [read] - Đã đọc chưa
 * @property {string} [region] - Khu vực
 * @property {string} [time] - Thời gian gửi
 * @property {"chat" | "groupchat" | "system" | string} [type] - Loại tin nhắn
 */
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

/**
 * ChatInfoResponse - Kiểu phản hồi từ API chat info
 * @property {LocalChatConversation[]} [conversations] - Danh sách các cuộc hội thoại
 */
type ChatInfoResponse = {
  conversations?: LocalChatConversation[];
};

/**
 * ChatHistoryResponse - Kiểu phản hồi từ API chat history
 * @property {LocalChatMessage[]} [messages] - Danh sách tin nhắn
 */
type ChatHistoryResponse = {
  messages?: LocalChatMessage[];
};

/**
 * LocalChatConfig - Cấu hình kết nối đến local chat server
 * @property {string} baseUrl - URL gốc của server (VD: https://127.0.0.1:port)
 * @property {string} authHeader - Header Authorization dạng Basic base64
 */
type LocalChatConfig = {
  baseUrl: string;
  authHeader: string;
};

/**
 * getLocalChatConfig - Lấy cấu hình kết nối đến Riot local chat từ biến môi trường
 * @returns {LocalChatConfig} Đối tượng cấu hình chứa baseUrl và authHeader
 * @throws {Error} Nếu thiếu port hoặc password
 */
const getLocalChatConfig = (): LocalChatConfig => {
  // Host mặc định: Android dùng 10.0.2.2 (Android emulator), các nền tảng khác dùng 127.0.0.1
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

/**
 * riotLocalRequest - Gửi HTTP request đến Riot local chat API
 * @template T - Kiểu dữ liệu phản hồi
 * @param {"GET" | "POST"} method - Phương thức HTTP
 * @param {string} path - Đường dẫn API
 * @param {unknown} [data] - Dữ liệu body (cho POST)
 * @param {Record<string, string>} [params] - Tham số query (cho GET)
 * @returns {Promise<T>} Promise trả về dữ liệu phản hồi
 * @throws {Error} Ném lỗi nếu request thất bại
 */
const riotLocalRequest = async <T>(
  method: "GET" | "POST",
  path: string,
  data?: unknown,
  params?: Record<string, string>,
): Promise<T> => {
  const config = getLocalChatConfig();
  const url = `${config.baseUrl}${path}`;

  try {
    const response = await axios.request<T>({
      method,
      url,
      data,
      params,
      timeout: 2500, // Timeout 2.5 giây
      headers: {
        Authorization: config.authHeader,
        "Content-Type": "application/json",
      },
    });

    if (__DEV__) {
      console.log("[riot-local-chat] response", {
        method,
        url,
        status: response.status,
      });
    }

    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log("[riot-local-chat] request failed", {
        method,
        url,
        message: error instanceof Error ? error.message : String(error),
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
      });
    }

    throw error;
  }
};

/**
 * getPartyChatInfo - Lấy thông tin cuộc hội thoại chat party (nhóm) hiện tại
 * Gọi API GET /chat/v6/conversations/ares-parties
 * @returns {Promise<LocalChatConversation | null>} Promise trả về cuộc hội thoại party hoặc null
 */
export const getPartyChatInfo = async (): Promise<LocalChatConversation | null> => {
  const data = await riotLocalRequest<ChatInfoResponse>(
    "GET",
    "/chat/v6/conversations/ares-parties",
  );

  return data.conversations?.[0] ?? null;
};

/**
 * getChatHistory - Lấy lịch sử tin nhắn của một cuộc hội thoại
 * Gọi API GET /chat/v6/messages
 * @param {string} [cid] - ID cuộc hội thoại (nếu không có, lấy tất cả)
 * @returns {Promise<LocalChatMessage[]>} Promise trả về mảng các tin nhắn
 */
export const getChatHistory = async (cid?: string): Promise<LocalChatMessage[]> => {
  const data = await riotLocalRequest<ChatHistoryResponse>(
    "GET",
    "/chat/v6/messages",
    undefined,
    cid ? { cid } : undefined,
  );

  return data.messages ?? [];
};

/**
 * sendPartyChatMessage - Gửi tin nhắn vào cuộc hội thoại party chat
 * Gọi API POST /chat/v6/messages/
 * @param {string} cid - ID cuộc hội thoại cần gửi tin nhắn
 * @param {string} message - Nội dung tin nhắn
 * @returns {Promise<LocalChatMessage[]>} Promise trả về mảng các tin nhắn (bao gồm tin vừa gửi)
 */
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
