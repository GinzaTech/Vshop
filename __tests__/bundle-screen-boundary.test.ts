import { readFileSync } from "node:fs";
import { join } from "node:path";

const routePath = join(
  process.cwd(),
  "app",
  "(authenticated)",
  "bundles.tsx"
);
const routeSource = readFileSync(routePath, "utf8");

const readI18nBundlePage = (locale: string) =>
  JSON.parse(
    readFileSync(join(process.cwd(), "assets", "i18n", `${locale}.json`), "utf8")
  ).bundles_page as Record<string, unknown>;

describe("bundles route inline white card boundary", () => {
  it("no longer contains the dark modal flow", () => {
    expect(routeSource).not.toMatch(/\bModal\b/);
    expect(routeSource).not.toMatch(/\bPortal\b/);
    expect(routeSource).not.toMatch(/BlurView/);
    expect(routeSource).not.toMatch(/BlurTargetView/);
    expect(routeSource).not.toMatch(/expo-blur/);
    expect(routeSource).not.toMatch(/TwoColumnGrid/);
    expect(routeSource).not.toMatch(/selectedBundle/);
    expect(routeSource).not.toMatch(/react-native-paper/);
  });

  it("maps store bundles straight into the inline detail card", () => {
    expect(routeSource).toMatch(/<BundleImage/);
    expect(routeSource).toMatch(/bundle=\{bundle\}/);
    expect(
      routeSource
    ).toMatch(/remainingSecs=\{user\.shops\.remainingSecs\.bundles\[index\]\}/);
  });

  it("keeps refresh, balance and safe-area behaviour", () => {
    expect(routeSource).toMatch(/AppRefreshControl/);
    expect(routeSource).toMatch(/useAsyncRefresh/);
    expect(routeSource).toMatch(/InfoPill/);
    expect(routeSource).toMatch(/PageIntro/);
    expect(routeSource).toMatch(/getPrimaryTabContentBottomPadding/);
    expect(routeSource).toMatch(/removeClippedSubviews/);
  });

  it("uses light design tokens for the canvas and balance pill", () => {
    expect(routeSource).toMatch(/backgroundColor: COLORS\.SURFACE\b/);
    expect(routeSource).not.toMatch(/backgroundColor: COLORS\.BACKGROUND/);
    expect(routeSource).toMatch(/backgroundColor: COLORS\.SURFACE\b/);
    expect(routeSource).not.toMatch(/VALORANT_DARK_BLUE/);
    expect(routeSource).not.toMatch(/PURE_BLACK/);
    expect(routeSource).not.toMatch(/rgba\(/);
  });

  it("ships the new bundle copy in English and Vietnamese", () => {
    for (const locale of ["en", "vi"]) {
      const bundlePage = readI18nBundlePage(locale);
      expect(typeof bundlePage.ends_in).toBe("string");
      expect((bundlePage.ends_in as string).length).toBeGreaterThan(0);
      expect(typeof bundlePage.estimate).toBe("string");
      expect((bundlePage.estimate as string).length).toBeGreaterThan(0);
      expect(typeof bundlePage.ended).toBe("string");
      expect((bundlePage.ended as string).length).toBeGreaterThan(0);
    }
  });
});
