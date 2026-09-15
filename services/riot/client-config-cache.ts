import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import { createRequestScope } from "~/services/riot/request-scope";

// ---------------------------------------------------------------------------
// Riot Client Config (cấu hình Riot client)
// ---------------------------------------------------------------------------

// FIX (L9): cache TTL 5 phút + in-flight dedup. Trước đây data-sync (bootstrap
// sync) và chat-service (resolveChatHost) gọi song song lúc startup → 2 request
// giống hệt nhau bắn cùng lúc. Config ít đổi nên TTL 5 phút là an toàn.
const clientConfigScope = createRequestScope();
// This authenticated /config/player response may differ between players.
// No account id is available here, so cache by the opaque credential identity.
const clientConfigCache = new Map<string, { value: RiotClientConfigResponse; expiresAt: number }>();
const clientConfigInFlight = new Map<string, Promise<RiotClientConfigResponse | null>>();
const CLIENT_CONFIG_TTL_MS = 5 * 60 * 1000;

export function clearRiotClientConfigCache() {
  clientConfigScope.clear();
  clientConfigCache.clear();
  clientConfigInFlight.clear();
}

/**
 * Lấy cấu hình Riot client (riotclientconfig) với cache 5 phút + dedup
 * in-flight: nhiều caller cùng lúc chỉ tạo đúng 1 HTTP request.
 * Chỉ kết quả THÀNH CÔNG (HTTP 200) được cache — fail thì lần sau thử lại.
 * @param accessToken - Bearer token xác thực Riot.
 * @param entitlementsToken - JWT quyền (X-Riot-Entitlements-JWT).
 * @returns Data khi HTTP 200; null khi lỗi (cache value cũng có thể là null).
 */
export async function getRiotClientConfig(
  accessToken: string,
  entitlementsToken: string
): Promise<RiotClientConfigResponse | null> {
  const scope = clientConfigScope.observe("client-config", accessToken, entitlementsToken);
  const key = scope.key();
  const cached = clientConfigCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const existing = clientConfigInFlight.get(key);
  if (existing) return existing;
  const assertCurrent = scope.start();

  const request = (async () => {
    const res = await axios.request<RiotClientConfigResponse>({
      url: buildRiotApiUrl({ name: "riotclientconfig" }),
      method: "GET",
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Riot-Entitlements-JWT": entitlementsToken,
      },
    });
    assertCurrent();
    const value = res.status === 200 ? res.data : null;
    // Chỉ cache kết quả THÀNH CÔNG — fail thì chu kỳ sau được thử lại ngay.
    if (value) {
      clientConfigCache.clear();
      clientConfigCache.set(key, { value, expiresAt: Date.now() + CLIENT_CONFIG_TTL_MS });
    }
    return value;
  })().catch((error: unknown) => {
    assertCurrent();
    throw error;
  }).finally(() => {
    if (clientConfigInFlight.get(key) === request) clientConfigInFlight.delete(key);
  });
  clientConfigInFlight.set(key, request);
  return request;
}
