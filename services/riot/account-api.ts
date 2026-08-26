import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { jwtDecode } from "jwt-decode";
import https from "https-browserify";
import { VCurrencies } from "~/utils/misc";
import { extraHeaders } from "~/services/riot/request-context";
import { getPlayerNames } from "~/services/riot/match-api";

// Export hàm lấy entitlements token từ access token
// Gọi API entitlements.auth.riotgames.com để lấy token quyền
// Parameters:
//   - accessToken: token xác thực Riot
// Returns: Promise<string> entitlements token
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

// Export hàm lấy User ID (subject) từ access token JWT
// Giải mã JWT và trả về trường "sub" (subject = UUID người dùng)
// Parameters:
//   - accessToken: JWT token cần giải mã
// Returns: string UUID người dùng
export function getUserId(accessToken: string) {
  const data = jwtDecode<{ sub: string }>(accessToken);
  return data.sub;
}

// Export hàm lấy tên hiển thị (GameName + TagLine) của người dùng
// Gọi API name-service của Riot
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - userId: UUID người dùng
//   - region: khu vực (na, eu, ap, ...)
// Returns: Promise<{ GameName: string, TagLine: string }>
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

// Export hàm lấy thông tin shop (cửa hàng) hiện tại của người dùng
// Gọi API storefront v3
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<StorefrontResponse> dữ liệu shop
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

// Export hàm lấy số dư các loại tiền tệ của người dùng
// Gọi API wallet
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<{ vp, rad, fag, kc }> số dư từng loại
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

// Export hàm lấy tiến trình tài khoản (cấp độ + kinh nghiệm)
// Gọi API account-xp
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<{ level: number, xp: number }>
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

// Export hàm re-authentication (đăng nhập lại) với Riot
// Gửi request đến auth.riotgames.com với User-Agent giả Riot client
// Sử dụng HTTPS agent với ciphers tùy chỉnh để bypass các hạn chế bảo mật
// Parameters:
//   - version: phiên bản Riot client để giả mạo User-Agent
// Returns: Promise<AxiosResponse> chứa URI xác thực
export const reAuth = (version: string) =>
  axios.request({
    url: "https://auth.riotgames.com/api/v1/authorization",
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
