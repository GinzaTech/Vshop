import fs from "node:fs";
import path from "node:path";
import i18next from "i18next";

type TranslationCatalog = Record<string, unknown>;

const readWorkspaceFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const readCatalog = (locale: "en" | "vi"): TranslationCatalog =>
  JSON.parse(readWorkspaceFile(`assets/i18n/${locale}.json`)) as TranslationCatalog;

const getTranslation = (catalog: TranslationCatalog, key: string): string | undefined => {
  let current: unknown = catalog;

  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as TranslationCatalog)[segment];
  }

  return typeof current === "string" ? current : undefined;
};

const sourcePaths = [
  "app/(authenticated)/equip.tsx",
  "app/(authenticated)/agent.tsx",
  "app/(authenticated)/item_upgrades.tsx",
  "app/(authenticated)/about.tsx",
  "components/profile/PlayerInfoView.tsx",
  "components/match-detail/ScoreboardTable.tsx",
  "features/profile/ProfileSegmentedControl.tsx",
] as const;

const sources = Object.fromEntries(
  sourcePaths.map((relativePath) => [relativePath, readWorkspaceFile(relativePath)])
) as Record<(typeof sourcePaths)[number], string>;

const catalogs = {
  en: readCatalog("en"),
  vi: readCatalog("vi"),
};

