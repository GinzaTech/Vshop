import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("core journey automation and accessibility contracts", () => {
  it.each([
    ["features/navigation/FloatingTabBar.tsx", "primary-tab-${route.name}"],
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

  it("keeps Combat refresh labelled and busy/disabled during loading or refreshing", () => {
    const controls = read("features/combat/CombatSessionScreen.tsx")
      .match(/<Pressable\b[\s\S]*?\n\s*>/g) ?? [];
    const refreshControls = controls.filter((control) =>
      control.includes('accessibilityLabel={t("combat_page.actions.refresh",'),
    );

    expect(refreshControls).toHaveLength(1);
    const [refreshControl] = refreshControls;
    expect(refreshControl).toContain('accessibilityRole="button"');
    expect(refreshControl).toMatch(
      /accessibilityLabel=\{t\("combat_page\.actions\.refresh",\s*\{\s*defaultValue: "Refresh",?\s*\}\)\}/,
    );
    // Both flags must independently block refresh; neither loading-only nor
    // refreshing-only (or &&) preserves this accessibility contract.
    expect(refreshControl).toMatch(
      /accessibilityState=\{\{\s*busy: loading\s*\|\|\s*refreshing,\s*disabled: loading\s*\|\|\s*refreshing\s*,?\s*\}\}/,
    );
    expect(refreshControl).toMatch(/\bdisabled=\{loading\s*\|\|\s*refreshing\}/);
    expect(refreshControl).toContain("onPress={onRefresh}");
  });

  it("keeps Task 6 state on labelled parent controls", () => {
    const member = read("features/party/PartyMemberCard.tsx");
    expect(member).toContain('accessibilityRole="switch"');
    expect(member).toContain('accessibilityLabel={t("party_page.ready",');
    expect(member).toContain("accessibilityState={{ checked: member.ready, disabled, busy }}");

    const chat = read("app/chat/[friendId].tsx");
    expect(chat).toContain('accessibilityLabel={t("chat_page.send")}');
    expect(chat).toMatch(/accessibilityState=\{\{\s*disabled: !canSend,/);

    const settings = read("app/(authenticated)/settings.tsx");
    expect(settings).toContain("accessibilityLabel={title}");
    expect(settings).toContain("accessibilityState={{ disabled: !onPress }}");
  });

  it.each([
    "features/combat/CombatSessionScreen.tsx",
    "features/party/PartyScreen.tsx",
    "app/(authenticated)/friends.tsx",
    "app/(authenticated)/settings.tsx",
    "app/chat/[friendId].tsx",
  ])("keeps every Task 6 child AppIcon decorative in %s", (file) => {
    const iconTags = read(file).match(/<AppIcon\b[\s\S]*?\/>/g) ?? [];

    expect(iconTags.length).toBeGreaterThan(0);
    expect(iconTags.filter((tag) => !/\bdecorative\b/.test(tag))).toEqual([]);
  });
});
