import type { PlayerLoadoutResponse } from "./api-types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");

/** Validate the raw server receipt, before any normalization or request merge. */
export function isLoadoutResponse(value: unknown, subject: string, minimumVersion = 0): value is PlayerLoadoutResponse {
  if (!record(value) || value.Subject !== subject || !Number.isSafeInteger(value.Version) ||
      (value.Version as number) < minimumVersion || typeof value.Incognito !== "boolean") return false;
  if (!Array.isArray(value.Guns) || !value.Guns.every((gun: unknown) => record(gun) &&
      strings(gun, ["ID", "SkinID", "SkinLevelID", "ChromaID"]) && Array.isArray(gun.Attachments) &&
      ["CharmID", "CharmLevelID", "CharmInstanceID"].every((key) => gun[key] === undefined || typeof gun[key] === "string"))) return false;
  if (!record(value.Identity) || !strings(value.Identity, ["PlayerCardID", "PlayerTitleID", "PreferredLevelBorderID"]) ||
      typeof value.Identity.AccountLevel !== "number" || !Number.isFinite(value.Identity.AccountLevel) ||
      typeof value.Identity.HideAccountLevel !== "boolean") return false;
  if (value.ActiveExpressions !== undefined && (!Array.isArray(value.ActiveExpressions) ||
      !value.ActiveExpressions.every((item: unknown) => record(item) && strings(item, ["TypeID", "AssetID"])))) return false;
  if (value.DynamicOptions !== undefined && !record(value.DynamicOptions)) return false;
  return value.Sprays === undefined || (Array.isArray(value.Sprays) && value.Sprays.every((item: unknown) =>
    record(item) && strings(item, ["EquipSlotID", "SprayID"]) && (item.SprayLevelID === null || typeof item.SprayLevelID === "string")));
}

export function validateLoadoutReceipt(value: unknown, subject: string, version: number, api: "v2" | "v3") {
  if (!isLoadoutResponse(value, subject, version) ||
      (api === "v3" ? !Array.isArray(value.ActiveExpressions) || !record(value.DynamicOptions) : !Array.isArray(value.Sprays))) {
    throw new Error("Invalid player loadout receipt");
  }
  return { ...value, SourceApiVersion: api, Sprays: value.Sprays ?? [],
    ActiveExpressions: value.ActiveExpressions ?? [], DynamicOptions: value.DynamicOptions ?? {} };
}

/** Compare every carried JSON field; transport normalization alone is not a change. */
export function sameLoadoutData(left: PlayerLoadoutResponse, right: PlayerLoadoutResponse) {
  return sameJsonData({ ...left, SourceApiVersion: undefined }, { ...right, SourceApiVersion: undefined });
}
function sameJsonData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => sameJsonData(entry, right[index]));
  }
  if (!record(left) || !record(right)) return false;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  const targetKeys = Object.keys(right).filter((key) => right[key] !== undefined);
  return keys.length === targetKeys.length && keys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) && sameJsonData(left[key], right[key]));
}
