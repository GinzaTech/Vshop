import {
  getPublicSkinLevel,
  getValorantApiData,
  getValorantApiDataOrNull,
} from "~/services/valorant/public-api";

const mockPublicGet = jest.fn();

jest.mock("~/services/http/clients", () => ({
  publicHttpClient: {
    get: (...args: unknown[]) => mockPublicGet(...args),
  },
}));

describe("public Valorant API service", () => {
  it("unwraps successful API envelopes", async () => {
    mockPublicGet.mockResolvedValueOnce({
      status: 200,
      data: { status: 200, data: [{ uuid: "weapon-1" }] },
    });

    await expect(
      getValorantApiData<{ uuid: string }[]>("weapons", {
        language: "vi-VN",
      }),
    ).resolves.toEqual([{ uuid: "weapon-1" }]);
    expect(mockPublicGet).toHaveBeenCalledWith(
      "https://valorant-api.com/v1/weapons",
      { params: { language: "vi-VN" } },
    );
  });

  it("returns null for non-200 optional lookups", async () => {
    mockPublicGet.mockResolvedValueOnce({
      status: 404,
      data: { status: 404, data: null },
    });

    await expect(
      getValorantApiDataOrNull("weapons/skinlevels/missing"),
    ).resolves.toBeNull();
  });

  it("rejects an empty dynamic skin-level id before making a request", () => {
    expect(() => getPublicSkinLevel("   ")).toThrow(
      "skinLevelId is required",
    );
    expect(mockPublicGet).not.toHaveBeenCalled();
  });

  it("trims and encodes a dynamic skin-level id", async () => {
    mockPublicGet.mockResolvedValueOnce({
      status: 200,
      data: { status: 200, data: { uuid: "skin/level 1" } },
    });

    await getPublicSkinLevel("  skin/level 1  ", "vi-VN");

    expect(mockPublicGet).toHaveBeenCalledWith(
      "https://valorant-api.com/v1/weapons/skinlevels/skin%2Flevel%201",
      { params: { language: "vi-VN" } },
    );
  });
});
