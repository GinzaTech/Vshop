import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("core journey automation and accessibility contracts", () => {
  it.each([
    ["app/(authenticated)/_layout.tsx", "primary-tab-${route.name}"],
    ["app/(authenticated)/friends.tsx", 'testID="friends-search-input"'],
    ["app/(authenticated)/equip.tsx", "equipment-tab-${section.key}"],
    ["app/(authenticated)/gallery.tsx", 'testID="gallery-search-input"'],
    ["app/(authenticated)/shop.tsx", 'testID="shop-filter-all"'],
    [
      "features/profile/ProfileSegmentedControl.tsx",
      "profile-tab-${tab.value}",
    ],
    ["components/LoadingScreen.tsx", 'testID="startup-retry-button"'],
  ])("keeps a stable selector in %s", (file, selector) => {
    expect(read(file)).toContain(selector);
  });

  it("blocks direct Android battery-optimization exemption requests", () => {
    const config = JSON.parse(read("app.json")) as {
      expo: { android: { permissions?: string[]; blockedPermissions?: string[] } };
    };
    const permission = "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS";

    expect(config.expo.android.permissions ?? []).not.toContain(permission);
    expect(config.expo.android.blockedPermissions ?? []).toContain(permission);
    expect(read("components/BatteryOptimizationWarning.tsx")).not.toContain(
      "ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
    );
  });

  it("groups both Profile segmented-control modes as tablists", () => {
    const source = read("features/profile/ProfileSegmentedControl.tsx");
    expect(source.match(/accessibilityRole="tablist"/g)).toHaveLength(2);
    expect(source).toContain('accessibilityLabel={t("profile_page.stats.navigation")}');
  });

  it.each([
    [
      "app/(authenticated)/item_upgrades.tsx",
      "item-upgrades-clear-search",
      "hitSlop={8}",
    ],
    [
      "app/(authenticated)/leaderboard.tsx",
      "leaderboard-clear-search",
      "hitSlop={13}",
    ],
  ])("keeps the clear-search control named and touchable in %s", (file, testID, hitSlop) => {
    const source = read(file);
    const controlStart = source.indexOf(`testID="${testID}"`);
    const controlSource = source.slice(controlStart, controlStart + 320);

    expect(controlStart).toBeGreaterThanOrEqual(0);
    expect(controlSource).toContain('accessibilityRole="button"');
    expect(controlSource).toContain('accessibilityLabel={t("common.close")}');
    expect(controlSource).toContain(hitSlop);
  });

  it("keeps Task 6 state on labelled parent controls", () => {
    const combatSession = read("features/combat/CombatSessionScreen.tsx");
    expect(combatSession).toContain('accessibilityRole="button"');
    expect(combatSession).toContain(
      'accessibilityLabel={t("combat_page.actions.refresh",',
    );
    expect(combatSession).toContain(
      "accessibilityState={{ busy: loading, disabled: loading }}",
    );

    const combat = read("app/(authenticated)/combat.tsx");
    expect(combat).toContain('t("combat_page.actions.unready")');
    expect(combat).toContain('t("combat_page.actions.ready")');
    expect(combat).toContain(
      "accessibilityState={{ busy: partyReadyLoading, disabled: partyReadyLoading }}",
    );

    const chat = read("app/chat/[friendId].tsx");
    expect(chat).toContain('accessibilityLabel={t("chat_page.send")}');
    expect(chat).toMatch(/accessibilityState=\{\{\s*disabled: !canSend,/);

    const settings = read("app/(authenticated)/settings.tsx");
    expect(settings).toContain("accessibilityLabel={title}");
    expect(settings).toContain("accessibilityState={{ disabled: !onPress }}");
  });

  it.each([
    "features/combat/CombatSessionScreen.tsx",
    "app/(authenticated)/combat.tsx",
    "app/(authenticated)/friends.tsx",
    "app/(authenticated)/settings.tsx",
    "app/chat/[friendId].tsx",
  ])("keeps every Task 6 child AppIcon decorative in %s", (file) => {
    const iconTags = read(file).match(/<AppIcon\b[\s\S]*?\/>/g) ?? [];

    expect(iconTags.length).toBeGreaterThan(0);
    expect(iconTags.filter((tag) => !/\bdecorative\b/.test(tag))).toEqual([]);
  });
});