describe("Phase 3 visible copy localization", () => {
  it.each(Object.entries(catalogs))(
    "%s catalog resolves every literal translation key used by the four screens",
    (_locale, catalog) => {
      const usedKeys = sourcePaths.flatMap((relativePath) =>
        Array.from(sources[relativePath].matchAll(/\bt\(\s*["']([^"']+)["']/g), (match) => match[1])
      );
      const missingKeys = [...new Set(usedKeys)].filter(
        (key) => getTranslation(catalog, key) === undefined
      );

      expect(missingKeys).toEqual([]);
    }
  );

  it("routes the targeted visible labels through i18n", () => {
    const agentSource = sources["app/(authenticated)/agent.tsx"];
    const upgradesSource = sources["app/(authenticated)/item_upgrades.tsx"];
    const aboutSource = sources["app/(authenticated)/about.tsx"];

    expect(agentSource).toContain('import { useTranslation } from "react-i18next";');
    expect(agentSource).toContain("const { t } = useTranslation();");
    expect(agentSource).toContain("{t(role.labelKey)}");

    expect(upgradesSource).toContain('t("item_upgrades_page.level_count"');
    expect(upgradesSource).toContain('t("item_upgrades_page.variant_count"');
    expect(upgradesSource).toContain('t("item_upgrades_page.search_placeholder")');
    expect(upgradesSource).toContain('t("item_upgrades_page.no_results_title")');
    expect(upgradesSource).toContain('t("item_upgrades_page.no_results_subtitle")');

    expect(aboutSource).toContain('renderInfoRow(t("about_page.language")');
    expect(aboutSource).toContain('t("about_page.feature_toggles_note")');
  });

  it("does not leave the audited visible copy as raw literals", () => {
    const agentSource = sources["app/(authenticated)/agent.tsx"];
    const upgradesSource = sources["app/(authenticated)/item_upgrades.tsx"];
    const aboutSource = sources["app/(authenticated)/about.tsx"];

    expect(agentSource).not.toContain('name: "Duelist"');
    expect(agentSource).not.toContain('name: "Controller"');
    expect(agentSource).not.toContain('name: "Initiator"');
    expect(agentSource).not.toContain('name: "Sentinel"');
    expect(agentSource).not.toContain("{role.name}");

    expect(upgradesSource).not.toMatch(/>\s*\{levels\.length\}\s*levels\s*</);
    expect(upgradesSource).not.toMatch(/>\s*\{sidegradeCount\}\s*variants\s*</);
    expect(upgradesSource).not.toMatch(/>\s*Skins\s*</);
    expect(upgradesSource).not.toMatch(/>\s*Variants\s*</);
    expect(upgradesSource).not.toContain('placeholder="Search upgrades"');
    expect(upgradesSource).not.toContain(': "No matching upgrades"');
    expect(upgradesSource).not.toContain(': "Try a different skin name."');

    expect(aboutSource).not.toContain('renderInfoRow("Language"');
    expect(aboutSource).not.toContain("Các switch bên dưới là feature flag");
  });

  it("routes the Profile dashboard labels through i18n", () => {
    const playerInfoSource = sources["components/profile/PlayerInfoView.tsx"];
    const segmentedControlSource =
      sources["features/profile/ProfileSegmentedControl.tsx"];

    expect(playerInfoSource).toContain('useTranslation');
    expect(playerInfoSource).toContain('t("profile_page.stats.season_viewing")');
    expect(playerInfoSource).toContain('t("profile_page.stats.overall")');
    expect(playerInfoSource).toContain('t("profile_page.stats.performance")');
    expect(playerInfoSource).toContain('t("profile_page.stats.breakdown_agents")');
    expect(playerInfoSource).toContain('t("profile_page.stats.combat")');
    expect(segmentedControlSource).toContain('useTranslation');
    expect(segmentedControlSource).toContain('t("profile_page.stats.overview")');
    expect(segmentedControlSource).toContain('t("profile_page.stats.details")');

    expect(playerInfoSource).not.toContain('>TỔNG THỂ<');
    expect(playerInfoSource).not.toContain('>Phong độ<');
    expect(segmentedControlSource).not.toContain('? "Tổng quan" : "Chi tiết"');
  });

  it("provides deliberate English and Vietnamese copy for the audited labels", () => {
    const expected = {
      en: {
        "equip_page.sections.buddies": "Gun Buddies",
        "equip_gallery.labels.buddies": "Gun Buddy",
        Duelist: "Duelist",
        Controller: "Controller",
        Initiator: "Initiator",
        Sentinel: "Sentinel",
        "item_upgrades_page.level_count": "{{count}} level",
        "item_upgrades_page.level_count_plural": "{{count}} levels",
        "item_upgrades_page.variant_count": "{{count}} variant",
        "item_upgrades_page.variant_count_plural": "{{count}} variants",
        "item_upgrades_page.search_placeholder": "Search upgrades",
        "about_page.language": "Language",
        "about_page.toggle_override_active":
          "{{count}} feature flag override is stored locally.",
        "about_page.toggle_override_active_plural":
          "{{count}} feature flag overrides are stored locally.",
        "profile_page.stats.overall": "Overall",
        "profile_page.stats.performance": "Performance",
        "profile_page.stats.breakdown_agents": "Agents",
        "profile_page.stats.combat": "Combat",
        "profile_page.stats.overview": "Overview",
        "profile_page.stats.details": "Details",
      },
      vi: {
        "equip_page.sections.buddies": "Móc súng",
        "equip_gallery.labels.buddies": "Móc súng",
        Duelist: "Đối đầu",
        Controller: "Kiểm soát",
        Initiator: "Khởi tranh",
        Sentinel: "Hộ vệ",
        "item_upgrades_page.level_count": "{{count}} cấp",
        "item_upgrades_page.variant_count": "{{count}} biến thể",
        "item_upgrades_page.search_placeholder": "Tìm nâng cấp",
        "about_page.language": "Ngôn ngữ",
        "profile_page.stats.overall": "Tổng thể",
        "profile_page.stats.performance": "Phong độ",
        "profile_page.stats.breakdown_agents": "Đặc vụ",
        "profile_page.stats.combat": "Giao tranh",
        "profile_page.stats.overview": "Tổng quan",
        "profile_page.stats.details": "Chi tiết",
      },
    } as const;

    for (const [locale, translations] of Object.entries(expected) as [
      keyof typeof expected,
      (typeof expected)[keyof typeof expected],
    ][]) {
      for (const [key, value] of Object.entries(translations)) {
        expect(getTranslation(catalogs[locale], key)).toBe(value);
      }
    }
  });

  it("renders singular and plural counts with the app's i18next v3 compatibility mode", async () => {
    const instance = i18next.createInstance();
    await instance.init({
      compatibilityJSON: "v3",
      fallbackLng: "en",
      lng: "en",
      resources: {
        en: { translation: catalogs.en },
        vi: { translation: catalogs.vi },
      },
    });

    expect(instance.t("item_upgrades_page.level_count", { count: 1 })).toBe("1 level");
    expect(instance.t("item_upgrades_page.level_count", { count: 2 })).toBe("2 levels");
    expect(instance.t("item_upgrades_page.variant_count", { count: 1 })).toBe("1 variant");
    expect(instance.t("item_upgrades_page.variant_count", { count: 2 })).toBe("2 variants");
    expect(instance.t("about_page.toggle_override_active", { count: 1 })).toBe(
      "1 feature flag override is stored locally."
    );
    expect(instance.t("about_page.toggle_override_active", { count: 2 })).toBe(
      "2 feature flag overrides are stored locally."
    );
    expect(instance.t("profile_page.stats.act_count", { count: 1 })).toBe("1 Act");
    expect(instance.t("profile_page.stats.act_count", { count: 2 })).toBe("2 Acts");
    expect(instance.t("profile_page.stats.match_count", { count: 1 })).toBe("1 match");
    expect(instance.t("profile_page.stats.match_count", { count: 2 })).toBe("2 matches");

    await instance.changeLanguage("vi");
    expect(instance.t("item_upgrades_page.level_count", { count: 1 })).toBe("1 cấp");
    expect(instance.t("item_upgrades_page.level_count", { count: 2 })).toBe("2 cấp");
    expect(instance.t("item_upgrades_page.variant_count", { count: 1 })).toBe("1 biến thể");
    expect(instance.t("item_upgrades_page.variant_count", { count: 2 })).toBe("2 biến thể");
    expect(instance.t("profile_page.stats.act_count", { count: 2 })).toBe("2 ACT");
    expect(instance.t("profile_page.stats.match_count", { count: 2 })).toBe("2 trận");
  });
});
