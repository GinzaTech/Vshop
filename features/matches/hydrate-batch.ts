import type { MatchDetailsData, MatchHistoryRecord } from "~/types/match-ui";
import type { defaultUser } from "~/utils/valorant-api";
import { buildMatchHistoryRecord, createMatchAssetCatalog } from "~/utils/match-ui";
import { mapWithConcurrency } from "~/utils/network";

export async function hydrateMatchBatch(
  matches: MatchHistoryRecord[],
  user: typeof defaultUser,
  concurrency: number,
  fetchDetails: (matchId: string) => Promise<MatchDetailsData | null>
) {
  const catalog = createMatchAssetCatalog();
  return mapWithConcurrency(matches, concurrency, async (match) => {
    const details = await fetchDetails(match.MatchID);
    return buildMatchHistoryRecord(match, details, user.id, catalog);
  });
}
