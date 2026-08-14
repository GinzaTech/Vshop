import React, { type PropsWithChildren } from "react";
import { RefreshControl } from "react-native";

import { COLORS } from "~/constants/DesignSystem";

type AppRefreshControlProps = PropsWithChildren<{
  refreshing: boolean;
  onRefresh: () => void;
  enabled?: boolean;
}>;

export default function AppRefreshControl({
  refreshing,
  onRefresh,
  enabled = true,
  children,
}: AppRefreshControlProps) {
  return (
    <RefreshControl
      enabled={enabled}
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.ACCENT]}
      tintColor={COLORS.ACCENT}
      progressBackgroundColor={COLORS.SURFACE}
    >
      {children}
    </RefreshControl>
  );
}
