/* eslint-env node */

"use strict";

const ALLOWED_CHANNELS = new Set(["msedge", "chrome"]);
const ALLOWED_SAME_SITE = new Map([
  ["lax", "Lax"],
  ["strict", "Strict"],
  ["none", "None"],
]);

class BrowserAuthError extends Error {
  constructor(code) {
    super(code);
    this.name = "BrowserAuthError";
    this.code = code;
  }
}

const isTrustedRiotCallback = (value) => {
  if (typeof value !== "string" || value.length > 32_768) return false;
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
    return url.protocol === "https:" &&
      url.hostname === "playvalorant.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/(?:[a-z]{2}-[a-z]{2}\/)?opt_in\/?$/i.test(url.pathname) &&
      Boolean(params.get("access_token")) &&
      Boolean(params.get("id_token"));
  } catch {
    return false;
  }
};

const closeQuietly = async (value) => {
  if (!value || typeof value.close !== "function") return;
  try {
    await value.close();
  } catch {
    // Cleanup must remain idempotent even after a browser process crash.
  }
};

const normalizeDomain = (value) => String(value || "")
  .trim()
  .replace(/^\./, "")
  .toLowerCase();

const isRiotDomain = (value) => {
  const domain = normalizeDomain(value);
  return ["riotgames.com", "playvalorant.com"].some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
};

const normalizeSeedCookies = (value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 128) {
    throw new BrowserAuthError("COOKIE_REJECTED");
  }
  return value.map((cookie) => {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie) ||
        typeof cookie.name !== "string" || !cookie.name || cookie.name.length > 256 ||
        typeof cookie.value !== "string" || !cookie.value || cookie.value.length > 16 * 1024 ||
        !isRiotDomain(cookie.domain) ||
        (cookie.path !== undefined && typeof cookie.path !== "string") ||
        (cookie.secure !== undefined && typeof cookie.secure !== "boolean") ||
        (cookie.httpOnly !== undefined && typeof cookie.httpOnly !== "boolean") ||
        (cookie.sameSite !== undefined && !ALLOWED_SAME_SITE.has(cookie.sameSite))) {
      throw new BrowserAuthError("COOKIE_REJECTED");
    }
    const expiresAt = cookie.expires ? Date.parse(cookie.expires) : NaN;
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      secure: cookie.secure !== false,
      httpOnly: Boolean(cookie.httpOnly),
      ...(cookie.sameSite ? { sameSite: ALLOWED_SAME_SITE.get(cookie.sameSite) } : {}),
      ...(Number.isFinite(expiresAt) ? { expires: Math.floor(expiresAt / 1000) } : {}),
    };
  });
};

const captureRiotCookies = (cookies) => cookies
  .filter((cookie) => isRiotDomain(cookie.domain))
  .map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    ...(typeof cookie.sameSite === "string" && cookie.sameSite
      ? { sameSite: cookie.sameSite.toLowerCase() }
      : {}),
    ...(typeof cookie.expires === "number" && cookie.expires > 0
      ? { expires: new Date(cookie.expires * 1000).toISOString() }
      : {}),
  }));

function createRiotAuthBrowser({
  chromium,
  channelOrder = ["msedge", "chrome"],
} = {}) {
  if (!chromium || typeof chromium.launch !== "function") {
    throw new BrowserAuthError("BROWSER_UNAVAILABLE");
  }
  const channels = [...channelOrder];
  if (!channels.length || channels.some((channel) => !ALLOWED_CHANNELS.has(channel))) {
    throw new BrowserAuthError("BROWSER_REJECTED");
  }

  const launch = async () => {
    for (const channel of channels) {
      try {
        return await chromium.launch({ channel, headless: false });
      } catch {
        // Try the next allowlisted installed browser without exposing raw errors.
      }
    }
    throw new BrowserAuthError("BROWSER_UNAVAILABLE");
  };

  const open = async ({
    authorizationUrl,
    signal,
    seedCookies,
    onCookies,
    onCallback,
    onClosed,
  }) => {
    const normalizedCookies = normalizeSeedCookies(seedCookies);
    let browser;
    let context;
    let page;
    let settled = false;
    let resolveOutcome;
    const outcome = new Promise((resolve) => {
      resolveOutcome = resolve;
    });
    const settle = (kind) => {
      if (settled) return;
      settled = true;
      if (kind === "closed") onClosed();
      resolveOutcome(kind);
    };
    const handleNavigation = (frame) => {
      if (frame !== page?.mainFrame()) return;
      const value = frame.url();
      if (!isTrustedRiotCallback(value)) return;
      try {
        onCallback(value);
        settle("callback");
      } catch {
        settle("callback-error");
      }
    };
    const handleClose = () => settle("closed");
    const handleAbort = () => settle("aborted");

    try {
      browser = await launch();
      context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: "block",
      });
      if (normalizedCookies.length) await context.addCookies(normalizedCookies);
      page = await context.newPage();
      page.on("framenavigated", handleNavigation);
      page.on("close", handleClose);
      signal?.addEventListener("abort", handleAbort, { once: true });
      if (signal?.aborted) settle("aborted");
      try {
        await page.goto(authorizationUrl, { waitUntil: "domcontentloaded" });
      } catch {
        if (!signal?.aborted) throw new BrowserAuthError("BROWSER_NAVIGATION_FAILED");
      }
      await outcome;
    } finally {
      signal?.removeEventListener("abort", handleAbort);
      page?.off?.("framenavigated", handleNavigation);
      page?.off?.("close", handleClose);
      if (context && typeof onCookies === "function") {
        try {
          onCookies(captureRiotCookies(await context.cookies()));
        } catch {
          // Cookie capture is best effort; auth callback validation remains authoritative.
        }
      }
      await closeQuietly(context);
      await closeQuietly(browser);
    }
  };

  return Object.freeze({ open });
}

module.exports = {
  BrowserAuthError,
  createRiotAuthBrowser,
  isTrustedRiotCallback,
};
