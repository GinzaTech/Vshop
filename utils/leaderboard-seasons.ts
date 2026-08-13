export type ContentSeason = {
  ID: string;
  Name: string;
  Type: "episode" | "act";
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
};

export type LeaderboardSeasonOption = {
  id: string;
  name: string;
  isActive: boolean;
  startTime: string;
};

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const containsAct = (episode: ContentSeason, act: ContentSeason) => {
  const actStart = toTimestamp(act.StartTime);
  const episodeStart = toTimestamp(episode.StartTime);
  const episodeEnd = toTimestamp(episode.EndTime);
  return actStart >= episodeStart && actStart < episodeEnd;
};

/** Build every started competitive Act, newest first, with an unambiguous label. */
export function buildLeaderboardSeasonOptions(
  seasons: ContentSeason[],
  now = Date.now(),
): LeaderboardSeasonOption[] {
  const episodes = seasons.filter((season) => season.Type === "episode");
  const uniqueActs = new Map<string, ContentSeason>();

  seasons.forEach((season) => {
    if (
      season.Type === "act" &&
      season.ID.trim() &&
      toTimestamp(season.StartTime) <= now
    ) {
      uniqueActs.set(season.ID, season);
    }
  });

  return Array.from(uniqueActs.values())
    .sort(
      (left, right) =>
        toTimestamp(right.StartTime) - toTimestamp(left.StartTime),
    )
    .map((act) => {
      const episode = episodes.find((candidate) => containsAct(candidate, act));
      return {
        id: act.ID,
        name: episode ? `${episode.Name} · ${act.Name}` : act.Name,
        isActive: act.IsActive,
        startTime: act.StartTime,
      };
    });
}

