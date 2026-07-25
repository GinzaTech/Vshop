// Kiểu hàm dịch thuật: nhận key và trả về chuỗi đã được dịch
type TranslateFn = (key: string) => string;

// Ánh xạ tên queue (hàng chờ) từ raw token sang tên hiển thị bằng tiếng Anh
// Dùng làm fallback khi không tìm thấy key dịch thuật
const HUMAN_LABELS: Record<string, string> = {
  bombgamemode: "Standard",         // Chế độ tiêu chuẩn (đặt bom)
  unrated: "Standard",              // Chế độ không xếp hạng
  competitive: "Competitive",       // Chế độ xếp hạng
  ranked: "Competitive",            // Chế độ xếp hạng (từ đồng nghĩa)
  swiftplay: "Swiftplay",          // Chế độ chơi nhanh
  spikerush: "Spike Rush",         // Chế độ Spike Rush
  escalation: "Escalation",        // Chế độ leo thang
  teamdeathmatch: "Team Deathmatch", // Chế độ tử chiến đồng đội
  deathmatch: "Deathmatch",        // Chế độ tử chiến
  customgame: "Custom",            // Chế độ tùy chỉnh
  custom: "Custom",                // Chế độ tùy chỉnh (dạng rút gọn)
};

// Hàm chuẩn hóa token queue: chuyển về chữ thường, loại bỏ ký tự không phải chữ cái
// Input: giá trị string hoặc null/undefined
// Output: chuỗi đã chuẩn hóa hoặc chuỗi rỗng
const normalizeQueueToken = (value?: string | null) =>
  value
    ?.toLowerCase()                          // Chuyển về chữ thường
    .replace(/[^a-z]/g, "") || "";           // Giữ lại chỉ các chữ cái a-z

// Hàm chuyển đổi raw token thành tên thân thiện với người dùng (human-readable)
// Input: giá trị string hoặc null/undefined
// Output: chuỗi đã được format (vd: "GameModeCompetitive" -> "Game Mode Competitive")
const toHumanToken = (value?: string | null) => {
  if (!value) return "";

  // Lấy segment cuối cùng sau dấu /
  const finalSegment = value.split("/").filter(Boolean).pop() || value;
  // Làm sạch chuỗi: bỏ hậu tố _c, đuôi file, tách camelCase, thay dấu gạch bằng khoảng trắng
  const cleaned = finalSegment
    .replace(/_c$/i, "")                     // Bỏ hậu tố _c (có thể là _c = competitive)
    .replace(/\.[^.]+$/g, "")               // Bỏ đuôi file (.json, .txt, ...)
    .replace(/([a-z])([A-Z])/g, "$1 $2")    // Tách camelCase thành các từ riêng
    .replace(/[_-]+/g, " ")                 // Thay dấu gạch dưới/gạch ngang bằng space
    .replace(/\s+/g, " ")                   // Chuẩn hóa nhiều space thành 1
    .trim();

  if (!cleaned) return "";

  // Viết hoa chữ cái đầu mỗi từ, phần còn lại viết thường
  return cleaned
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
};

// Hàm xác định queue key (để tra cứu file ngôn ngữ) dựa trên raw token
// Input: raw string từ API của Riot
// Output: key chuẩn hóa (standard, competitive, deathmatch, ...) hoặc null nếu không xác định được
const getQueueKey = (raw?: string | null) => {
  const normalized = normalizeQueueToken(raw);

  if (!normalized) return null;

  // Kiểm tra các chuỗi con để xác định loại queue
  if (normalized.includes("teamdeathmatch")) return "team_deathmatch";
  if (normalized.includes("deathmatch")) return "deathmatch";
  if (normalized.includes("competitive") || normalized.includes("ranked")) {
    return "competitive";
  }
  if (normalized.includes("swiftplay")) return "swiftplay";
  if (normalized.includes("spikerush")) return "spike_rush";
  if (normalized.includes("escalation")) return "escalation";
  if (normalized.includes("bombgamemode") || normalized.includes("unrated")) {
    return "standard";
  }
  if (normalized.includes("custom")) return "custom";

  return null;
};

// Export hàm format tên queue (hàng chờ) để hiển thị trên giao diện session
// Parameters:
//   - raw: raw queue string từ API Riot (có thể null/undefined)
//   - t: hàm dịch thuật (i18n)
//   - fallbackKey: key fallback khi không parse được (mặc định là "combat_session_page.unknown_queue")
// Returns: chuỗi tên queue đã được dịch hoặc format
export const formatSessionQueueLabel = (
  raw: string | null | undefined,
  t: TranslateFn,
  fallbackKey = "combat_session_page.unknown_queue"
) => {
  // Thử tra cứu key dịch thuật trước
  const queueKey = getQueueKey(raw);
  if (queueKey) {
    return t(`session_labels.queue.${queueKey}`);
  }

  // Fallback: parse tên thân thiện từ raw token
  const humanToken = toHumanToken(raw);
  if (humanToken) {
    const normalized = normalizeQueueToken(raw);
    const alias = HUMAN_LABELS[normalized];
    return alias || humanToken;
  }

  // Nếu không parse được, trả về fallback
  return t(fallbackKey);
};

// Export hàm format nhãn quyền truy cập party (nhóm)
// Parameters:
//   - raw: raw access string (OPEN/CLOSED)
//   - t: hàm dịch thuật
// Returns: chuỗi đã dịch tương ứng với quyền truy cập
export const formatPartyAccessLabel = (
  raw: string | null | undefined,
  t: TranslateFn
) => {
  const normalized = (raw || "").trim().toUpperCase();

  if (normalized === "OPEN") return t("session_labels.access.open");       // Nhóm công khai
  if (normalized === "CLOSED") return t("session_labels.access.closed");    // Nhóm riêng tư

  return t("combat_session_page.unavailable");                             // Không xác định
};

// Export hàm tính sức chứa tối đa của party dựa trên loại queue
// Parameters:
//   - queueId: ID của queue (hàng chờ)
//   - customMode: chế độ tùy chỉnh (nếu queueId là custom)
//   - customPartySize: kích thước party tùy chỉnh (nếu có)
// Returns: số lượng người tối đa trong party
export const getSessionPartyCapacity = ({
  queueId,
  customMode,
  customPartySize,
}: {
  queueId?: string | null;
  customMode?: string | null;
  customPartySize?: number | null;
}) => {
  const normalized = normalizeQueueToken(queueId || customMode);

  // Chế độ custom: dùng customPartySize hoặc mặc định 5
  if (normalized.includes("custom")) {
    return customPartySize && customPartySize > 0 ? customPartySize : 5;
  }

  // Các chế độ 5 người: standard, competitive, swiftplay, spikerush, escalation, deathmatch đồng đội
  if (
    normalized.includes("bombgamemode") ||
    normalized.includes("competitive") ||
    normalized.includes("ranked") ||
    normalized.includes("swiftplay") ||
    normalized.includes("spikerush") ||
    normalized.includes("escalation") ||
    normalized.includes("teamdeathmatch") ||
    normalized.includes("unrated")
  ) {
    return 5;
  }

  // Deathmatch: 1 người (free-for-all)
  if (normalized.includes("deathmatch")) {
    return 1;
  }

  // Mặc định: customPartySize hoặc 5
  return customPartySize && customPartySize > 0 ? customPartySize : 5;
};
