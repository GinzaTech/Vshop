// Import axios để gọi HTTP request
import { riotApiClient as axios } from "~/services/riot/client";
// Import jwtDecode để decode JWT token
import { jwtDecode } from "jwt-decode";

type ValorantPasClaims = {
  affinities?: {
    chat?: string;
  };
};

/**
 * Public API: Lấy PAS (Platform Authentication Service) Token cho chat.
 * PAS Token là JWT dùng để xác thực với dịch vụ chat của Riot.
 * @param accessToken - Access token của user
 * @returns Promise<string> - Chuỗi JWT chứa PAS Token
 */
export async function getPASToken(accessToken: string): Promise<string> {
  const res = await axios.request({
    url: "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat",
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  // Trả về chuỗi JWT chứa PAS Token
  return res.data;
}

/**
 * Public API: Lấy chat affinity (khu vực chat) cho Valorant.
 * Gọi API Riot PAS, decode JWT trả về để lấy thông tin affinity.
 * Nếu thất bại, fallback về "us1".
 * @param accessToken - Access token của user
 * @param idToken - ID token của user
 * @returns Promise<string> - Chat affinity (VD: "us1", "eu", "kr1",...)
 */
export async function getChatAffinity(accessToken: string, idToken: string): Promise<string> {
  try {
    const res = await axios.request({
      url: "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: {
        id_token: idToken,
      }
    });
    
    // res.data thường là một JWT
    const decoded = jwtDecode<ValorantPasClaims>(res.data);
    return decoded?.affinities?.chat || "us1";
  } catch (error) {
    if (__DEV__) console.error("Lỗi khi lấy Chat Affinity, fallback về us1", error);
    return "us1";
  }
}
