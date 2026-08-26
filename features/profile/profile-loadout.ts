import type { PlayerLoadoutResponse } from "~/utils/valorant-api";
import {
  type EquippedSpray,
  type EquippedWeapon,
  type TabKey,
  WEAPON_NAME_ORDER,
} from "~/components/GalleryProfile";

export const PROFILE_TAB_KEYS: TabKey[] = ["loadout", "skins", "collection"];

export const truncateToOneDecimal = (value: number) =>
    Math.trunc(value * 10) / 10;
export const formatOneDecimal = (value: number) =>
    truncateToOneDecimal(value).toFixed(1);
export const formatPercentage = (value: number) =>
    `${formatOneDecimal(value)}%`;

/**
 * normalizeProfileWeaponCategory — Chuẩn hóa tên category của vũ khí.
 * Dùng để nhóm vũ khí theo loại (Sidearm, SMG, Shotgun, Sniper, Rifle, Heavy, Melee, Other).
 *
 * @param {string | undefined} category - Tên category gốc từ API.
 * @returns {string} Tên category đã chuẩn hóa.
 */
export const normalizeProfileWeaponCategory = (category?: string) => {
  const normalized = category?.trim().toLowerCase();

  if (!normalized) return "Other";
  if (normalized.includes("sidearm")) return "Sidearm";
  if (normalized.includes("smg")) return "SMG";
  if (normalized.includes("shotgun")) return "Shotgun";
  if (normalized.includes("sniper")) return "Sniper";
  if (normalized.includes("rifle")) return "Rifle";
  if (normalized.includes("heavy") || normalized.includes("machine gun")) {
    return "Heavy";
  }
  if (normalized.includes("melee") || normalized.includes("knife")) {
    return "Melee";
  }
  if (normalized.includes("other")) return "Other";

  return category?.trim() || "Other";
};

/**
 * formatUpgradeLevel — Format chuỗi hiển thị cấp độ nâng cấp skin.
 * VD: "3/5" (cấp hiện tại / tối đa). Skin chỉ có một cấp sẽ không hiện badge.
 *
 * @param {EquippedWeapon} weapon - Vũ khí có upgradeLevel.
 * @returns {string | null} Chuỗi hiển thị hoặc null nếu không có level.
 */
export const formatUpgradeLevel = (
    weapon: EquippedWeapon
) => {
  if (!weapon.upgradeLevel || weapon.maxUpgradeLevel === 1) {
    return null;
  }

  if (
      weapon.maxUpgradeLevel &&
      weapon.maxUpgradeLevel > 1
  ) {
    return `${weapon.upgradeLevel}/${weapon.maxUpgradeLevel}`;
  }

  return `${weapon.upgradeLevel}`;
};

/** Props cho CompactProfileSkinCard component. */

