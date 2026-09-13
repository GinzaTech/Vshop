/**
 * valorant-api.ts — Barrel re-export của tầng service Riot (≤ 30 dòng).
 * URL Riot chỉ được tạo trong services/riot/endpoints.ts; file này chỉ
 * tái xuất facade cho component/screen dùng.
 */
export type {
  CompetitiveMMRResponse,
  CurrentGameMatchResponse,
  OwnedItemsResponse,
  PartyResponse,
  PlayerLoadoutExpression,
  PlayerLoadoutResponse,
  ValorantSessionResponse,
} from "~/services/riot/api-types";

// User mặc định (template user rỗng)
export { defaultUser } from "~/utils/valorant-user";
// Request context + các nhóm API Riot (account/loadout/match/combat/progression)
export * from "~/services/riot/request-context";
export * from "~/services/riot/account-api";
export * from "~/services/riot/loadout-api";
export * from "~/services/riot/match-api";
export * from "~/services/riot/combat-api";
export * from "~/services/riot/progression-api";
// Parser storefront: response shop Riot → items dùng được cho UI
export { parseShop } from "~/services/riot/storefront-parser";
