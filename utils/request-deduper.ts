/**
 * Shares an in-flight request by a stable key and releases it as soon as the
 * request settles. It prevents duplicate network calls without turning a
 * failed request into a long-lived cache entry.
 */
/**
 * createRequestDeduper — Tạo một bộ gộp request đang chạy (in-flight) theo
 * key ổn định. Caller gọi cùng key trong khi request cũ chưa xong sẽ nhận
 * CHUNG promise đó (không bắn request mới). Ngay khi request settle (kể cả
 * lỗi) thì key được giải phóng — lỗi không bị "cache" vĩnh viễn, lần sau
 * sẽ thử lại từ đầu.
 * @template T - Kiểu kết quả của request
 * @returns {{ run, clear }} Đối tượng chứa:
 *   - run(key, createRequest): chạy hoặc join request đang chạy cùng key
 *   - clear(): xoá toàn bộ trạng thái (gọi khi đổi session/account)
 */
export function createRequestDeduper<T>() {
  const requests = new Map<string, Promise<T>>();

  return {
    run(key: string, createRequest: () => Promise<T>): Promise<T> {
      const existing = requests.get(key);
      if (existing) {
        return existing;
      }

      const request = createRequest();
      requests.set(key, request);
      const release = () => {
        if (requests.get(key) === request) {
          requests.delete(key);
        }
      };
      void request.then(release, release);
      return request;
    },
    clear() {
      requests.clear();
    },
  };
}
