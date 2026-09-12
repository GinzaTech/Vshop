import { wishlistBgTask } from "~/utils/wishlist";
import { defaultUser } from "~/utils/valorant-user";

const mockGetShop = jest.fn();
const mockRenew = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockNotify = jest.fn();
const mockUserState = { user: defaultUser };
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: (...args: unknown[]) => mockGetItem(...args), setItem: (...args: unknown[]) => mockSetItem(...args) }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 }, setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: async () => undefined,
  scheduleNotificationAsync: (...args: unknown[]) => mockNotify(...args),
}));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => mockUserState, persist: { hasHydrated: () => true } } }));
jest.mock("~/hooks/useAccountStore", () => ({ useAccountStore: { persist: { hasHydrated: () => true } } }));
jest.mock("~/hooks/useWishlistStore", () => ({ useWishlistStore: { getState: () => ({ notificationEnabled: true, skinIds: [] }), persist: { hasHydrated: () => true } } }));
jest.mock("~/services/accounts/session", () => ({ isSessionRecoveryPaused: () => false, renewSavedAccountSession: (...args: unknown[]) => mockRenew(...args) }));
jest.mock("~/utils/auth-session", () => ({ hasReusableAccessToken: () => true, shouldProactivelyRefreshToken: () => false }));
jest.mock("~/utils/valorant-api", () => ({ getShop: (...args: unknown[]) => mockGetShop(...args) }));
jest.mock("~/utils/localization", () => ({ __esModule: true, default: { t: (key: string) => key }, getVAPILang: () => "en-US" }));
jest.mock("~/utils/plausible", () => ({ capture: jest.fn() }));
jest.mock("~/utils/background-fetch", () => ({ __esModule: true, default: {} }));
jest.mock("~/services/valorant/public-api", () => ({ getPublicSkinLevel: jest.fn() }));

describe("background wishlist session recovery", () => {
  beforeEach(() => {
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "live", entitlementsToken: "ent" };
    mockGetItem.mockResolvedValue("0");
    mockSetItem.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
  });

  it("retries failed daily checks and reuses valid credentials without cookie renewal", async () => {
    mockGetShop.mockRejectedValueOnce({ code: "ERR_NETWORK" });
    await wishlistBgTask();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    mockGetShop.mockResolvedValueOnce({ SkinsPanelLayout: { SingleItemOffers: [] } });
    await wishlistBgTask();
    expect(mockSetItem).toHaveBeenCalledWith("lastWishlistCheck:ap|a", expect.any(String));
    expect(mockRenew).not.toHaveBeenCalled();
    expect(mockGetShop).toHaveBeenCalledTimes(2);
  });

  it("does not notify or mark success for an account changed during the request", async () => {
    mockGetShop.mockImplementationOnce(async () => {
      mockUserState.user = { ...mockUserState.user, id: "b" };
      return { SkinsPanelLayout: { SingleItemOffers: [] } };
    });
    await wishlistBgTask();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
