import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("production mock boundaries", () => {
  it("routes Profile fixtures to a callable fail-closed contract", () => {
    const metroConfig = readFileSync(
      join(process.cwd(), "metro.config.js"),
      "utf8",
    );
    const expected = join(process.cwd(), "mocks", "profile-ui.production.js");

    expect(metroConfig).toContain('"~/mocks/profile-ui"');
    expect(metroConfig).toContain('"profile-ui.production.js"');

    const productionProfile = require(expected);
    expect(typeof productionProfile.getProfileDemoSeasonData).toBe("function");
    expect(productionProfile.getProfileDemoSeasonData()).toEqual({
      currentMatches: [],
      currentStats: null,
      seasonStatsById: {},
      seasonMatchesById: {},
      seasonOptions: [],
    });
    expect(productionProfile.PROFILE_DEMO_USER).toBeNull();
    expect(productionProfile.PROFILE_DEMO_RANK).toBeNull();
  });
});
