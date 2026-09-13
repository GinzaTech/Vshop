/**
 * session-operations.ts — Điều phối các thao tác lên phiên Riot.
 *
 * Vấn đề được giải quyết: native networking (axios) và WebView dùng chung
 * một cookie jar Riot. Nếu request re-auth và thao tác dữ liệu chạy song
 * song, cookie có thể bị ghi đè giữa chừng. runSessionOperation xếp hàng mọi
 * thao tác chạy tuần tự; generation tăng khi phiên đổi giúp phát hiện thao
 * tác "lạc hậu" của phiên cũ và hủy nó bằng SessionChangedError.
 */

/** Hàng đợi toàn cục: đảm bảo các thao tác trên phiên chạy tuần tự. */
let pendingOperation: Promise<unknown> = Promise.resolve();
// Tăng lên 1 mỗi khi phiên bị thay đổi/hủy (đăng nhập mới, re-auth...).
let generation = 0;
// Cờ: đang có luồng đăng nhập/re-auth tương tác của user chạy hay không.
let interactiveAuthentication = false;

/**
 * SessionChangedError — Lỗi thrown khi phiên Riot thay đổi giữa chừng khiến
 * kết quả của một thao tác không còn hợp lệ (caller phải bỏ kết quả đó).
 */
export class SessionChangedError extends Error {
  readonly code = "SESSION_CHANGED";

  constructor() {
    super("The active Riot session changed while a request was running");
    this.name = "SessionChangedError";
  }
}

/**
 * isSessionChangedError — Kiểm tra một error có phải SessionChangedError không.
 * @param {unknown} error - Error bất kỳ
 * @returns {boolean} true nếu lỗi do phiên đã thay đổi
 */
export const isSessionChangedError = (error: unknown) =>
  (error as { code?: string } | undefined)?.code === "SESSION_CHANGED";

/**
 * getSessionGeneration — Số hiệu "thế hệ" phiên hiện tại. Thao tác dài chụp
 * giá trị này lúc bắt đầu và so sánh lúc ghi để phát hiện phiên đã
 * đổi (giống assertCurrent trong data-sync).
 * @returns {number} Generation hiện tại (0-based, tăng dần)
 */
export const getSessionGeneration = () => generation;
/**
 * isInteractiveAuthentication — Có đang chạy luồng đăng nhập/re-auth tương
 * tác (user đang gõ mật khẩu, OTP...) hay không. Background refresh nên
 * nhường đường trong lúc này.
 * @returns {boolean} true nếu đang có luồng tương tác
 */
export const isInteractiveAuthentication = () => interactiveAuthentication;

/**
 * setInteractiveAuthentication — Bật/tắt cờ luồng tương tác và LUÔN tăng
 * generation: mọi thao tác nền đang chạy với generation cũ sẽ được coi là
 * lỗi thời (stale) và tự bỏ kết quả.
 * @param {boolean} active - true khi bắt đầu, false khi kết thúc luồng tương tác
 */
export const setInteractiveAuthentication = (active: boolean) => {
  interactiveAuthentication = active;
  generation += 1;
};

/**
 * invalidateSessionOperations — Đánh dấu phiên đã đổi (tăng generation) mà
 * không có luồng tương tác nào. Kết quả của các thao tác nền đang chạy sẽ
 * bị bỏ qua bởi caller kiểm tra generation.
 */
export const invalidateSessionOperations = () => { generation += 1; };

/**
 * runSessionOperation — Chạy một thao tác trong hàng đợi toàn cục, bảo đảm
 * KHÔNG có hai thao tác trên cookie jar Riot chạy song song. Thao tác sau
 * đợi thao tác trước hoàn tất (thành công hay thất bại); lỗi của thao tác
 * trước không chặn hàng đợi (pendingOperation nuốt lỗi riêng).
 * @template T - Kiểu kết quả của thao tác
 * @param {() => Promise<T>} operation - Thao tác cần chạy tuần tự
 * @returns {Promise<T>} Promise của thao tác (reject nếu operation throw)
 */
export function runSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingOperation.then(operation);
  pendingOperation = result.catch(() => undefined);
  return result;
}
