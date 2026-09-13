import * as Network from "expo-network";
import { Platform } from "react-native";

// TTL của cache network profile: 15 giây. Tránh hỏi expo-network liên tục
// trong khi nhiều nơi (sync, prefetch, XMPP reconnect) cần biết trạng thái.
const NETWORK_PROFILE_TTL_MS = 15_000;

/**
 * NetworkProfile - Hồ sơ mạng hiện tại dùng để điều tiết hoạt động app.
 * @property {boolean} isConnected - Có kết nối Internet khả dụng hay không
 * @property {boolean} isCellular - Đang dùng dữ liệu di động (4G/5G) hay không
 * @property {number} requestConcurrency - Số request HTTP chạy song song tối đa
 * @property {number} imagePrefetchBatchSize - Số ảnh prefetch mỗi lô
 */
export type NetworkProfile = {
  isConnected: boolean;
  isCellular: boolean;
  requestConcurrency: number;
  imagePrefetchBatchSize: number;
};

// Cache in-memory kết quả đo gần nhất (kèm thời điểm hết hạn TTL).
let cachedProfile:
  | {
      value: NetworkProfile;
      expiresAt: number;
    }
  | null = null;

/**
 * conservativeProfile — Hồ sơ "thận trọng" dùng khi không đo được mạng
 * (expo-network lỗi hoặc platform không hỗ trợ): giả định đang dùng di động
 * và hạ concurrency xuống mức thấp nhất để không làm nghẽn kết nối.
 * @returns {NetworkProfile} Hồ sơ an toàn theo nền tảng đang chạy
 */
const conservativeProfile = (): NetworkProfile => ({
  isConnected: true,
  isCellular: Platform.OS !== "web",
  requestConcurrency: Platform.OS === "web" ? 4 : 2,
  imagePrefetchBatchSize: Platform.OS === "web" ? 6 : 2,
});

/**
 * getNetworkProfile — Lấy hồ sơ mạng hiện tại (có TTL 15s).
 * Dùng bởi các nơi cần điều tiết fetch (loadAssets, AppWarmup, reconnect...).
 * Kết quả được cache in-memory; hết hạn mới hỏi expo-network. Nếu đo lỗi,
 * trả về hồ sơ thận trọng và vẫn cache theo TTL để không retry dồn dập.
 * @param {object} [options] - Tùy chọn
 * @param {boolean} [options.force] - true: bỏ qua cache và đo lại ngay
 * @returns {Promise<NetworkProfile>} Hồ sơ mạng (không bao giờ throw)
 */
export async function getNetworkProfile(
  options: { force?: boolean } = {}
): Promise<NetworkProfile> {
  if (
    !options.force &&
    cachedProfile &&
    cachedProfile.expiresAt > Date.now()
  ) {
    return cachedProfile.value;
  }

  try {
    const state = await Network.getNetworkStateAsync();
    const isCellular = state.type === Network.NetworkStateType.CELLULAR;
    const value: NetworkProfile = {
      isConnected:
        state.isConnected !== false && state.isInternetReachable !== false,
      isCellular,
      requestConcurrency: isCellular ? 2 : 4,
      imagePrefetchBatchSize: isCellular ? 2 : 6,
    };

    cachedProfile = {
      value,
      expiresAt: Date.now() + NETWORK_PROFILE_TTL_MS,
    };

    return value;
  } catch {
    const value = conservativeProfile();
    cachedProfile = {
      value,
      expiresAt: Date.now() + NETWORK_PROFILE_TTL_MS,
    };
    return value;
  }
}

/**
 * mapWithConcurrency — Chạy worker trên từng phần tử của mảng với số luồng
 * song song bị giới hạn (dựa trên requestConcurrency của mạng). Thứ tự kết
 * quả luôn khớp thứ tự input, kể cả khi worker hoàn thành lệch nhau.
 * Dùng bởi valorant-assets để fetch nhiều danh sách assets song song.
 * @template T - Kiểu phần tử đầu vào
 * @template TResult - Kiểu kết quả của worker
 * @param {readonly T[]} items - Danh sách phần tử cần xử lý
 * @param {number} concurrency - Số luồng song song tối đa (tối thiểu 1)
 * @param {(item: T, index: number) => Promise<TResult>} worker - Hàm xử lý 1 phần tử
 * @returns {Promise<TResult[]>} Mảng kết quả theo đúng thứ tự items;
 *   rejects nếu bất kỳ worker nào throw
 */
export async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    })
  );

  return results;
}
