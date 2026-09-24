import type { ReactNode } from "react";
import { useIsFocused } from "expo-router";

/**
 * Secondary tab routes are declared inside the Expo Router Tabs navigator but
 * must not retain their heavy native/React trees after blur. The navigator may
 * keep its lightweight screen wrapper attached for warm primary tabs; this
 * boundary removes secondary content as soon as focus leaves it.
 */
export default function SecondaryTabScene({
  children,
}: {
  children: ReactNode;
}) {
  return useIsFocused() ? children : null;
}
