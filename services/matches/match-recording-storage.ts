import { appStorage } from "~/utils/storage";
import {
  createMatchRecordingRepository,
  type MatchRecordingDriver,
} from "./match-recording-core";

const STORAGE_PREFIX = "match-recording-baseline-v1";
const storageKey = (accountKey: string) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(accountKey)}`;

const driver: MatchRecordingDriver = {
  read: async (accountKey) =>
    (await appStorage.getItem(storageKey(accountKey))) ?? null,
  write: async (accountKey, payload) => {
    await appStorage.setItem(storageKey(accountKey), payload);
  },
};

const repository = createMatchRecordingRepository(driver);

export const loadMatchRecordingBaseline = repository.load;
export const ensureMatchRecordingBaseline = repository.ensure;
export const bindMatchRecordingStartSeason = repository.bindSeason;

export {
  filterRecordedMatches,
  filterRecordedSeasonOptions,
  getRecordedSeasonStartTime,
  isRecordingStartSeason,
  MATCH_RECORDING_SCHEMA_VERSION,
} from "./match-recording-core";
export type { MatchRecordingBaseline } from "./match-recording-core";
