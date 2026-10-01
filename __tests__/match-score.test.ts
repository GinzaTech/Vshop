import { extractMatchScore } from "~/features/combat/match-score";

const details = (teams: unknown = [
  { teamId: "Red", roundsWon: 4 },
  { teamId: "Blue", roundsWon: 7 },
], matchId = "active-match") => ({ matchInfo: { matchId }, teams });

describe("extractMatchScore", () => {
  it("orders the actual self team first regardless of response order", () => {
    expect(extractMatchScore(details(), "active-match", "Blue")).toEqual({
      selfTeamId: "Blue", enemyTeamId: "Red", allyRoundsWon: 7, enemyRoundsWon: 4,
    });
    expect(extractMatchScore(details(), "active-match", "Red")).toEqual({
      selfTeamId: "Red", enemyTeamId: "Blue", allyRoundsWon: 4, enemyRoundsWon: 7,
    });
  });

  it("supports actual team IDs without assuming Blue or Red", () => {
    expect(extractMatchScore(details([
      { teamId: "Orange", roundsWon: 2 }, { teamId: "Purple", roundsWon: 6 },
    ]), "active-match", "Purple")).toMatchObject({ allyRoundsWon: 6, enemyRoundsWon: 2 });
  });

  it("accepts explicit upstream zero scores", () => {
    expect(extractMatchScore(details([
      { teamId: "Blue", roundsWon: 0 }, { teamId: "Red", roundsWon: 0 },
    ]), "active-match", "Blue")).toMatchObject({ allyRoundsWon: 0, enemyRoundsWon: 0 });
  });

  it.each([null, undefined, {}, new Error("unavailable"), { matchInfo: null },
    { matchInfo: { matchId: "active-match" }, teams: null },
  ])("returns unavailable for empty or failed data: %p", (value) => {
    expect(extractMatchScore(value, "active-match", "Blue")).toBeNull();
  });

  it("rejects missing or mismatched match identities and an unknown self team", () => {
    expect(extractMatchScore(details(), undefined, "Blue")).toBeNull();
    expect(extractMatchScore(details(), "", "Blue")).toBeNull();
    expect(extractMatchScore(details(), "another-match", "Blue")).toBeNull();
    expect(extractMatchScore(details(), "active-match", undefined)).toBeNull();
    expect(extractMatchScore(details(), "active-match", "Green")).toBeNull();
    expect(extractMatchScore({ teams: details().teams }, "active-match", "Blue")).toBeNull();
  });

  it.each([[], [{ teamId: "Blue", roundsWon: 7 }],
    [{ teamId: "Blue", roundsWon: 7 }, { teamId: "Blue", roundsWon: 4 }],
    [{ teamId: "Blue", roundsWon: 7 }, { teamId: "Red", roundsWon: 4 }, { teamId: "Green", roundsWon: 1 }],
    [{ teamId: "Blue", roundsWon: 7 }, { teamId: "", roundsWon: 4 }],
    [{ teamId: "Blue", roundsWon: 7 }, null],
  ].map((teams) => [teams]))("rejects an absent or ambiguous enemy counterpart: %p", (teams) => {
    expect(extractMatchScore(details(teams), "active-match", "Blue")).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.5, "7", null, undefined])(
    "rejects invalid roundsWon on either team: %p", (roundsWon) => {
      expect(extractMatchScore(details([
        { teamId: "Blue", roundsWon }, { teamId: "Red", roundsWon: 4 },
      ]), "active-match", "Blue")).toBeNull();
      expect(extractMatchScore(details([
        { teamId: "Blue", roundsWon: 7 }, { teamId: "Red", roundsWon },
      ]), "active-match", "Blue")).toBeNull();
    },
  );
});
