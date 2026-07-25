import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import { isExpoGo } from "~/utils/runtime";

// ─── StripeProviderProps ───────────────────────────────────────────────────────
//   - children: React node con
//   - publishableKey: string – khoá public Stripe

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

// ─── StripeProvider (universal) ────────────────────────────────────────────────
// Component wrapper StripeProvider cho cả web, native, và Expo Go.
// File này là entry point chính (mặc định) – được Expo Router dùng để tự động
// chọn platform-specific implementation.
//
// Logic:
//   - Nếu Platform.OS === "web" hoặc isExpoGo:
//     Stripe SDK native không áp dụng được => chỉ render children
//   - Nếu không (native standalone):
//     Import động NativeStripeProvider và bọc children vào provider
export default function StripeProvider({
  children,
  publishableKey,
}: StripeProviderProps) {
  if (Platform.OS === "web" || isExpoGo) {
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
