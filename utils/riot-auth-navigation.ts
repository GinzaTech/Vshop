const TRUSTED_AUTH_HOSTS = ["riotgames.com", "playvalorant.com"] as const;

const isTrustedHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return TRUSTED_AUTH_HOSTS.some(
    (trustedHost) =>
      normalized === trustedHost || normalized.endsWith(`.${trustedHost}`)
  );
};

/** Restrict top-level OAuth navigation while allowing Riot-owned subdomains. */
export const isAllowedRiotAuthNavigation = (value: string): boolean => {
  if (value === "about:blank") return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && isTrustedHostname(url.hostname);
  } catch {
    return false;
  }
};

export const isRiotAuthCallbackUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
    return url.protocol === "https:" && url.hostname === "playvalorant.com" &&
      !url.username && !url.password && /^\/(?:[a-z]{2}-[a-z]{2}\/)?opt_in\/?$/i.test(url.pathname) &&
      Boolean(params.get("access_token") && params.get("id_token"));
  } catch {
    return false;
  }
};
