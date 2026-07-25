// Import thư viện Sentry để theo dõi lỗi và crash reporting
import * as Sentry from "@sentry/react";

// Khởi tạo Sentry với DSN (Data Source Name) của dự án
// DSN này định danh dự án trên Sentry và nơi gửi dữ liệu lỗi
Sentry.init({
    // DSN: endpoint gửi dữ liệu lỗi lên Sentry
    dsn: "https://4ee1fb59e49a32770ac42572523d52f8@o4511167879512064.ingest.us.sentry.io/4511167880364032",
    // Bật gửi PII (Personal Identifiable Information): IP address, user agent, ...
    // Giúp debug dễ hơn nhưng cần cân nhắc về quyền riêng tư
    sendDefaultPii: true
});

// Lấy element root từ DOM (index.html) để render ứng dụng React
const container = document.getElementById("app");
// Tạo root React để render
const root = createRoot(container);
// Render component App chính vào DOM
root.render(<App />);