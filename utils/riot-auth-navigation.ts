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
