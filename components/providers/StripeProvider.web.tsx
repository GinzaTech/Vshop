import type { PropsWithChildren } from "react";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

export default function StripeProvider({
  children,
}: StripeProviderProps) {
  return <>{children}</>;
}
