import { Heart, LogOut, UserRoundX } from "lucide";
import {
  APP_ICON_REGISTRY,
  resolveAppIcon,
  resolveAppIconName,
} from "~/components/ui/app-icon-registry";

const INITIAL_SEMANTIC_TOKENS = [
  "unknown",
  "menu",
  "close",
  "search",
  "back",
  "forward",
  "chevronLeft",
  "chevronRight",
  "chevronUp",
  "chevronDown",
  "refresh",
  "loading",
  "check",
  "success",
  "error",
  "info",
  "account",
  "accountGroup",
  "settings",
  "shop",
  "grid",
  "heart",
  "heartFilled",
  "calendar",
  "clock",
  "share",
  "copy",
  "send",
  "download",
  "edit",
  "globe",
  "map",
  "target",
  "chartLine",
  "chartBar",
  "databaseOff",
  "shield",
  "weaponPistol",
  "combatSword",
] as const;

const TASK_3_SEMANTIC_TOKENS = [
  "navStore",
  "navShop",
  "navProfile",
  "navNightMarket",
  "navMore",
  "language",
  "batteryWarning",
  "bundle",
  "timer",
  "update",
  "updateChecking",
  "imageGrid",
] as const;

const TASK_4_PROFILE_SEMANTIC_TOKENS = [
  "equipmentProfile",
  "playerStats",
  "edit",
  "region",
  "accountSynced",
  "accountWarning",
  "rank",
  "peakRank",
  "collection",
  "skin",
  "loadout",
  "spray",
  "flex",
  "selected",
  "unselected",
  "overview",
  "details",
  "season",
  "export",
  "emptyData",
] as const;

const TASK_5_SEMANTIC_TOKENS = [
  "sortAscending",
  "sortDescending",
  "wishlist",
  "wishlistFilled",
  "upgrade",
  "palette",
  "timeline",
  "contract",
  "mission",
  "leaderboardSeason",
  "nightMarket",
  "crosshair",
  "accessory",
  "bundle",
  "history",
  "match",
  "map",
  "skull",
  "economy",
  "performance",
  "share",
  "retry",
  "emptyImage",
  "completed",
  "incomplete",
  "roundElimination",
  "roundSpikeDefused",
  "roundSpikeDetonated",
  "roundTimeExpired",
  "roundSurrender",
  "objectiveCrosshair",
] as const;

const TASK_6_SEMANTIC_TOKENS = [
  "party",
  "ready",
  "cancelReady",
  "connected",
  "disconnected",
  "friendSearch",
  "chatSend",
  "leaveParty",
  "copyCode",
  "combatLive",
  "combatPregame",
  "lockAgent",
  "settingsAccount",
  "settingsDeleteAccount",
  "settingsLanguage",
  "settingsLogoutAll",
  "settingsSwap",
  "settingsAbout",
] as const;

const CONTROLLED_LEGACY_MAPPINGS = {
  shield: "shield-account-outline",
  equipmentProfile: "shield-account-outline",
  weaponPistol: "pistol",
  combatSword: "sword-cross",
  roundElimination: "crosshairs-gps",
  roundSpikeDefused: "shield-check-outline",
  roundSpikeDetonated: "bomb",
  roundTimeExpired: "timer-sand",
  roundSurrender: "flag-outline",
  objectiveCrosshair: "crosshairs-gps",
} as const;

