import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import { isExpoGo } from "~/utils/runtime";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
}>;

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
