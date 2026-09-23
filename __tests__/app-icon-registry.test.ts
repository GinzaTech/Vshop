import { Heart } from "lucide";
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
      expect.arrayContaining(INITIAL_SEMANTIC_TOKENS)
    );
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
    expect(Object.keys(APP_ICON_REGISTRY)).toHaveLength(
      INITIAL_SEMANTIC_TOKENS.length
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
});
