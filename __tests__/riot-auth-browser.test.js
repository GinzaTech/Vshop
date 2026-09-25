/* eslint-env jest, node */

const fs = require("node:fs");
const {
  BrowserAuthError,
  createRiotAuthBrowser,
} = require("../scripts/lib/riot-auth-browser.cjs");

const AUTHORIZATION_URL = "https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod";
const CALLBACK_URL = "https://playvalorant.com/opt_in#access_token=access-secret&id_token=id-secret";

const createFakeChromium = (launchOutcomes = []) => {
  const listeners = new Map();
  const mainFrame = {};
  const page = {
    on: jest.fn((event, listener) => listeners.set(event, listener)),
    off: jest.fn((event, listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    }),
    goto: jest.fn(async () => undefined),
    mainFrame: jest.fn(() => mainFrame),
  };
  const context = {
    newPage: jest.fn(async () => page),
    close: jest.fn(async () => undefined),
  };
  const browser = {
    newContext: jest.fn(async () => context),
    close: jest.fn(async () => undefined),
  };
  const chromium = {
    launch: jest.fn(async (options) => {
      const outcome = launchOutcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome || browser;
    }),
  };
  return {
    browser,
    chromium,
    context,
    page,
    emitNavigation(url, main = true) {
      listeners.get("framenavigated")?.({
        url: () => url,
        ...(main ? mainFrame : {}),
      });
    },
    emitMainNavigation(url) {
      mainFrame.url = () => url;
      listeners.get("framenavigated")?.(mainFrame);
    },
    emitClose() {
      listeners.get("close")?.();
    },
  };
};

describe("Riot auth browser broker", () => {
  test("observes only a top-level trusted callback and closes once", async () => {
    const fake = createFakeChromium();
    const broker = createRiotAuthBrowser({
      chromium: fake.chromium,
      channelOrder: ["msedge"],
    });
    const onCallback = jest.fn();
    const onClosed = jest.fn();
    const running = broker.open({
      authorizationUrl: AUTHORIZATION_URL,
      signal: new AbortController().signal,
      onCallback,
      onClosed,
    });
    await new Promise((resolve) => setImmediate(resolve));

    fake.emitNavigation(CALLBACK_URL, false);
    fake.emitMainNavigation("https://attacker.test/opt_in#access_token=a&id_token=b");
    expect(onCallback).not.toHaveBeenCalled();
    fake.emitMainNavigation(CALLBACK_URL);

    await running;
    expect(onCallback).toHaveBeenCalledWith(CALLBACK_URL);
    expect(onClosed).not.toHaveBeenCalled();
    expect(fake.context.close).toHaveBeenCalledTimes(1);
    expect(fake.browser.close).toHaveBeenCalledTimes(1);
  });

  test("falls back from Edge to Chrome using allowlisted channels", async () => {
    const fake = createFakeChromium([new Error("edge-missing")]);
    const broker = createRiotAuthBrowser({
      chromium: fake.chromium,
      channelOrder: ["msedge", "chrome"],
    });
    const running = broker.open({
      authorizationUrl: AUTHORIZATION_URL,
      signal: new AbortController().signal,
      onCallback: jest.fn(),
      onClosed: jest.fn(),
    });
    await new Promise((resolve) => setImmediate(resolve));
    fake.emitClose();
    await running;
    expect(fake.chromium.launch.mock.calls.map(([options]) => options.channel))
      .toEqual(["msedge", "chrome"]);
  });

  test("rejects unknown browser channels before launch", () => {
    const fake = createFakeChromium();
    let caught;
    try {
      createRiotAuthBrowser({
        chromium: fake.chromium,
        channelOrder: ["C:\\temp\\browser.exe"],
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "BROWSER_REJECTED" });
    expect(fake.chromium.launch).not.toHaveBeenCalled();
  });

  test("returns a stable error when no browser channel launches", async () => {
    const fake = createFakeChromium([
      new Error("edge-secret"),
      new Error("chrome-secret"),
    ]);
    const broker = createRiotAuthBrowser({
      chromium: fake.chromium,
      channelOrder: ["msedge", "chrome"],
    });
    await expect(broker.open({
      authorizationUrl: AUTHORIZATION_URL,
      signal: new AbortController().signal,
      onCallback: jest.fn(),
      onClosed: jest.fn(),
    })).rejects.toEqual(expect.objectContaining({
      code: "BROWSER_UNAVAILABLE",
      message: "BROWSER_UNAVAILABLE",
    }));
  });

  test("closes cleanly when the caller aborts", async () => {
    const fake = createFakeChromium();
    const controller = new AbortController();
    const broker = createRiotAuthBrowser({ chromium: fake.chromium });
    const running = broker.open({
      authorizationUrl: AUTHORIZATION_URL,
      signal: controller.signal,
      onCallback: jest.fn(),
      onClosed: jest.fn(),
    });
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await running;
    expect(fake.context.close).toHaveBeenCalledTimes(1);
    expect(fake.browser.close).toHaveBeenCalledTimes(1);
  });

  test("maps navigation failure without returning the raw browser message", async () => {
    const fake = createFakeChromium();
    fake.page.goto.mockRejectedValueOnce(new Error("navigation-secret"));
    const broker = createRiotAuthBrowser({ chromium: fake.chromium });
    await expect(broker.open({
      authorizationUrl: AUTHORIZATION_URL,
      signal: new AbortController().signal,
      onCallback: jest.fn(),
      onClosed: jest.fn(),
    })).rejects.toEqual(expect.objectContaining({
      code: "BROWSER_NAVIGATION_FAILED",
      message: "BROWSER_NAVIGATION_FAILED",
    }));
    expect(fake.context.close).toHaveBeenCalledTimes(1);
  });

  test("contains no DOM inspection, form automation, injection or URL logging", () => {
    const source = fs.readFileSync(
      require.resolve("../scripts/lib/riot-auth-browser.cjs"),
      "utf8",
    );
    expect(source).not.toMatch(/page\.(evaluate|locator|fill|type)|addInitScript/);
    expect(source).not.toMatch(/console\.(log|warn|error)|page\.url\(\).*log/);
  });

  test("exports a stable typed browser error", () => {
    expect(new BrowserAuthError("BROWSER_UNAVAILABLE"))
      .toMatchObject({ name: "BrowserAuthError", code: "BROWSER_UNAVAILABLE" });
  });
});
