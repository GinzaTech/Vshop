import {
  getHttpStatus,
  getRequestUrl,
  isRiotAuthenticationError,
  isTransientNetworkError,
  notifySessionAuthFailure,
  subscribeSessionAuthFailures,
} from "~/utils/session-events";

describe("session event classification", () => {
  test("extracts HTTP status and request URL", () => {
    const error = {
      config: { url: "https://fallback.example" },
      response: {
        status: 401,
        config: { url: "https://pd.ap.a.pvp.net/store/v3/storefront/user" },
      },
    };

    expect(getHttpStatus(error)).toBe(401);
    expect(getRequestUrl(error)).toBe(
      "https://pd.ap.a.pvp.net/store/v3/storefront/user"
    );
    expect(getHttpStatus({ response: { status: "invalid" } })).toBeNull();
    expect(getRequestUrl({ config: { url: "https://fallback.example" } })).toBe(
      "https://fallback.example"
    );
    expect(getRequestUrl(undefined)).toBe("");
  });

  test.each([
    [401, "https://auth.riotgames.com/api/v1/authorization"],
    [401, "https://entitlements.auth.riotgames.com/api/token/v1"],
    [401, "https://pd.ap.a.pvp.net/store/v3/storefront/user"],
    [401, "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat"],
    [403, "https://auth.riotgames.com/api/v1/authorization"],
  ])("recognizes Riot authentication failure %s for %s", (status, url) => {
    expect(
      isRiotAuthenticationError({ response: { status, config: { url } } })
    ).toBe(true);
  });

  test.each([
    [403, "https://pd.ap.a.pvp.net/store/v3/storefront/user"],
    [401, "https://example.com/private"],
    [500, "https://auth.riotgames.com/api/v1/authorization"],
  ])("does not misclassify HTTP %s for %s", (status, url) => {
    expect(
      isRiotAuthenticationError({ response: { status, config: { url } } })
    ).toBe(false);
  });

  test.each(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ECONNRESET"])(
    "recognizes transient network code %s",
    (code) => {
      expect(isTransientNetworkError({ code })).toBe(true);
    }
  );

  test.each([
    "Network Error",
    "Request timeout exceeded",
    "No internet connection",
  ])("recognizes transient network message: %s", (message) => {
    expect(isTransientNetworkError({ message })).toBe(true);
  });

  test("does not treat HTTP responses or unknown errors as transient", () => {
    expect(
      isTransientNetworkError({
        code: "ERR_NETWORK",
        response: { status: 503 },
      })
    ).toBe(false);
    expect(isTransientNetworkError(new Error("Unexpected failure"))).toBe(false);
  });
});

describe("session auth failure subscriptions", () => {
  test("notifies active listeners and stops after unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionAuthFailures(listener);
    const failure = {
      status: 401,
      url: "https://pd.ap.a.pvp.net/store/v3/storefront/user",
    };

    notifySessionAuthFailure(failure);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(failure);

    unsubscribe();
    notifySessionAuthFailure(failure);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
