import { PropsWithChildren, useEffect } from "react";
import { usePathname } from "expo-router";

// ─── PlausibleProvider ─────────────────────────────────────────────────────────
// Component bao bọc (wrapper) dùng để theo dõi (track) page view thông qua
// Plausible Analytics. Mỗi khi đường dẫn (pathname) thay đổi, nó tự động gửi
// sự kiện "pageview" lên Plausible.
//
// Props:
//   - children: React node con được render bên trong provider
//
// State & Hook:
//   - pathname (từ usePathname của expo-router): đường dẫn hiện tại của ứng dụng
//
// useEffect:
//   - Chạy lại mỗi khi pathname thay đổi
//   - Import động module plausible (~/utils/plausible) và gọi hàm capture
//     với event "pageview" kèm pathname hiện tại
//   - Lỗi được catch im lặng (catch(() => {})) để không crash app
//
// Return:
//   - children: render lại các component con, không thêm UI nào khác
export default function PlausibleProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();

  useEffect(() => {
    const trackPageView = async () => {
      // @ts-ignore
      const plausible = await import("~/utils/plausible");
      await plausible.capture("pageview", pathname);
    };

    trackPageView().catch(() => {});
  }, [pathname]);

  return children;
}
