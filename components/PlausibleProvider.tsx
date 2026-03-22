import { PropsWithChildren, useEffect } from "react";
import { usePathname } from "expo-router";

export default function PlausibleProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();

  useEffect(() => {
    const trackPageView = async () => {
      const plausible = await import("~/utils/plausible");
      await plausible.capture("pageview", pathname);
    };

    trackPageView().catch(() => {});
  }, [pathname]);

  return children;
}