describe("AppIcon registry", () => {
  it("resolves stable semantic names", () => {
    expect(resolveAppIconName("search")).toBe("search");
    expect(resolveAppIcon("search")).toMatchObject({ kind: "morph" });
  });

  it.each([
    undefined,
    null,
    "",
    "constructor",
    "__proto__",
    "not-an-icon",
    "weapon-pistol",
    "combat-sword",
    "role-shield",
    {},
  ])("fails closed for %p", (value) => {
    expect(resolveAppIconName(value)).toBe("unknown");
  });

  it("contains every initial semantic token", () => {
    expect(Object.keys(APP_ICON_REGISTRY)).toEqual(
      expect.arrayContaining(INITIAL_SEMANTIC_TOKENS),
    );
  });

  it("contains every Task 3 shell semantic token", () => {
    expect(Object.keys(APP_ICON_REGISTRY)).toEqual(
      expect.arrayContaining(TASK_3_SEMANTIC_TOKENS),
    );
  });

  it("contains every Task 4 Profile semantic token", () => {
    expect(Object.keys(APP_ICON_REGISTRY)).toEqual(
      expect.arrayContaining(TASK_4_PROFILE_SEMANTIC_TOKENS),
    );
  });

  it("contains every Task 5 semantic token without duplicating existing keys", () => {
    expect(Object.keys(APP_ICON_REGISTRY)).toEqual(
      expect.arrayContaining(TASK_5_SEMANTIC_TOKENS),
    );
    expect(Object.keys(APP_ICON_REGISTRY)).toHaveLength(116);
  });

  it("contains every Task 6 Combat, social, and Settings semantic token", () => {
    expect(Object.keys(APP_ICON_REGISTRY)).toEqual(
      expect.arrayContaining(TASK_6_SEMANTIC_TOKENS),
    );
    expect(Object.keys(APP_ICON_REGISTRY)).toHaveLength(116);
  });

  it.each(TASK_6_SEMANTIC_TOKENS)(
    "maps Task 6 generic semantic token %s to named Lucide data",
    (name) => {
      expect(resolveAppIcon(name)).toMatchObject({ kind: "morph" });
    },
  );

  it("keeps destructive Settings actions semantically distinct", () => {
    expect(resolveAppIcon("settingsDeleteAccount")).toEqual({
      kind: "morph",
      icon: UserRoundX,
    });
    expect(resolveAppIcon("settingsLogoutAll")).toEqual({
      kind: "morph",
      icon: LogOut,
    });
  });

  it("keeps Valorant-only glyphs behind the legacy boundary", () => {
    expect(resolveAppIcon("weaponPistol")).toEqual({
      kind: "legacy",
      legacyName: "pistol",
    });
    expect(resolveAppIcon("combatSword")).toEqual({
      kind: "legacy",
      legacyName: "sword-cross",
    });
    expect(resolveAppIcon("shield")).toEqual({
      kind: "legacy",
      legacyName: "shield-account-outline",
    });
    expect(resolveAppIcon("equipmentProfile")).toEqual({
      kind: "legacy",
      legacyName: "shield-account-outline",
    });
    expect(Object.keys(APP_ICON_REGISTRY)).toHaveLength(116);
  });

  it("maps every controlled game glyph to its exact legacy definition", () => {
    for (const name of Object.keys(CONTROLLED_LEGACY_MAPPINGS) as (
      keyof typeof CONTROLLED_LEGACY_MAPPINGS
    )[]) {
      expect(resolveAppIcon(name)).toEqual({
        kind: "legacy",
        legacyName: CONTROLLED_LEGACY_MAPPINGS[name],
      });
    }

    const legacyNames = new Set(
      Object.values(APP_ICON_REGISTRY)
        .filter((definition) => definition.kind === "legacy")
        .map((definition) => definition.legacyName),
    );
    expect([...legacyNames].sort()).toEqual(
      [
        "bomb",
        "crosshairs-gps",
        "flag-outline",
        "pistol",
        "shield-account-outline",
        "shield-check-outline",
        "sword-cross",
        "timer-sand",
      ].sort(),
    );
  });

  it("keeps Heart semantics while marking the selected state as filled", () => {
    const heart = resolveAppIcon("heart");
    const heartFilled = resolveAppIcon("heartFilled");

    expect(heart).toEqual({ kind: "morph", icon: Heart });
    expect(heartFilled).toEqual({
      kind: "morph",
      icon: Heart,
      filled: true,
    });
  });

  it("keeps wishlist semantics on the same Heart path", () => {
    expect(resolveAppIcon("wishlist")).toEqual({
      kind: "morph",
      icon: Heart,
    });
    expect(resolveAppIcon("wishlistFilled")).toEqual({
      kind: "morph",
      icon: Heart,
      filled: true,
    });
  });
});
