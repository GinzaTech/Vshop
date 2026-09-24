import {
  Bomb,
  Crosshair,
  Flag,
  Heart,
  Hourglass,
  LogOut,
  Pistol,
  ShieldCheck,
  ShieldUser,
  Swords,
  UserRoundX,
} from "~/components/ui/app-icon-lucide";
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

const CONTROLLED_GAME_MAPPINGS = {
  shield: ShieldUser,
  equipmentProfile: ShieldUser,
  weaponPistol: Pistol,
  combatSword: Swords,
  roundElimination: Crosshair,
  roundSpikeDefused: ShieldCheck,
  roundSpikeDetonated: Bomb,
  roundTimeExpired: Hourglass,
  roundSurrender: Flag,
  objectiveCrosshair: Crosshair,
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

  it("keeps Valorant-specific glyphs on the animated boundary", () => {
    expect(resolveAppIcon("weaponPistol")).toEqual({
      kind: "morph",
      icon: Pistol,
    });
    expect(resolveAppIcon("combatSword")).toEqual({
      kind: "morph",
      icon: Swords,
    });
    expect(resolveAppIcon("shield")).toEqual({
      kind: "morph",
      icon: ShieldUser,
    });
    expect(resolveAppIcon("equipmentProfile")).toEqual({
      kind: "morph",
      icon: ShieldUser,
    });
    expect(Object.keys(APP_ICON_REGISTRY)).toHaveLength(116);
  });

  it("maps every controlled game glyph to morphable vector data", () => {
    for (const name of Object.keys(CONTROLLED_GAME_MAPPINGS) as (
      keyof typeof CONTROLLED_GAME_MAPPINGS
    )[]) {
      expect(resolveAppIcon(name)).toEqual({
        kind: "morph",
        icon: CONTROLLED_GAME_MAPPINGS[name],
      });
    }

    expect(
      Object.values(APP_ICON_REGISTRY).every(
        (definition) => definition.kind === "morph",
      ),
    ).toBe(true);
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