export const normalizeWeaponKey = (value?: string) =>
    (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/**
 * getProfileWeaponOrderIndex — Lấy index sắp xếp của vũ khí dựa trên WEAPON_NAME_ORDER.
 *
 * @param {string | undefined} weaponName - Tên vũ khí.
 * @returns {number} Index trong mảng, hoặc length nếu không tìm thấy.
 */
export const getProfileWeaponOrderIndex = (weaponName?: string) => {
  const normalizedWeaponName = normalizeWeaponKey(weaponName);
  const index = WEAPON_NAME_ORDER.findIndex(
      (name) => normalizeWeaponKey(name) === normalizedWeaponName
  );

  return index === -1 ? WEAPON_NAME_ORDER.length : index;
};

/**
 * delay — Promise-based setTimeout.
 *
 * @param {number} ms - Số milliseconds chờ.
 * @returns {Promise<void>} Promise resolve sau ms.
 */
export const delay = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

/**
 * sameOptionalId — So sánh hai optional ID (null/undefined/string).
 * Null và undefined được coi như nhau.
 *
 * @param {string | null | undefined} left
 * @param {string | null | undefined} right
 * @returns {boolean} true nếu giống nhau.
 */
export const sameOptionalId = (left?: string | null, right?: string | null) =>
    (left ?? null) === (right ?? null);

/**
 * normalizeVariantLabel — Trích xuất tên variant từ chroma name.
 * Nếu chromaName === skinName, trả về null.
 * Nếu chromaName bắt đầu bằng skinName, trả về phần suffix.
 *
 * @param {string} skinName - Tên skin gốc.
 * @param {string | undefined} chromaName - Tên chroma.
 * @returns {string | null} Tên variant hoặc null.
 */
export const normalizeVariantLabel = (skinName: string, chromaName?: string) => {
  if (!chromaName) {
    return null;
  }

  const baseName = skinName.trim();
  const variantName = chromaName.trim();

  if (!variantName || variantName.toLowerCase() === baseName.toLowerCase()) {
    return null;
  }

  if (variantName.toLowerCase().startsWith(baseName.toLowerCase())) {
    const suffix = variantName.slice(baseName.length).replace(/^[-:\s]+/, "");
    return suffix || null;
  }

  return variantName;
};

// ─── Type definitions ──────────────────────────────────────────────────────────
// Các type này định nghĩa cấu trúc dữ liệu cho picker modal và loadout updates.

/** OwnedSkinOption — Một option skin trong picker vũ khí. */
export type OwnedSkinOption = {
  id: string;
  skinId: string;
  skinLevelId: string;
  chromaId: string;
  name: string;
  chromaName?: string;
  image?: string;
  contentTierUuid?: string;
  contentTierName?: string;
  upgradeLevel?: number;        // Cấp nâng cấp hiện tại
  maxUpgradeLevel?: number;     // Cấp nâng cấp tối đa
  chromas: {                    // Danh sách chroma (biến thể màu)
    id: string;
    name: string;
    swatch?: string;            // Màu mẫu nhỏ
    image?: string;
    selected: boolean;          // Chroma đang được chọn?
  }[];
  selected: boolean;            // Skin này có đang được trang bị?
};

/** OwnedSprayOption — Một option spray trong picker spray. */
export type OwnedSprayOption = {
  id: string;
  sprayId: string;
  sprayLevelId: string | null;
  name: string;
  icon?: string;
  selected: boolean;
};

/** OwnedPlayerCardOption — Một option player card. */
export type OwnedPlayerCardOption = {
  id: string;
  name: string;
  image?: string;
  selected: boolean;
};

/** OwnedPlayerTitleOption — Một option player title. */
export type OwnedPlayerTitleOption = {
  id: string;
  name: string;
  selected: boolean;
};

/** ExpressionKind — Loại biểu cảm (spray hoặc flex). */
export type ExpressionKind = "spray" | "flex";

/** EquippedExpression — Một biểu cảm đã được trang bị. */
export type EquippedExpression = {
  slotIndex: number;
  kind: ExpressionKind;
  id: string;
  name: string;
  icon?: string;
};

/** OwnedExpressionOption — Một option biểu cảm trong picker. */
export type OwnedExpressionOption = {
  id: string;
  kind: ExpressionKind;
  assetId: string;
  name: string;
  icon?: string;
  selected: boolean;
};

/** PendingLoadoutUpdate — Một bản cập nhật loadout đang chờ xác nhận từ server. */
export type PendingLoadoutUpdate = {
  loadout: PlayerLoadoutResponse;
  updatedAt: number;
};

/** PickerState — State của picker modal, phân biệt theo type. */
export type PickerState =
    | {
  type: "weapon";
  weapon: EquippedWeapon;
  options: OwnedSkinOption[];
}
    | {
  type: "spray";
  spray: EquippedSpray;
  options: OwnedSprayOption[];
}
    | {
  type: "expression";
  expression: EquippedExpression;
  mode: ExpressionKind;
  options: OwnedExpressionOption[];
}
    | {
  type: "player-card";
  options: OwnedPlayerCardOption[];
}
    | {
  type: "player-title";
  options: OwnedPlayerTitleOption[];
};

/**
 * loadoutsMatch — So sánh hai đối tượng PlayerLoadoutResponse xem có giống nhau không.
 * So sánh: Guns (SkinID, SkinLevelID, ChromaID, CharmID, CharmLevelID),
 * Sprays (SprayID, SprayLevelID), ActiveExpressions (TypeID, AssetID),
 * Identity (PlayerCardID, PlayerTitleID).
 *
 * @param {PlayerLoadoutResponse | null | undefined} left - Loadout thứ nhất.
 * @param {PlayerLoadoutResponse | null | undefined} right - Loadout thứ hai.
 * @returns {boolean} true nếu giống nhau hoàn toàn.
 */
export const loadoutsMatch = (
    left?: PlayerLoadoutResponse | null,
    right?: PlayerLoadoutResponse | null
) => {
  if (!left || !right) {
    return false;
  }

  // So sánh Guns
  const gunsEqual =
      (left.Guns?.length ?? 0) === (right.Guns?.length ?? 0) &&
      (left.Guns ?? []).every((gun) => {
        const target = (right.Guns ?? []).find((item) => item.ID === gun.ID);
        return (
            target &&
            sameOptionalId(target.SkinID, gun.SkinID) &&
            sameOptionalId(target.SkinLevelID, gun.SkinLevelID) &&
            sameOptionalId(target.ChromaID, gun.ChromaID) &&
            sameOptionalId(target.CharmID, gun.CharmID) &&
            sameOptionalId(target.CharmLevelID, gun.CharmLevelID)
        );
      });

  // So sánh Sprays
  const spraysEqual =
      (left.Sprays?.length ?? 0) === (right.Sprays?.length ?? 0) &&
      (left.Sprays ?? []).every((spray) => {
        const target = (right.Sprays ?? []).find(
            (item) => item.EquipSlotID === spray.EquipSlotID
        );

        return (
            target &&
            sameOptionalId(target.SprayID, spray.SprayID) &&
            sameOptionalId(target.SprayLevelID, spray.SprayLevelID)
        );
      });

  // So sánh ActiveExpressions
  const leftExpressions = left.ActiveExpressions ?? [];
  const rightExpressions = right.ActiveExpressions ?? [];
  const expressionsEqual =
      leftExpressions.length === rightExpressions.length &&
      leftExpressions.every((expression, index) => {
        const target = rightExpressions[index];

        return (
            target &&
            target.TypeID.toLowerCase() === expression.TypeID.toLowerCase() &&
            sameOptionalId(target.AssetID, expression.AssetID)
        );
      });

  // So sánh Identity (PlayerCardID, PlayerTitleID)
  const identityEqual =
      sameOptionalId(left.Identity?.PlayerCardID, right.Identity?.PlayerCardID) &&
      sameOptionalId(left.Identity?.PlayerTitleID, right.Identity?.PlayerTitleID);

  return gunsEqual && spraysEqual && expressionsEqual && identityEqual;
};
