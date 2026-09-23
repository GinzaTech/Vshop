import { riotApiClient as axios } from "./client";
import { buildRiotApiUrl } from "./endpoints";
import { extraHeaders, getPlayerResourceKey } from "./request-context";
import { createRequestScope } from "./request-scope";

// Tên người chơi theo name-service: Subject = PUUID, GameName + TagLine hiển thị.
type PlayerName = { Subject: string; GameName: string; TagLine: string };

// TTL cache tên người chơi: 1 giờ — tên hiếm khi đổi nên cache dài là an toàn.
const PLAYER_NAME_CACHE_TTL_MS = 60 * 60 * 1000;

// Trần cache tên (LRU): giữ 500 entry gần dùng nhất, chống phình bộ nhớ.
const PLAYER_NAME_CACHE_MAX_SIZE = 500;

// Cache tên (memory only): key "region|subject" → { value, expiresAt, lastAccessed }.
const playerNameCache = new Map<
  string,
  { value: PlayerName; expiresAt: number; lastAccessed: number }
>();

// Request tên đang bay theo TỪNG subject: các consumer có danh sách chỉ
// trùng một phần vẫn dùng chung request — không bắn trùng PUT /name-service.
const playerNameRequests = new Map<string, Promise<void>>();
const playerNameScope = createRequestScope();
export function clearCachedPlayerNames() {
  playerNameScope.clear();
  playerNameCache.clear();
  playerNameRequests.clear();
}

// ---------------------------------------------------------------------------
// getPlayerNames - Giải mã danh sách UUID subject thành GameName/TagLine
// PUT /name-service với cache LRU 1h (max 500) + dedup in-flight per subject
// ---------------------------------------------------------------------------
/** Tra tên hàng loạt subject. Subject còn cache hạn không được fetch lại;
 *  phần thiếu gộp thành MỘT PUT — consumer gọi sau join request đang bay.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param subjects - Mảng PUUID (trùng/viết hoa được chuẩn hóa trước).
 *  @param region - Shard hợp lệ (đi vào cache key).
 *  @returns PlayerName[] CHỈ gồm subject tra được; subject thiếu bị lược
 *  bỏ — caller phải hiển thị fallback (vd "?"). */
export async function getPlayerNames(
  accessToken: string,
  entitlementsToken: string,
  subjects: string[],
  region: string
): Promise<PlayerName[]> {
  // Chuẩn hóa: lọc rỗng, lowercase, khử trùng lặp (Set).
  const normalizedSubjects = Array.from(
    new Set(subjects.map((subject) => subject.trim().toLowerCase()).filter(Boolean))
  );
  const resourceKey = (subject: string) => getPlayerResourceKey(region, subject);
  const scopes = new Map(normalizedSubjects.map((subject) => [
    subject, playerNameScope.observe(resourceKey(subject), accessToken, entitlementsToken),
  ]));
  const now = Date.now();
  // Chỉ fetch các subject chưa có cache hoặc cache đã hết hạn (TTL 1h).
  const missingSubjects = normalizedSubjects.filter((subject) => {
    const cached = playerNameCache.get(resourceKey(subject));
    return !cached || cached.expiresAt <= now;
  });

  if (missingSubjects.length > 0) {
    const pendingRequests = new Set<Promise<void>>();
    const subjectsToFetch = missingSubjects.filter((subject) => {
      const pending = playerNameRequests.get(scopes.get(subject)!.key());
      if (pending) {
        pendingRequests.add(pending);
        return false;
      }
      return true;
    });

    if (subjectsToFetch.length > 0) {
      const guards = subjectsToFetch.map((subject) => scopes.get(subject)!.start());
      const assertCurrent = () => guards.forEach((guard) => guard());
      const request = axios
        .request<PlayerName[]>({
          url: buildRiotApiUrl({ name: "name", region }),
          method: "PUT",
          headers: {
            ...extraHeaders(),
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Riot-Entitlements-JWT": entitlementsToken,
          },
          data: subjectsToFetch,
        })
        .then((res) => {
          assertCurrent();
          if (res.status !== 200 || !Array.isArray(res.data)) {
            throw new Error(
              `Name Service returned ${res.status} instead of a player list`
            );
          }

          const entries = res.data.filter((entry) =>
            entry && typeof entry.Subject === "string" && typeof entry.GameName === "string" &&
            typeof entry.TagLine === "string" && subjectsToFetch.includes(entry.Subject.toLowerCase())
          );
          entries.forEach((entry) => {
            const cacheKey = resourceKey(entry.Subject);
            if (!playerNameCache.has(cacheKey) && playerNameCache.size >= PLAYER_NAME_CACHE_MAX_SIZE) {
              const oldestKey = [...playerNameCache.entries()].sort(
                (a, b) => a[1].lastAccessed - b[1].lastAccessed
              )[0]?.[0];
              if (oldestKey) playerNameCache.delete(oldestKey);
            }
            playerNameCache.set(cacheKey, {
              value: entry,
              expiresAt: Date.now() + PLAYER_NAME_CACHE_TTL_MS,
              lastAccessed: Date.now(),
            });
          });
        })
        .catch((error: unknown) => {
          assertCurrent();
          throw error;
        })
        .finally(() => {
          subjectsToFetch.forEach((subject) => {
            const key = scopes.get(subject)!.key();
            if (playerNameRequests.get(key) === request) playerNameRequests.delete(key);
          });
        });

      subjectsToFetch.forEach((subject) => {
        playerNameRequests.set(scopes.get(subject)!.key(), request);
      });
      pendingRequests.add(request);
    }

    await Promise.all(pendingRequests);
  }

  scopes.forEach((scope) => scope.assertCurrent());

  // Trả kết quả từ cache theo thứ tự input; touch LRU (cập nhật lastAccessed).
  return normalizedSubjects.flatMap((subject) => {
    const key = resourceKey(subject);
    const cached = playerNameCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      playerNameCache.set(key, { ...cached, lastAccessed: Date.now() });
      return [cached.value];
    }
    return [];
  });
}
