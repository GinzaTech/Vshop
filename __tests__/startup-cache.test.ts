import {
  isStartupCacheMetadataUsable,
  markStartupCacheReady,
  STARTUP_CACHE_MAX_AGE_MS,
} from "~/utils/startup-cache";
import { setStoredItem } from "~/utils/storage";

jest.mock("~/hooks/useMatchStore", () => ({
  useMatchStore: { getState: jest.fn() },
}));
jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: { getState: jest.fn() },
}));
jest.mock("~/utils/storage", () => ({
  getStoredItem: jest.fn(),
  setStoredItem: jest.fn(),
}));

describe("startup cache policy", () => {
  it("accepts only a recent complete cache for the active account", () => {
    const now = 1_000_000;
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - 1_000 },
        "ap|player",
        true,
        now
      )
    ).toBe(true);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "eu|other", completedAt: now - 1_000 },
        "ap|player",
        true,
        now
      )
    ).toBe(false);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - STARTUP_CACHE_MAX_AGE_MS - 1 },
        "ap|player",
        true,
        now
      )
    ).toBe(false);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - 1_000 },
        "ap|player",
        false,
        now
      )
    ).toBe(false);
  });

  it("does not fail startup when the optional cache marker cannot be stored", async () => {
    jest.mocked(setStoredItem).mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      markStartupCacheReady({ id: "player", region: "ap" })
    ).resolves.toBe(false);
  });
});
