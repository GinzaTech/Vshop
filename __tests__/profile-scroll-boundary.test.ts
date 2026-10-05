import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../features/profile/ProfileScreen.tsx"), "utf8");

it("clamps the shared vertical list for all Profile tabs while retaining refresh and nav clearance", () => {
  expect(source).toContain('overScrollMode="never"');
  expect(source).toContain("alwaysBounceVertical={false}");
  expect(source).toContain("getProfileContentBottomPadding(insets.bottom)");
  expect(source).toContain("<RefreshControl");
  expect(source).toContain("PROFILE_TAB_KEYS.map(renderProfileTabPage)");
});
