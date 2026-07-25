import type { PropsWithChildren } from "react";
import { isExpoGo } from "~/utils/runtime";

// ─── StripeProviderProps ───────────────────────────────────────────────────────
//   - children: React node con
//   - publishableKey: string – khoá public Stripe dùng để khởi tạo provider gốc

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

// ─── StripeProvider (native) ───────────────────────────────────────────────────
// Component wrapper StripeProvider dành riêng cho native (iOS/Android).
//
// Logic:
//   - Nếu đang chạy trong Expo Go (isExpoGo === true):
//     Stripe SDK native không hoạt động => chỉ render children mà không bọc
//   - Nếu không (standalone build):
//     Import động @stripe/stripe-react-native và render NativeStripeProvider
//     với publishableKey tương ứng
//
// Lý do import động: tránh crash nếu package chưa được cài trong môi trường Expo Go
export default function StripeProvider({
  children,
  publishableKey,
}: StripeProviderProps) {
  if (isExpoGo) {
    return <>{children}</>;
  }

  const NativeStripeProvider =
    require("@stripe/stripe-react-native").StripeProvider;

  return (
    <NativeStripeProvider publishableKey={publishableKey}>
      {children}
    </NativeStripeProvider>
  );
}
