/**
 * xmpp-buffer.ts — Quản lý buffer XMPP thô nhận từ TCP socket.
 *
 * Dữ liệu XMPP đến theo nhiều mảnh TCP; buffer gom lại rồi các hàm ở đây
 * quyết định khi nào cắt bớt để không tràn bộ nhớ, nhưng KHÔNG được cắt
 * một roster lớn đang truyền dở (Riot chia roster qua nhiều TCP chunk).
 */

// Namespace IQ roster của Riot — dùng để nhận diện IQ roster trong buffer.
const ROSTER_NAMESPACE = "jabber:iq:riotgames:roster";

// Ngưỡng kích hoạt cân nhắc cắt buffer (ký tự).
export const XMPP_BUFFER_TRIM_THRESHOLD = 50_000;
// Khi cắt, chỉ giữ 10.000 ký tự cuối (stanza cũ đã xử lý sẽ bị bỏ).
export const XMPP_BUFFER_TAIL_BYTES = 10_000;
// Trần tuyệt đối cho buffer đang chứa roster chưa hoàn chỉnh.
export const XMPP_MAX_INCOMPLETE_ROSTER_BYTES = 2_000_000;

/**
 * hasIncompleteRosterIq — Buffer có đang chứa một IQ roster CHƯA đóng </iq>
 * hay không. Riot có thể chia roster lớn qua nhiều TCP data event; nếu cắt
 * buffer lúc này thì roster sẽ không bao giờ parse nổi và màn Bạn bè treo
 * chờ tới timeout.
 * @param {string} buffer - Buffer XMPP thô hiện tại
 * @returns {boolean} true nếu có IQ roster chưa hoàn chỉnh trong buffer
 */
export function hasIncompleteRosterIq(buffer: string) {
  const namespaceIndex = buffer.indexOf(ROSTER_NAMESPACE);
  if (namespaceIndex < 0) return false;

  const iqStartIndex = buffer.lastIndexOf("<iq", namespaceIndex);
  if (iqStartIndex < 0) return false;

  return buffer.indexOf("</iq>", namespaceIndex) < 0;
}

/**
 * trimXmppBuffer — Cắt buffer để giới hạn bộ nhớ. Chỉ cắt khi vượt ngưỡng
 * 50.000 ký tự; nếu roster đang truyền dở thì giữ nguyên (tới trần 2MB),
 * còn lại chỉ giữ 10.000 ký tự cuối. Gọi sau mỗi lần processBuffer.
 * @param {string} buffer - Buffer XMPP hiện tại
 * @returns {string} Buffer đã cắt (hoặc nguyên bản nếu chưa cần cắt)
 */
export function trimXmppBuffer(buffer: string) {
  if (buffer.length <= XMPP_BUFFER_TRIM_THRESHOLD) return buffer;

  if (
    hasIncompleteRosterIq(buffer) &&
    buffer.length <= XMPP_MAX_INCOMPLETE_ROSTER_BYTES
  ) {
    return buffer;
  }

  return buffer.slice(-XMPP_BUFFER_TAIL_BYTES);
}
