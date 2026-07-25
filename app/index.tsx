// 📄 app/index.tsx — Màn hình khởi động (Splash screen thủ công)
// Hiển thị loading indicator trong khi app kiểm tra trạng thái đăng nhập
// và quyết định điều hướng sang setup, reauth hay profile.

import { View } from "react-native";
import Loading from "~/components/Loading";

/**
 * Index — Component mặc định khi route gốc "/" được mount.
 *
 * Chức năng:
 * - Render một View căn giữa toàn màn hình.
 * - Hiển thị <Loading /> (spinner/vòng quay) để giữ chân người dùng
 *   trong lúc RootLayout (_layout.tsx) thực hiện bootstrap logic
 *   (đọc region, khôi phục session, v.v.).
 *
 * Sau khi bootstrap hoàn tất, expo-router sẽ replace route này
 * bằng "/setup", "/reauth" hoặc "/profile".
 *
 * @returns {JSX.Element} Màn hình splash tạm thời.
 */
function Index() {
  return (
    <View
      style={{
        flex: 1,               // Chiếm toàn bộ không gian cha
        justifyContent: "center", // Căn giữa theo chiều dọc
        alignItems: "center",     // Căn giữa theo chiều ngang
      }}
    >
      <Loading />
    </View>
  );
}

export default Index;
