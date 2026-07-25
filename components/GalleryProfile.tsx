// ===== GalleryProfile.tsx =====
// File chứa các type định nghĩa, hằng số và hàm tiện ích cho Gallery (thư viện vũ khí, skin, equipment).
import type { TFunction } from "i18next";

// FALLBACK_IMAGE: Ảnh mặc định khi không có ảnh thật
export const FALLBACK_IMAGE = require("~/assets/images/noimage.png");

// CATEGORY_ORDER: Thứ tự sắp xếp các danh mục vũ khí
export const CATEGORY_ORDER = [
  "Sidearm",
  "SMG",
  "Shotgun",
  "Rifle",
  "Sniper",
  "Heavy",
  "Melee",
  "Other",
] as const;

// WEAPON_NAME_ORDER: Thứ tự sắp xếp tên vũ khí
export const WEAPON_NAME_ORDER = [
  "Classic",
  "Shorty",
  "Frenzy",
  "Ghost",
  "Sheriff",
  "Stinger",
  "Spectre",
  "Bucky",
  "Judge",
  "Bulldog",
  "Guardian",
  "Phantom",
  "Vandal",
  "Marshal",
  "Outlaw",
  "Operator",
  "Ares",
  "Odin",
  "Melee",
] as const;

// SPRAY_SLOT_TRANSLATIONS: Map từ UUID slot spray sang key dịch
// Các UUID này đại diện cho slot spray 1, 2, 3
const SPRAY_SLOT_TRANSLATIONS: Record<string, string> = {
  "5863985E-43AC-B05D-CB2D-139E72970014": "spray1",
  "7CDC908E-4F69-9140-A604-899BD879EED1": "spray2",
  "0814B2FE-4512-60A4-5288-1FBDCEC6CA48": "spray3",
};

// SPRAY_SLOT_KEY_ALIASES: Map các dạng viết khác nhau của key spray slot về key chuẩn
// Xử lý các biến thể: dấu gạch dưới, lowercase, không dấu gạch
const SPRAY_SLOT_KEY_ALIASES: Record<string, string> = {
  spray_1: "spray1",
  spray_2: "spray2",
  spray_3: "spray3",
  any_round: "anyround",
  first_half: "firsthalf",
  second_half: "secondhalf",
  sudden_death: "sudden_death",
  "5863985e_43ac_b05d_cb2d_139e72970014": "spray1",
  "5863985e43acb05dcb2d139e72970014": "spray1",
  "7cdc908e_4f69_9140_a604_899bd879eed1": "spray2",
  "7cdc908e4f699140a604899bd879eed1": "spray2",
  "0814b2fe_4512_60a4_5288_1fbdcec6ca48": "spray3",
  "0814b2fe451260a452881fbdcec6ca48": "spray3",
};

// KNOWN_SPRAY_SLOT_KEYS: Set các key slot spray đã biết (để kiểm tra hợp lệ)
const KNOWN_SPRAY_SLOT_KEYS = new Set([
  "spray1",
  "spray2",
  "spray3",
  "firsthalf",
  "secondhalf",
  "any",
  "anyround",
  "pregame",
  "postround",
  "sudden_death",
  "default",
]);

// UUID_PATTERN: Regex kiểm tra định dạng UUID tiêu chuẩn (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TabKey: Các tab trong gallery - loadout, skins, collection
export type TabKey = "loadout" | "skins" | "collection";

// PlayerLoadoutGun: Interface cho một khẩu súng trong loadout của người chơi
// ID: UUID của vũ khí
// SkinID: UUID của skin đang trang bị
// SkinLevelID: UUID của cấp độ skin
// ChromaID: UUID của chroma (màu)
export interface PlayerLoadoutGun {
  ID: string;
  SkinID: string;
  SkinLevelID: string;
  ChromaID: string;
  CharmInstanceID?: string;
  CharmID?: string;
  CharmLevelID?: string;
}

// PlayerLoadoutSpray: Interface cho một spray trong loadout
export interface PlayerLoadoutSpray {
  EquipSlotID: string;
  SprayID: string;
  SprayLevelID: string | null;
}

// PlayerLoadoutIdentity: Interface cho thông tin định danh người chơi
export interface PlayerLoadoutIdentity {
  PlayerCardID: string;
  PlayerTitleID: string;
  AccountLevel: number;
  PreferredLevelBorderID: string;
  HideAccountLevel: boolean;
}

// PlayerLoadoutData: Interface tổng thể cho dữ liệu loadout
export interface PlayerLoadoutData {
  Guns: PlayerLoadoutGun[];
  Sprays: PlayerLoadoutSpray[];
  ActiveExpressions?: {
    TypeID: string;
    AssetID: string;
  }[];
  DynamicOptions?: Record<string, unknown>;
  Identity: PlayerLoadoutIdentity;
}

// WeaponMetadata: Interface cho metadata của vũ khí
export interface WeaponMetadata {
  uuid: string;
  displayName: string;
  category?: string;
  shopData?: {
    categoryText?: string;
  };
  skins?: {
    uuid: string;
  }[];
}

export type WeaponMetadataMap = Record<string, WeaponMetadata>;

// EquippedWeapon: Interface cho vũ khí đã trang bị (với skin, chroma, buddy)
export interface EquippedWeapon {
  weaponId: string;
  weaponName: string;
  category: string;
  skinId: string;
  skinLevelId: string;
  chromaId: string;
  charmInstanceId?: string;
  charmId?: string;
  charmLevelId?: string;
  skinName: string;
  skinLevelName?: string;
  chromaName?: string;
  image?: string;
  buddyName?: string;
  buddyIcon?: string;
  contentTierUuid?: string;
  contentTierName?: string;
  upgradeLevel?: number;
  maxUpgradeLevel?: number;
}

