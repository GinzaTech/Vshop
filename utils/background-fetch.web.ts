/**
 * Đối tượng BackgroundFetch dành riêng cho nền tảng web.
 * Trên web không hỗ trợ background fetch native, nên tất cả phương thức đều là no-op.
 */
// Module BackgroundFetch với các phương thức giả (no-op) cho web
const BackgroundFetch = {
  NETWORK_TYPE_ANY: 0,               // Hằng số loại mạng (bất kỳ)
  registerHeadlessTask: () => {},    // Đăng ký task headless (không làm gì trên web)
  finish: () => {},                  // Đánh dấu task hoàn thành (không làm gì trên web)
  configure: async () => 0,          // Cấu hình BackgroundFetch (luôn trả về 0)
  stop: async () => {},              // Dừng BackgroundFetch (không làm gì trên web)
};

// Export module BackgroundFetch mặc định cho web
export default BackgroundFetch;
