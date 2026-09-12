import { isAllowedRiotAuthNavigation, isRiotAuthCallbackUrl } from "~/utils/riot-auth-navigation";

describe("Riot auth WebView navigation", () => {
  it.each(["#", "?"])("accepts the Riot callback with %s credentials", (separator) => {
    expect(isRiotAuthCallbackUrl(`https://playvalorant.com/opt_in${separator}access_token=a&id_token=b`)).toBe(true);
  });

  it.each([
    "/opt_in/",
    "/vi-vn/opt_in/",
    "/en-us/opt_in",
    "/ja-jp/opt_in/",
  ])("accepts Riot's localized callback %s", (path) => {
    expect(isRiotAuthCallbackUrl(`https://playvalorant.com${path}#access_token=a&id_token=b`)).toBe(true);
  });

  it.each([
    "https://playvalorant.com/untrusted/opt_in#access_token=a&id_token=b",
    "https://playvalorant.com/vi-vn/other/opt_in#access_token=a&id_token=b",
    "https://attacker@playvalorant.com/vi-vn/opt_in#access_token=a&id_token=b",
    "https://example.com/opt_in#access_token=a&id_token=b",
    "https://playvalorant.com/other#access_token=a&id_token=b",
    "https://playvalorant.com/opt_in#access_token=a",
    "http://playvalorant.com/opt_in#access_token=a&id_token=b",
  ])("rejects an invalid auth callback %s", (url) => {
    expect(isRiotAuthCallbackUrl(url)).toBe(false);
  });
  it.each([
    "https://auth.riotgames.com/authorize",
    "https://xsso.riotgames.com/login",
    "https://playvalorant.com/opt_in#access_token=token",
    "https://www.playvalorant.com/en-us/",
    "about:blank",
  ])("allows trusted navigation %s", (url) => {
    expect(isAllowedRiotAuthNavigation(url)).toBe(true);
  });

  it.each([
    "http://auth.riotgames.com/authorize",
    "https://riotgames.com.example.org/login",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "not-a-url",
  ])("blocks untrusted navigation %s", (url) => {
    expect(isAllowedRiotAuthNavigation(url)).toBe(false);
  });
});
