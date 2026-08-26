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
});
