import {
  PROFILE_DEMO_MATCHES_BY_SEASON,
  PROFILE_DEMO_SEASON_OPTIONS,
  PROFILE_DEMO_STATS_BY_SEASON,
  PROFILE_DEMO_USER,
  getProfileDemoSeasonData,
} from "~/mocks/profile-ui";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";

describe("profile development demo", () => {
  it("allows the profile harness only in development with an explicit flag", () => {
    expect(
      isDevelopmentDemoRoute({
        demo: "1",
        isDev: true,
        pathname: "/profile",
      })
    ).toBe(true);
    expect(
      isDevelopmentDemoRoute({
        demo: "true",
        isDev: false,
        pathname: "/profile",
      })
    ).toBe(false);
    expect(
      isDevelopmentDemoRoute({
        demo: "1",
        isDev: true,
        pathname: "/settings",
      })
    ).toBe(false);
  });

  it("provides enough complete Acts to exercise horizontal selector overflow", () => {
    expect(PROFILE_DEMO_SEASON_OPTIONS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PROFILE_DEMO_SEASON_OPTIONS.map((season) => season.id)).size)
      .toBe(PROFILE_DEMO_SEASON_OPTIONS.length);

    PROFILE_DEMO_SEASON_OPTIONS.forEach((season) => {
      expect(PROFILE_DEMO_STATS_BY_SEASON[season.id]?.seasonId).toBe(season.id);
      expect(PROFILE_DEMO_MATCHES_BY_SEASON[season.id]?.length).toBeGreaterThan(0);
      expect(
        PROFILE_DEMO_MATCHES_BY_SEASON[season.id]?.every(
          (match) => match.stats?.seasonId === season.id
        )
      ).toBe(true);
    });
  });

  it("never embeds usable credentials in the demo identity", () => {
    expect(PROFILE_DEMO_USER.accessToken).toBe("");
    expect(PROFILE_DEMO_USER.entitlementsToken).toBe("");
    expect(PROFILE_DEMO_USER.idToken).toBe("");
  });

  it("can render a reset baseline with only the current Act", () => {
    const data = getProfileDemoSeasonData(true);

    expect(data.seasonOptions).toHaveLength(1);
    expect(data.seasonOptions[0].isActive).toBe(true);
    expect(Object.keys(data.seasonStatsById)).toEqual([
      data.seasonOptions[0].id,
    ]);
    expect(Object.keys(data.seasonMatchesById)).toEqual([
      data.seasonOptions[0].id,
    ]);
  });
});