// OwnedWeaponCollectionItem: Mở rộng từ EquippedWeapon, thêm collectionId
export interface OwnedWeaponCollectionItem extends EquippedWeapon {
  collectionId: string;
}

// EquippedSpray: Interface cho spray đã trang bị
export interface EquippedSpray {
  id: string;
  slot: string;
  sprayLevelId?: string | null;
  name: string;
  icon?: string;
}

// IdentityDetails: Interface cho chi tiết định danh người chơi (card, title, level)
export interface IdentityDetails {
  cardId: string;
  cardArt?: string;
  cardName?: string;
  titleName?: string;
  level: number;
  hideLevel: boolean;
}

// resolveCategory: Hàm xác định danh mục của vũ khí từ metadata
// meta: WeaponMetadata (có thể undefined)
// t: hàm dịch i18n (có thể undefined)
// Trả về: tên danh mục (string) - ưu tiên shopData.categoryText, => category (phần cuối sau ::), => "Melee" nếu tên có melee, => "Other"
export const resolveCategory = (meta?: WeaponMetadata, t?: TFunction): string => {
  if (!meta) return t ? t("equip_page.categories.Other") : "Other";

  // Ưu tiên shopData.categoryText
  if (meta.shopData?.categoryText) {
    return meta.shopData.categoryText;
  }

  // Nếu có category, lấy phần cuối cùng sau "::" (VD: "EEquippableCategory::Sidearm" => "Sidearm")
  if (meta.category) {
    const parts = meta.category.split("::");
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
  }

  // Kiểm tra tên có chứa "melee" không
  if (meta.displayName.toLowerCase().includes("melee")) {
    return t ? t("equip_page.categories.Melee") : "Melee";
  }

  return t ? t("equip_page.categories.Other") : "Other";
};

// formatSpraySlot: Hàm format tên slot spray sang dạng có thể đọc được (dịch)
// slot: tên slot gốc (có thể là UUID, key raw, hoặc tên có prefix)
// t: hàm dịch i18n
// Trả về: chuỗi đã dịch hoặc format
// Xử lý: UUID template => key dịch, => sanitize (bỏ prefix, chuẩn hóa), => alias, => fallback default
export const formatSpraySlot = (slot: string, t: TFunction) => {
  // Thử tra cứu trực tiếp trong SPRAY_SLOT_TRANSLATIONS (với cả slot gốc và UPPERCASE)
  const upperSlot = slot.toUpperCase();
  const slotKey = SPRAY_SLOT_TRANSLATIONS[slot] || SPRAY_SLOT_TRANSLATIONS[upperSlot];
  const defaultTranslationKey = "equip_page.spray_slots.default";
  const defaultTranslation = t(defaultTranslationKey);

  // Nếu tìm thấy key hợp lệ, thử dịch
  if (slotKey && KNOWN_SPRAY_SLOT_KEYS.has(slotKey)) {
    const translationKey = `equip_page.spray_slots.${slotKey}`;
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
  }

  // Sanitize slot name: bỏ prefix "::", bỏ "SpraySlot_", thay gạch bằng space, tách camelCase
  const sanitized = slot
    .replace(/.*::/, "")
    .replace(/SpraySlot_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  if (sanitized) {
    const normalizedKey = sanitized.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const aliasKey = SPRAY_SLOT_KEY_ALIASES[normalizedKey] || normalizedKey;
    // Thử tra cứu với key đã alias
    if (KNOWN_SPRAY_SLOT_KEYS.has(aliasKey)) {
      const translationKey = `equip_page.spray_slots.${aliasKey}`;
      const translated = t(translationKey);

      if (translated !== translationKey) {
        return translated;
      }
    }

    // Thử tra cứu với dạng condensed (bỏ gạch dưới)
    if (aliasKey.includes("_")) {
      const condensedAlias = aliasKey.replace(/_/g, "");
      if (KNOWN_SPRAY_SLOT_KEYS.has(condensedAlias)) {
        const condensedKey = `equip_page.spray_slots.${condensedAlias}`;
        const condensed = t(condensedKey);

        if (condensed !== condensedKey) {
          return condensed;
        }
      }
    }
  }

  // Nếu slot là UUID hoặc dạng hex dài, trả về "default"
  if (
    UUID_PATTERN.test(slot) ||
    UUID_PATTERN.test(sanitized) ||
    /^[0-9a-f ]{20,}$/i.test(sanitized)
  ) {
    return defaultTranslation !== defaultTranslationKey
      ? defaultTranslation
      : t("equip_page.spray_slots.default");
  }

  // Fallback: trả về chuỗi "spray_slot_label" với slot name đã sanitize
  return t("equip_page.spray_slot_label", {
    slot: sanitized.length ? sanitized : slot,
  });
};

// buildMetadataTags: Hàm xây dựng mảng tag metadata cho weapon card
// weapon: EquippedWeapon cần lấy metadata
// Trả về: mảng string chứa chromaName (nếu khác skinName) và buddyName (nếu có)
// Dùng Set để loại bỏ trùng lặp
export const buildMetadataTags = (weapon: EquippedWeapon) =>
  Array.from(
    new Set(
      [
        weapon.chromaName && weapon.chromaName !== weapon.skinName
          ? weapon.chromaName
          : undefined,
        weapon.buddyName,
      ].filter(Boolean)
    )
  ) as string[];
