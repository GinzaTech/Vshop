import axios from "axios";
import { jwtDecode } from "jwt-decode";

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
    const decoded = jwtDecode<any>(res.data);
    return decoded?.affinities?.chat || "us1";
  } catch (error) {
    console.error("Lỗi khi lấy Chat Affinity, fallback về us1", error);
    return "us1";
  }
}
