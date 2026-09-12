import {
  ReauthenticationRequiredError,
  renewAuthenticatedSession,
} from "~/utils/auth-session";
import { defaultUser } from "~/utils/valorant-api";

const mockFetchVersion = jest.fn();
const mockReAuth = jest.fn();
const mockGetUserId = jest.fn();
const mockGetEntitlementsToken = jest.fn();

jest.mock("~/utils/valorant-assets", () => ({
  fetchVersion: (...args: unknown[]) => mockFetchVersion(...args),
  loadAgent: jest.fn(),
  loadAssets: jest.fn(),
}));
jest.mock("~/utils/misc", () => ({
  getAccessTokenFromUri: () => "renewed-access",
  getIdTokenFromUri: () => "renewed-id",
  normalizeValorantShard: (region?: string | null) => region || "ap",
}));
jest.mock("~/utils/valorant-api", () => ({
  defaultUser: {
    id: "",
    name: "",
    TagLine: "",
    region: "ap",
    accessToken: "",
    idToken: "",
    entitlementsToken: "",
    shops: { main: [], bundles: [], nightMarket: [], accessory: [] },
    balances: { vp: 0, rad: 0, kc: 0 },
    progress: { level: 0, xp: 0 },
  },
  getBalances: jest.fn(),
  getEntitlementsToken: (...args: unknown[]) =>
    mockGetEntitlementsToken(...args),
  getRiotClientVersionForRequests: () => "fallback-version",
  getProgress: jest.fn(),
  getRiotGeo: jest.fn().mockResolvedValue(null),
  getShop: jest.fn(),
  getUserId: (...args: unknown[]) => mockGetUserId(...args),
  getUsername: jest.fn(),
  parseShop: jest.fn(),
  reAuth: (...args: unknown[]) => mockReAuth(...args),
}));

describe("Riot session renewal identity", () => {
  beforeEach(() => {
    mockFetchVersion.mockResolvedValue("current-version");
    mockReAuth.mockResolvedValue({
      data: { response: { parameters: { uri: "https://callback" } } },
    });
    mockGetEntitlementsToken.mockResolvedValue("renewed-entitlements");
  });

  it("rejects a global Riot cookie that belongs to another saved account", async () => {
    mockGetUserId.mockReturnValue("account-b");

    await expect(
      renewAuthenticatedSession({ ...defaultUser, id: "account-a" })
    ).rejects.toBeInstanceOf(ReauthenticationRequiredError);
    expect(mockGetEntitlementsToken).not.toHaveBeenCalled();
  });

  it("accepts a renewed token for the expected account", async () => {
    mockGetUserId.mockReturnValue("ACCOUNT-A");

    await expect(
      renewAuthenticatedSession({ ...defaultUser, id: "account-a" })
    ).resolves.toMatchObject({
      id: "ACCOUNT-A",
      accessToken: "renewed-access",
      idToken: "renewed-id",
      entitlementsToken: "renewed-entitlements",
    });
  });

  it.each(["auth", "multifactor"])("requires interaction for Riot response type %s", async (type) => {
    mockReAuth.mockResolvedValue({ data: { type } });
    await expect(renewAuthenticatedSession({ ...defaultUser, id: "account-a" }))
      .rejects.toBeInstanceOf(ReauthenticationRequiredError);
  });

  it.each([undefined, "<html>Gateway unavailable</html>", { type: "unexpected" }])(
    "does not log out for an unexpected renewal response %s", async (data) => {
      mockReAuth.mockResolvedValue({ data });
      await expect(renewAuthenticatedSession({ ...defaultUser, id: "account-a" }))
        .rejects.not.toBeInstanceOf(ReauthenticationRequiredError);
    }
  );

  it.each([429, 503, 403])("keeps HTTP %s renewal errors recoverable", async (status) => {
    const error = { response: { status } };
    mockReAuth.mockRejectedValue(error);
    await expect(renewAuthenticatedSession({ ...defaultUser, id: "account-a" })).rejects.toBe(error);
  });
});
