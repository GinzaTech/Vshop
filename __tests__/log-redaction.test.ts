import { redactLogValue, sanitizeErrorForLog, sanitizeUrlForLog } from "~/utils/log-redaction";

describe("log privacy", () => {
  it("redacts nested JSON strings, cookie records and mixed header formats without mutation", () => {
    const data = {
      stored: JSON.stringify({ state: { accessToken: "access-secret", authCookies: [{ name: "ssid", value: "jar-secret" }] } }),
      cookies: [{ name: "arbitrary", value: "cookie-secret" }],
      standalone: { name: "ssid", value: "standalone-secret" },
      headers: [["Authorization", "Bearer header-secret"], ["Set-Cookie", "ssid=set-secret"]],
      safe: 42,
    };
    const before = JSON.stringify(data);
    const safe = JSON.stringify(redactLogValue(data));
    for (const secret of ["access-secret", "jar-secret", "cookie-secret", "standalone-secret", "header-secret", "set-secret"]) {
      expect(safe).not.toContain(secret);
    }
    expect(safe).toContain("42");
    expect(JSON.stringify(data)).toBe(before);
  });

  it.each([
    'Authorization: Bearer opaque-secret',
    'Cookie: arbitrary=opaque-secret; other=other-secret',
    '{"access_token":"opaque-secret",broken',
    'access_token=opaque-secret&state=other-secret',
    'https://user:opaque-secret@example.test/callback#access_token=other-secret',
    '%7B%22access_token%22%3A%22opaque-secret%22%7D',
  ])("redacts credential-bearing text: %s", (value) => {
    const safe = JSON.stringify(redactLogValue(value));
    expect(safe).not.toContain("opaque-secret");
    expect(safe).not.toContain("other-secret");
  });

  it("omits secure values, cycles, oversized strings and getters", () => {
    const getter = jest.fn(() => "getter-secret");
    const data: Record<string, unknown> = { secureStorage: "encrypted-secret", enormous: "x".repeat(9000) + "tail-secret" };
    data.self = data;
    Object.defineProperty(data, "lazy", { get: getter, enumerable: true });
    const safe = JSON.stringify(redactLogValue(data));
    expect(safe).not.toMatch(/encrypted-secret|getter-secret|tail-secret/);
    expect(getter).not.toHaveBeenCalled();
  });

  it("removes account and match path IDs, query values, fragments and userinfo", () => {
    expect(sanitizeUrlForLog("https://user:pass@pd.ap.a.pvp.net/match-details/v1/matches/private-id?token=secret#nonce=secret"))
      .toBe("https://pd.ap.a.pvp.net/match-details/v1/matches/[REDACTED]");
    expect(sanitizeUrlForLog("/store/v3/storefront/account%2Fsecret?q=secret")).toBe("/store/v3/storefront/[REDACTED]");
    expect(sanitizeUrlForLog("not a URL containing secret")).not.toContain("secret");
  });

  it("returns safe error metadata without retaining arbitrary messages or Axios config", () => {
    const error = Object.assign(new Error("unlabelled-credential"), {
      code: "ERR_NETWORK", config: { headers: { Authorization: "secret" } }, response: { status: 401, data: "secret" },
    });
    expect(sanitizeErrorForLog(error)).toEqual({ name: "Error", message: "Operation failed", code: "ERR_NETWORK", status: 401 });
    expect(JSON.stringify(sanitizeErrorForLog("raw-secret"))).not.toContain("raw-secret");
  });

  it("redacts encoded path identifiers before URL decoding can split them", () => {
    const urls = [
      "https://example.test/players/account%2Fencoded-secret",
      "GET https://example.test/players/account%2Fencoded-secret",
      "https://example.test/matches/match%252Fencoded-secret",
    ];
    for (const url of urls) expect(JSON.stringify(redactLogValue(url))).not.toContain("encoded-secret");
  });

  it("handles Headers objects and hostile proxies without leaking or throwing", () => {
    const headers = new Headers({ Authorization: "Bearer header-secret", "content-type": "application/json" });
    expect(JSON.stringify(redactLogValue(headers))).not.toContain("header-secret");
    const proxy = new Proxy({}, { ownKeys: () => { throw new Error("proxy-secret"); }, getOwnPropertyDescriptor: () => { throw new Error("proxy-secret"); } });
    expect(redactLogValue(proxy)).toBe("[REDACTED]");
    expect(sanitizeErrorForLog(proxy)).toEqual({ name: "Error", message: "Operation failed" });
    expect(sanitizeUrlForLog("file:///private-secret")).toBe("[REDACTED]");
    expect(redactLogValue("%AA")).toBe("[REDACTED]");
  });
});
