// ===== confirm-loadout.ts – Xác nhận mutation loadout bằng dữ liệu server thật =====
// Sau khi PUT loadout (optimistic update), chưa chắc Riot đã "chốt" thay đổi.
// Hàm này đợi, rồi GET loadout mới nhất (force, không đọc cache) để xác nhận.

import { playerLoadout } from "~/services/riot/loadout-api";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import { getSessionGeneration } from "~/utils/session-operations";
import type { PendingLoadoutUpdate } from "./profile-loadout";

/** Credentials – Thông tin xác thực tối thiểu để gọi Riot API. */
type Credentials = {
  accessToken: string;
  entitlementsToken: string;
  region: string;
  id: string;
};

/**
 * confirmProfileLoadout – Xác nhận mutation với server, KHÔNG bao giờ xác nhận
 * bằng response PUT cache. Trình tự: đợi 650ms (Riot cần thời gian propagate) →
 * kiểm tra phiên + pending còn nguyên → GET loadout thật (force) → chỉ trả
 * kết quả nếu phiên chưa đổi, pending chưa bị thay và loadout khớp expected.
 *
 * @param {Credentials} user - Access/entitlements token + region + puuid.
 * @param {PlayerLoadoutResponse} expected - Loadout kỳ vọng sau mutation.
 * @param {PendingLoadoutUpdate} pending - Bản optimistic update đang chờ.
 * @param {Function} getPending - Đọc pending hiện tại (phát hiện bị thay).
 * @param {Function} matches - Predicate so khớp latest với expected.
 * @returns {Promise<PlayerLoadoutResponse | null>} Loadout mới nhất nếu xác nhận
 *   thành công; null nếu session đổi, pending bị thay, GET lỗi hoặc không khớp.
 */
export async function confirmProfileLoadout(
  user: Credentials,
  expected: PlayerLoadoutResponse,
  pending: PendingLoadoutUpdate,
  getPending: () => PendingLoadoutUpdate | null,
  matches: (latest: PlayerLoadoutResponse, expected: PlayerLoadoutResponse) => boolean,
) {
  const generation = getSessionGeneration();
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  if (generation !== getSessionGeneration() || getPending() !== pending) return null;
  const latest = await playerLoadout(
    user.accessToken, user.entitlementsToken, user.region, user.id, { force: true }
  ).catch(() => null);
  return generation === getSessionGeneration() && getPending() === pending &&
    latest && matches(latest, expected) ? latest : null;
}
