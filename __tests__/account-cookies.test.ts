import * as cookieUtils from "~/utils/cookies";
import { Platform } from "react-native";
import * as webCookies from "~/utils/cookies.web";

const mockCookieManager = {
  getAsArray: jest.fn(),
  getAllAsArray: jest.fn(),
  set: jest.fn(),
  clearAll: jest.fn(),
  clearAllStores: jest.fn(),
  flush: jest.fn(),
};

jest.mock("~/utils/runtime", () => ({ isExpoGo: false }));
jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: mockCookieManager,
}));

const { captureRiotAuthCookies, restoreRiotAuthCookies } = cookieUtils;
const originalPlatformOsDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  "OS"
);

describe("account-scoped Riot cookies", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterAll(() => {
    if (originalPlatformOsDescriptor) {
      Object.defineProperty(Platform, "OS", originalPlatformOsDescriptor);
    }
  });

  beforeEach(() => {
    mockCookieManager.getAsArray.mockResolvedValue([]);
    mockCookieManager.getAllAsArray.mockResolvedValue([]);
    mockCookieManager.set.mockResolvedValue(true);
    mockCookieManager.clearAll.mockResolvedValue(true);
    mockCookieManager.clearAllStores.mockResolvedValue(true);
    mockCookieManager.flush.mockResolvedValue(undefined);
  });

  it("captures only live Riot and Valorant cookies", async () => {
    mockCookieManager.getAsArray.mockResolvedValue([
      {
        name: "ssid",
        value: "riot-session",
        domain: ".riotgames.com",
        path: "/",
      },
      {
        name: "xsso",
        value: "riot-sso",
        domain: "xsso.riotgames.com",
        path: "/login",
      },
      {
        name: "expired",
        value: "old",
        domain: ".riotgames.com",
        expires: "2000-01-01T00:00:00.000Z",
      },
      {
        name: "unrelated",
        value: "private",
        domain: ".example.com",
      },
    ]);

    await expect(captureRiotAuthCookies("network")).resolves.toEqual([
      expect.objectContaining({ name: "ssid", value: "riot-session" }),
      expect.objectContaining({ name: "xsso", value: "riot-sso" }),
    ]);
    expect(mockCookieManager.getAsArray).toHaveBeenCalledWith(
      "https://auth.riotgames.com/api/v1/authorization",
      false
    );
    expect(mockCookieManager.getAllAsArray).not.toHaveBeenCalled();
  });

  it("infers the queried Riot host when an older Android WebView omits metadata", async () => {
    mockCookieManager.getAsArray.mockResolvedValue([
      { name: "ssid", value: "legacy-webview-session" },
    ]);

    await expect(captureRiotAuthCookies("webview")).resolves.toEqual([
      expect.objectContaining({
        name: "ssid",
        value: "legacy-webview-session",
        domain: "auth.riotgames.com",
      }),
    ]);
  });

  it("clears the shared jar before restoring the selected account", async () => {
    const cookies = [
      {
        name: "ssid",
        value: "selected-account",
        domain: ".riotgames.com",
        path: "/",
        secure: true,
      },
    ];

    await expect(restoreRiotAuthCookies(cookies)).resolves.toBe(true);

    expect(mockCookieManager.clearAllStores).toHaveBeenCalledTimes(1);
    expect(mockCookieManager.set).toHaveBeenCalledWith(
      "https://riotgames.com/",
      cookies[0],
      false
    );
    expect(mockCookieManager.flush).toHaveBeenCalledTimes(1);
  });

  it("does not report an empty snapshot as a restored session", async () => {
    await expect(restoreRiotAuthCookies([])).resolves.toBe(false);

    expect(mockCookieManager.clearAllStores).toHaveBeenCalledTimes(1);
    expect(mockCookieManager.set).not.toHaveBeenCalled();
  });

  it("keeps web cookie operations independent of the native manager", async () => {
    await expect(webCookies.captureRiotAuthCookies()).resolves.toEqual([]);
    await expect(webCookies.restoreRiotAuthCookies()).resolves.toBe(false);
    await expect(webCookies.clearAllCookies()).resolves.toBe(false);
    expect(mockCookieManager.getAsArray).not.toHaveBeenCalled();
    expect(mockCookieManager.clearAllStores).not.toHaveBeenCalled();
    expect(mockCookieManager.set).not.toHaveBeenCalled();
  });

  it("prefers the originating iOS store and restores both cookie stores", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    const cookie = { name: "ssid", value: "web-session", domain: "auth.riotgames.com", path: "/" };
    mockCookieManager.getAllAsArray.mockImplementation(async (webKit: boolean) => [
      { ...cookie, value: webKit ? "web-session" : "network-session" },
    ]);
    try {
      await expect(captureRiotAuthCookies("webview")).resolves.toEqual([cookie]);
      await expect(captureRiotAuthCookies("network")).resolves.toEqual([
        { ...cookie, value: "network-session" },
      ]);
      await expect(restoreRiotAuthCookies([cookie])).resolves.toBe(true);
      expect(mockCookieManager.set).toHaveBeenCalledWith("https://auth.riotgames.com/", cookie, false);
      expect(mockCookieManager.set).toHaveBeenCalledWith("https://auth.riotgames.com/", cookie, true);
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    }
  });

  it("falls back to the legacy clear API for an older native binary", async () => {
    mockCookieManager.clearAllStores.mockRejectedValueOnce(
      new Error("not implemented")
    );

    await expect(restoreRiotAuthCookies([
      {
        name: "ssid",
        value: "selected-account",
        domain: ".riotgames.com",
      },
    ])).resolves.toBe(true);

    expect(mockCookieManager.clearAll).toHaveBeenCalledWith(true);
  });
});
