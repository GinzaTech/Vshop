import {
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import {
  createMatchArchiveRepository,
  MATCH_ARCHIVE_SCHEMA_VERSION,
  type MatchArchiveDriver,
} from "./match-archive-core";

const DATABASE_NAME = "vshop-match-archive.db";
let databasePromise: Promise<SQLiteDatabase> | null = null;

const openArchiveDatabase = async () => {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS match_season_archives (
          account_key TEXT NOT NULL,
          season_id TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (account_key, season_id)
        );
        CREATE INDEX IF NOT EXISTS idx_match_season_archives_updated
          ON match_season_archives (account_key, updated_at DESC);
        PRAGMA user_version = ${MATCH_ARCHIVE_SCHEMA_VERSION};
      `);
      return database;
    });
  }
  return databasePromise;
};

const driver: MatchArchiveDriver = {
  read: async (accountKey, seasonId) => {
    const database = await openArchiveDatabase();
    const row = await database.getFirstAsync<{ payload: string }>(
      `SELECT payload
         FROM match_season_archives
        WHERE account_key = ? AND season_id = ?`,
      [accountKey, seasonId]
    );
    return typeof row?.payload === "string" ? row.payload : null;
  },
  write: async (accountKey, seasonId, payload) => {
    const database = await openArchiveDatabase();
    await database.runAsync(
      `INSERT INTO match_season_archives (
         account_key, season_id, schema_version, updated_at, payload
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_key, season_id) DO UPDATE SET
         schema_version = excluded.schema_version,
         updated_at = excluded.updated_at,
         payload = excluded.payload`,
      [
        accountKey,
        seasonId,
        MATCH_ARCHIVE_SCHEMA_VERSION,
        Date.now(),
        payload,
      ]
    );
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
