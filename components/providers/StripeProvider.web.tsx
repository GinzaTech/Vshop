import type { PropsWithChildren } from "react";

// ─── StripeProviderProps ───────────────────────────────────────────────────────
//   - children: React node con
//   - publishableKey: string – khoá public Stripe (dù không dùng đến trên web
//     vì Web Stripe JS tự load từ script, nhưng giữ interface thống nhất)

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

// ─── StripeProvider (web) ──────────────────────────────────────────────────────
// Component wrapper StripeProvider dành riêng cho web.
//
// Trên web, Stripe sử dụng @stripe/stripe-js script riêng (thường load qua
// StripeElements hoặc useStripe hook), không cần Provider component native.
// Do đó component này chỉ là pass-through: render children trực tiếp.
//
// Props:
//   - children: React node con
//   - publishableKey: được khai báo trong type nhưng không dùng đến
export default function StripeProvider({
  children,
}: StripeProviderProps) {
  return <>{children}</>;
}
