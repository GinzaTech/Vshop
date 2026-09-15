import { appStorage } from "~/utils/storage";
import {
  createMatchArchiveRepository,
  type MatchArchiveDriver,
} from "./match-archive-core";

const STORAGE_PREFIX = "match-season-archive-v1";
const storageKey = (accountKey: string, seasonId: string) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(accountKey)}:${encodeURIComponent(seasonId)}`;

const driver: MatchArchiveDriver = {
  read: async (accountKey, seasonId) =>
    (await appStorage.getItem(storageKey(accountKey, seasonId))) ?? null,
  write: async (accountKey, seasonId, payload) => {
    await appStorage.setItem(storageKey(accountKey, seasonId), payload);
  },
};

const repository = createMatchArchiveRepository(driver);

export const archiveObservedMatches = repository.archiveObservedMatches;
export const loadMatchSeasonArchive = repository.loadMatchSeasonArchive;
export const saveMatchSeasonArchive = repository.saveMatchSeasonArchive;

export {
  chooseMatchArchiveStats,
  createMatchArchiveRepository,
  MATCH_ARCHIVE_SCHEMA_VERSION,
  MAX_ARCHIVED_MATCHES_PER_SEASON,
  mergeMatchArchiveRecords,
} from "./match-archive-core";
export type {
  MatchArchiveDriver,
  MatchArchiveRepository,
  MatchArchiveSyncStatus,
  MatchSeasonArchive,
  SaveMatchSeasonArchiveInput,
} from "./match-archive-core";
