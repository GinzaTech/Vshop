import { isAllowedRiotAuthNavigation } from "~/utils/riot-auth-navigation";

describe("Riot auth WebView navigation", () => {
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
