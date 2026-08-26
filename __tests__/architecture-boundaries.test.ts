import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const lineCount = (relativePath: string) => read(relativePath).split(/\r?\n/).length;

describe("architecture boundaries", () => {
  it.each([
    "app/(authenticated)/profile.tsx",
    "app/(authenticated)/combat_session.tsx",
  ])("keeps %s as a thin route", (relativePath) => {
    const source = read(relativePath);
    expect(lineCount(relativePath)).toBeLessThanOrEqual(5);
    expect(source).not.toMatch(/axios|https?:\/\//);
    expect(source).toMatch(/export \{ default \} from "~\/features\//);
  });

  it("keeps extracted domain modules within reviewable budgets", () => {
    expect(lineCount("utils/valorant-api.ts")).toBeLessThanOrEqual(2_000);
    expect(lineCount("features/combat/CombatSessionScreen.tsx")).toBeLessThanOrEqual(1_500);
    expect(lineCount("features/combat/session-insights.ts")).toBeLessThanOrEqual(600);
    expect(lineCount("features/profile/profile-loadout.ts")).toBeLessThanOrEqual(350);
    expect(lineCount("services/riot/storefront-parser.ts")).toBeLessThanOrEqual(350);
  });

  it("keeps transport details out of authenticated routes", () => {
    const routeFiles = fs
      .readdirSync(path.join(root, "app", "(authenticated)"), { recursive: true })
      .filter((entry) => typeof entry === "string" && /\.(ts|tsx)$/.test(entry));
    for (const entry of routeFiles) {
      const source = read(path.join("app", "(authenticated)", String(entry)));
      expect(source).not.toMatch(/from ["']axios["']|axios\.defaults/);
    }
  });
});
