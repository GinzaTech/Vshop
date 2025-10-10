import type { TFunction } from "i18next";

export const FALLBACK_IMAGE = require("~/assets/images/noimage.png");

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

const SPRAY_SLOT_TRANSLATIONS: Record<string, string> = {
  "5863985E-43AC-B05D-CB2D-139E72970014": "spray1",
  "7CDC908E-4F69-9140-A604-899BD879EED1": "spray2",
  "0814B2FE-4512-60A4-5288-1FBDCEC6CA48": "spray3",
};

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

export type TabKey = "loadout" | "skins" | "collection";

export interface PlayerLoadoutGun {
  ID: string;
  SkinID: string;
  SkinLevelID: string;
  ChromaID: string;
  CharmInstanceID?: string;
  CharmID?: string;
  CharmLevelID?: string;
}

export interface PlayerLoadoutSpray {
  EquipSlotID: string;
  SprayID: string;
  SprayLevelID: string | null;
}

export interface PlayerLoadoutIdentity {
  PlayerCardID: string;
  PlayerTitleID: string;
  AccountLevel: number;
  PreferredLevelBorderID: string;
  HideAccountLevel: boolean;
}

export interface PlayerLoadoutData {
  Guns: PlayerLoadoutGun[];
  Sprays: PlayerLoadoutSpray[];
  Identity: PlayerLoadoutIdentity;
}

export interface WeaponMetadata {
  uuid: string;
  displayName: string;
  category?: string;
  shopData?: {
    categoryText?: string;
  };
}

export type WeaponMetadataMap = Record<string, WeaponMetadata>;

export interface EquippedWeapon {
  weaponId: string;
  weaponName: string;
  category: string;
  skinName: string;
  skinLevelName?: string;
  chromaName?: string;
  image?: string;
  buddyName?: string;
  buddyIcon?: string;
}

export interface EquippedSpray {
  id: string;
  slot: string;
  name: string;
  icon?: string;
}

export interface IdentityDetails {
  cardArt?: string;
  cardName?: string;
  titleName?: string;
  level: number;
  hideLevel: boolean;
}

export const resolveCategory = (meta?: WeaponMetadata): string => {
  if (!meta) return "Other";

  if (meta.shopData?.categoryText) {
    return meta.shopData.categoryText;
  }

  if (meta.category) {
    const parts = meta.category.split("::");
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
  }

  if (meta.displayName.toLowerCase().includes("melee")) {
    return "Melee";
  }

  return "Other";
};

export const formatSpraySlot = (slot: string, t: TFunction) => {
  const upperSlot = slot.toUpperCase();
  const slotKey = SPRAY_SLOT_TRANSLATIONS[slot] || SPRAY_SLOT_TRANSLATIONS[upperSlot];

  if (slotKey) {
    const translationKey = `equip_page.spray_slots.${slotKey}`;
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
  }

  const sanitized = slot
    .replace(/.*::/, "")
    .replace(/SpraySlot_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  if (sanitized) {
    const normalizedKey = sanitized.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const aliasKey = SPRAY_SLOT_KEY_ALIASES[normalizedKey] || normalizedKey;
    const translationKey = `equip_page.spray_slots.${aliasKey}`;
    const translated = t(translationKey);

    if (translated !== translationKey) {
      return translated;
    }

    if (aliasKey.includes("_")) {
      const condensedAlias = aliasKey.replace(/_/g, "");
      const condensedKey = `equip_page.spray_slots.${condensedAlias}`;
      const condensed = t(condensedKey);

      if (condensed !== condensedKey) {
        return condensed;
      }
    }
  }

  return t("equip_page.spray_slot_label", {
    slot: sanitized.length ? sanitized : slot,
  });
};

export const buildMetadataTags = (weapon: EquippedWeapon) =>
  Array.from(
    new Set(
      [
        weapon.skinLevelName,
        weapon.chromaName && weapon.chromaName !== weapon.skinName
          ? weapon.chromaName
          : undefined,
        weapon.buddyName,
      ].filter(Boolean)
    )
  ) as string[];