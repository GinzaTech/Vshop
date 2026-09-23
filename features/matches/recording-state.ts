import type { MatchRecordingBaseline } from "~/services/matches/match-recording-core";
import type { MatchState } from "./store-types";

type RecordingState = Pick<
  MatchState,
  | "recordingStartedAt"
  | "recordingStartSeasonId"
  | "seasonMatchesById"
  | "seasonOptions"
  | "seasonStats"
  | "seasonStatsById"
>;

export const synchronizeRecordingBaseline = (
  state: RecordingState,
  baseline: MatchRecordingBaseline
): Partial<RecordingState> => {
  if (state.recordingStartedAt === baseline.startedAt) {
    return state.recordingStartSeasonId === baseline.startSeasonId
      ? {}
      : { recordingStartSeasonId: baseline.startSeasonId };
  }

  return {
    recordingStartedAt: baseline.startedAt,
    recordingStartSeasonId: baseline.startSeasonId,
    seasonMatchesById: {},
    seasonOptions: [],
    seasonStats: null,
    seasonStatsById: {},
  };
};
