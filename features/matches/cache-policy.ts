// --- Hằng số cấu hình ---
export const MATCH_CACHE_TTL_MS = 30 * 60 * 1000;       // TTL cache match (30 phút — giảm API calls)
export const MATCH_HISTORY_LIMIT = 20;                    // Giới hạn Riot API: 20 trận/request
export const INITIAL_FETCH_TOTAL = 30;                    // Tổng số trận tải lần đầu (2 requests)
export const DELTA_FETCH_LIMIT = 5;                       // Số trận kiểm tra khi delta sync (chỉ lấy mới)
export const MATCH_STORE_VERSION = 6;                     // Tăng version → nạp lại RR theo từng trận
export const MAX_DETAIL_CACHE_ENTRIES = 10;               // Memory cache only (không persist)
export const CELLULAR_INITIAL_DETAILS = 15;               // Hydrate 15/30 trận đầu trên 4G
export const WIFI_INITIAL_DETAILS = 30;                   // Hydrate hết 30 trận trên WiFi
export const MATCH_DETAIL_RETRY_DELAY_MS = 600;           // Delay giữa các lần retry khi fetch detail lỗi
export const SEASON_STATS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;   // TTL stats season: 2 giờ
export const SEASON_UPDATES_PAGE_SIZE = 20;                    // Số trận competitiveupdates/request
// Negative-cache cho lần tính season stats THẤT BẠI: không cho phép re-crawl
// cả Act (vài phút request) mỗi khi user identity đổi, chỉ retry sau 15 phút
// hoặc khi user chủ động pull-to-refresh (force).
export const SEASON_STATS_FAILURE_TTL_MS = 15 * 60 * 1000;
export const SEASON_STATS_CALCULATION_VERSION = 8;        // Outcome-aware: exclude cancelled/unknown matches.
export const SEASON_DETAIL_REQUEST_DELAY_MS = 1_000;      // Nghỉ giữa 2 request detail (chống rate-limit)
// Trần số match được persist xuống storage. Hydrate "load more" có thể phình
// vô hạn theo tháng dùng; cap này giữ giá trị MMKV ở mức hợp lý. Danh sách
// trong bộ nhớ vẫn đầy đủ, chỉ bản ghi xuống đĩa bị cắt.
export const MAX_PERSISTED_MATCHES = 200;
// Cửa sổ 5s để tính một mạng bị "traded" trong KAST (bị hạ rồi đồng đội báo thù).
export const KAST_TRADE_WINDOW_MS = 5_000;


export const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));
