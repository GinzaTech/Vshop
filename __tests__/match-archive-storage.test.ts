import {
  loadMatchSeasonArchive,
  saveMatchSeasonArchive,
} from "~/services/matches/match-archive-storage";
import { appStorage } from "~/utils/storage";

jest.mock("~/utils/storage", () => {
  let payload: string | null = null;
  return {
    appStorage: {
      getItem: jest.fn(async () => payload),
      removeItem: jest.fn(),
      setItem: jest.fn(async (_key: string, value: string) => {
        payload = value;
      }),
    },
  };
});

const storage = appStorage as jest.Mocked<typeof appStorage>;

describe("portable match archive storage driver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists and restores an account/Act archive through appStorage", async () => {
    await saveMatchSeasonArchive({
      accountKey: "AP|Account-A",
      matches: [],
      seasonId: "ACT-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 100,
    });

    await expect(
      loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({
      accountKey: "ap|account-a",
      seasonId: "act-1",
      syncStatus: "observed",
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      "match-season-archive-v1:ap%7Caccount-a:act-1",
      expect.any(String)
    );
  });
});
