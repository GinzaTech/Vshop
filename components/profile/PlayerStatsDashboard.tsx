// Player statistics dashboard data bridge.
// The legacy dashboard component has been replaced by PlayerInfoView
// (components/profile/PlayerInfoView.tsx). This module intentionally stays
// as the stable import surface for the shared aggregation helper and the
// dashboard tab type consumed by ProfileScreen, PlayerInfoView and tests.
export { aggregateMatches } from "./player-stats-data";
export type { AggregateRow } from "./player-stats-data";

// StatsDashboardTab: Hai tab của dashboard - tổng quan và chi tiết
export type StatsDashboardTab = "overview" | "details";
