import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { jwtDecode } from "jwt-decode";
import https from "https-browserify";
import { VCurrencies } from "~/utils/misc";
import { extraHeaders } from "~/services/riot/request-context";
import { getPlayerNames } from "~/services/riot/match-api";

// account-api.ts — Các API Riot phục vụ phiên tài khoản: entitlements token,
// user id, tên hiển thị, shop, ví tiền, tiến trình và luồng re-authentication.
// Mọi URL đều do services/riot/endpoints.ts sinh ra; request đi qua riotApiClient
// (services/riot/client.ts) để được log + phát hiện lỗi phiên 401/403 thống nhất.

/** Đổi access token lấy entitlements token (POST entitlements.auth.riotgames.com).
 *  Request POST body rỗng {} — mọi request Riot đọc dữ liệu đều cần JWT này.
 *  @param accessToken - Bearer token từ luồng auth Riot.
 *  @returns Entitlements token (string) trong response. */
export async function getEntitlementsToken(accessToken: string) {
  const res = await axios.request<EntitlementResponse>({
    url: buildRiotApiUrl({ name: "entitlements" }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: {},
  });
  return res.data.entitlements_token;
}

/** Giải mã JWT access token (local, KHÔNG gọi mạng) lấy UUID người dùng.
 *  Trường "sub" (subject) chính là PUUID dùng cho mọi endpoint per-player.
 *  @param accessToken - JWT cần giải mã (phần payload base64).
 *  @returns UUID người dùng (string "sub" trong payload). */
export function getUserId(accessToken: string) {
  const data = jwtDecode<{ sub: string }>(accessToken);
  return data.sub;
}

/** Lấy tên hiển thị của MỘT người dùng (GameName + TagLine).
 *  Gọi chung name-service với getPlayerNames (match-api) nên hưởng luôn
 *  cache 1h + dedup in-flight của hàm đó — không tạo thêm request mới.
 *  @param accessToken - Bearer token xác thực Riot.
 *  @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 *  @param userId - PUUID cần tra tên.
 *  @param region - Shard hợp lệ (ap/eu/kr/na/pbe).
 *  @returns { GameName, TagLine } — mỗi trường fallback "?" nếu không tra được. */
export async function getUsername(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string
) {
  const [player] = await getPlayerNames(
    accessToken,
    entitlementsToken,
    [userId],
    region
  );

  return {
    GameName: player?.GameName || "?",
    TagLine: player?.TagLine || "?",
  };
}

/** Lấy dữ liệu storefront v3 (shop chính, bundle, night market, accessory).
 *  POST /store/v3/storefront/:userId với body rỗng — response thô được
 *  trả nguyên trạng; parse có cấu trúc nằm ở services/riot/storefront-parser.
 *  @param accessToken - Bearer token xác thực Riot.
 *  @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 *  @param region - Shard hợp lệ quyết định host PD.
 *  @param userId - PUUID chủ shop.
 *  @returns StorefrontResponse từ Riot. */
export async function getShop(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<StorefrontResponse>({
    url: buildRiotApiUrl({ name: "storefront", region: region, userId: userId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: {},
  });
  return res.data;
}

/** Lấy số dư 4 loại tiền tệ (GET /store/v1/wallet/:userId trên PD).
 *  @param accessToken - Bearer token xác thực Riot.
 *  @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 *  @param region - Shard hợp lệ quyết định host PD.
 *  @param userId - PUUID chủ ví.
 *  @returns { vp, rad, fag, kc } — map trực tiếp từ Balances theo key
 *  VCurrencies tương ứng (VP/Radianite/Free Agent/Kingdom Credits). */
export async function getBalances(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<WalletResponse>({
    url: buildRiotApiUrl({ name: "wallet", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });

  return {
    vp: res.data.Balances[VCurrencies.VP],     // Valorant Points
    rad: res.data.Balances[VCurrencies.RAD],    // Radianite
    fag: res.data.Balances[VCurrencies.FAG],    // Free agent (?)
    kc: res.data.Balances[VCurrencies.KC],      // Kingdom Credits
  };
}

/** Lấy tiến trình tài khoản: cấp độ + XP (GET account-xp/v1/players/:userId).
 *  @param accessToken - Bearer token xác thực Riot.
 *  @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 *  @param region - Shard hợp lệ quyết định host PD.
 *  @param userId - PUUID cần tra tiến trình.
 *  @returns { level, xp } — Level hiện tại và XP trong level; response đầy đủ
 *  của Riot có thêm nhiều trường nhưng UI chỉ dùng 2 trường này. */
export async function getProgress(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<AccountXPResponse>({
    url: buildRiotApiUrl({ name: "playerxp", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return {
    level: res.data.Progress.Level,   // Cấp độ tài khoản
    xp: res.data.Progress.XP,          // Kinh nghiệm
  };
}

/** Tạo phiên re-authentication với Riot (POST auth.riotgames.com/authorization).
 *  Giả User-Agent Riot client; HTTPS agent cấu hình cipher TLS đặc thù
 *  (ChaCha20/AES-GCM, TLS 1.2+) để vượt hạn chế bắt tay của Riot auth.
 *  @param version - Phiên bản Riot client dùng giả mạo User-Agent.
 *  @returns AxiosResponse chứa uri xác thực; caller đi tiếp theo luồng cookie. */
export const reAuth = (version: string) =>
  axios.request({
    url: buildRiotApiUrl({ name: "auth" }),
    method: "POST",
    headers: {
      "User-Agent": `RiotClient/${version} rso-auth (Windows; 10;;Professional, x64)`,
      "Content-Type": "application/json",
    },
    data: {
      client_id: "play-valorant-web-prod",       // Client ID của Valorant web
      nonce: "1",
      redirect_uri: "https://playvalorant.com/opt_in",
      response_type: "token id_token",
      response_mode: "query",
      scope: "account openid",                    // Phạm vi quyền
    },
    // Cấu hình HTTPS agent với các cipher cụ thể (cần thiết cho Riot auth)
    httpsAgent: new https.Agent({
      ciphers: [
        "TLS_CHACHA20_POLY1305_SHA256",
        "TLS_AES_128_GCM_SHA256",
        "TLS_AES_256_GCM_SHA384",
        "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
      ].join(":"),
      honorCipherOrder: true,
      minVersion: "TLSv1.2",
    }),
    withCredentials: true,                        // Gửi kèm cookie
  });
