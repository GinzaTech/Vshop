import {
  getHttpStatus,
  getRequestUrl,
  getRequestAccessToken,
  isCurrentSessionAuthFailure,
  isRiotAuthenticationError,
  isTransientNetworkError,
  notifySessionAuthFailure,
  subscribeSessionAuthFailures,
} from "~/utils/session-events";

describe("session event classification", () => {
  test("ignores delayed auth failures from a superseded bearer token", () => {
    const accessToken = getRequestAccessToken({ config: { headers: { Authorization: "Bearer old-token" } } });
    expect(accessToken).toBe("old-token");
    expect(isCurrentSessionAuthFailure({ status: 401, url: "https://pd.ap.a.pvp.net", accessToken }, "new-token")).toBe(false);
    expect(isCurrentSessionAuthFailure({ status: 401, url: "https://pd.ap.a.pvp.net", accessToken }, "old-token")).toBe(true);
  });
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
    [403, "https://pd.ap.a.pvp.net/name-service/v2/players"],
    [403, "https://pd.eu.a.pvp.net/name-service/v2/players?trace=1"],
  ])("recognizes Riot authentication failure %s for %s", (status, url) => {
    expect(
      isRiotAuthenticationError({ response: { status, config: { url } } })
    ).toBe(true);
  });

  test.each([
    [403, "https://pd.ap.a.pvp.net/store/v3/storefront/user"],
    [403, "https://pd.ap.a.pvp.net/name-service/v2/players/other"],
    [403, "https://glz-ap-1.ap.a.pvp.net/name-service/v2/players"],
    [403, "https://pd.ap.a.pvp.net.attacker.test/name-service/v2/players"],
    [401, "https://example.com/private"],
    [500, "https://auth.riotgames.com/api/v1/authorization"],
    [401, "https://auth.riotgames.com.attacker.test/private"],
    [401, "https://example.com/?next=https://auth.riotgames.com"],
    [401, "https://auth.riotgames.com@example.com/private"],
    [401, "http://auth.riotgames.com/api/v1/authorization"],
    [401, "https://example.com/path/.a.pvp.net"],
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

  test.each([408, 425, 429, 500, 503])(
    "recognizes recoverable HTTP status %s",
    (status) => {
      expect(isTransientNetworkError({ response: { status } })).toBe(true);
    }
  );

  test("does not treat permanent HTTP responses or unknown errors as transient", () => {
    expect(
      isTransientNetworkError({
        code: "ERR_NETWORK",
        response: { status: 400 },
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
