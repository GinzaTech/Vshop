// ===== CollectionCheckerExport.web.tsx =====
// Bản web (platform .web) của CollectionCheckerExport: tính năng xuất ảnh
// bộ sưu tập cần expo-media-library nên bị tắt trên web.
// Cung cấp cùng tên export của bản native nhưng là stub no-op.
import React from "react";

import type { OwnedWeaponCollectionItem } from "~/components/GalleryProfile";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";

// CheckerBalances: Số dư 3 loại tiền tệ (VP, Radianite, Kingdom Credits)
type CheckerBalances = {
  vp: number;
  rad: number;
  kc: number;
};

// CollectionCheckerProfile: Hồ sơ người chơi hiển thị trên ảnh bộ sưu tập
// (tên, tag, region, level, avatar, rank, số dư)
export type CollectionCheckerProfile = {
  gameName: string;
  tagLine?: string;
  region: string;
  level: number;
  avatarUri?: string;
  avatarCacheId?: string;
  rank: CompetitiveRankSummary | null;
  balances: CheckerBalances;
};

/**
 * CollectionCheckerExportProviderProps – Props của provider (đối xứng bản
 * native, giữ nguyên contract để caller không cần if-platform).
 *
 * @param items – Danh sách vũ khí trong bộ sưu tập (bị bỏ qua trên web).
 * @param profile – Hồ sơ người chơi (bị bỏ qua trên web).
 * @param disabled – (tuỳ chọn) Flag tắt nút xuất (bị bỏ qua trên web).
 * @param children – Node con được render xuyên qua.
 */
type CollectionCheckerExportProviderProps = {
  items: OwnedWeaponCollectionItem[];
  profile: CollectionCheckerProfile;
  disabled?: boolean;
  children: React.ReactNode;
};

/**
 * CollectionCheckerExportProvider – Stub web: chỉ render children.
 *
 * @param children – Node con.
 * @returns children nguyên ven (không có context export trên web).
 */
export function CollectionCheckerExportProvider({
  children,
}: CollectionCheckerExportProviderProps) {
  return children;
}

/**
 * CollectionCheckerExport – Stub web: không render nút tải ảnh nào cả.
 *
 * @returns null (tính năng xuất ảnh chỉ có trên native).
 */
export function CollectionCheckerExport() {
  return null;
}
