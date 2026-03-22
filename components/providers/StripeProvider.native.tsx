import type { PropsWithChildren } from "react";
import { StripeProvider as NativeStripeProvider } from "@stripe/stripe-react-native";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

export default function StripeProvider({
  children,
  publishableKey,
}: StripeProviderProps) {
  return (
    <NativeStripeProvider publishableKey={publishableKey}>
      {children}
    </NativeStripeProvider>
  );
}
