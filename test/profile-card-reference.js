#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const DEFAULT_ENV_PATH = path.join(SCRIPT_DIR, ".env");
const DEFAULT_OUTPUT_PATH = path.join(SCRIPT_DIR, "profile-card-reference.json");

const CLIENT_PLATFORM =
  "eyJwbGF0Zm9ybVR5cGUiOiJQQyIsInBsYXRmb3JtT1MiOiJXaW5kb3dzIiwicGxhdGZvcm1PU1ZlcnNpb24iOiIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwicGxhdGZvcm1DaGlwc2V0IjoiVW5rbm93biJ9";
const DEFAULT_CLIENT_VERSION = "release-13.00-shipping-32-4990475";

const RANK_NAMES = {
  0: "Unrated",
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

const CURRENCY_IDS = {
  vp: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  rad: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kc: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
};

const getArg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const loadEnvFile = (envPath) => {
  const resolved = path.resolve(envPath);
  if (!fs.existsSync(resolved)) return null;

  for (const line of fs.readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }

  return resolved;
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "");

const maskId = (value) => {
  const text = String(value || "");
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
};

const maskSecret = (value) => {
  const text = String(value || "");
  if (!text) return "";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : "***";
};

const toRankTier = (value) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

const rankName = (tier) => (tier ? RANK_NAMES[tier] || `Tier ${tier}` : "Unrated");

const getMatchStartMs = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const decodeJwtPayload = (token) => {
  const normalized = normalizeToken(token);
  if (!normalized.includes(".")) return null;

  try {
    const payload = normalized.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const requestJson = async (name, url, options = {}) => {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { rawText: text.slice(0, 1000) };
    }
  }

  return {
    name,
    request: {
      method: options.method || "GET",
      url,
    },
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
      body,
    },
  };
};

const summarizeCompetitiveUpdates = (body) => {
  const matches = Array.isArray(body?.Matches) ? body.Matches : [];
  const sorted = [...matches].sort(
    (left, right) =>
      getMatchStartMs(right?.MatchStartTime) -
      getMatchStartMs(left?.MatchStartTime)
  );
  const latest = sorted[0] || null;
  const currentTier =
    toRankTier(latest?.TierAfterUpdate) || toRankTier(latest?.TierBeforeUpdate);
  const peakTier =
    sorted.reduce((max, match) => {
      const matchPeak = Math.max(
        toRankTier(match?.TierAfterUpdate) || 0,
        toRankTier(match?.TierBeforeUpdate) || 0
      );
      return matchPeak > (max || 0) ? matchPeak : max;
    }, null) || currentTier;

  return {
    matches: sorted.length,
    currentRank: {
      tier: currentTier,
      name: rankName(currentTier),
      icon: null,
    },
    peakRank: {
      tier: peakTier,
      name: rankName(peakTier),
      icon: null,
    },
    latestMatch: latest
      ? {
          matchId: latest.MatchID || null,
          tierBefore: toRankTier(latest.TierBeforeUpdate),
          tierAfter: toRankTier(latest.TierAfterUpdate),
          rrBefore: latest.RankedRatingBeforeUpdate ?? null,
          rrAfter: latest.RankedRatingAfterUpdate ?? null,
          rrEarned: latest.RankedRatingEarned ?? null,
          matchStartTime: latest.MatchStartTime || null,
        }
      : null,
  };
};

const summarizePlayerMmr = (body) => {
  const competitive = body?.QueueSkills?.competitive || null;
  const seasonalInfo = competitive?.SeasonalInfoBySeasonID || {};
  const latest = body?.LatestCompetitiveUpdate || null;
  const currentTier =
    toRankTier(latest?.TierAfterUpdate) ||
    toRankTier(competitive?.CompetitiveTier);
  const peakTier = Math.max(
    toRankTier(competitive?.HighestCompetitiveTier) || 0,
    toRankTier(latest?.TierAfterUpdate) || 0,
    ...Object.values(seasonalInfo).map((season) =>
      Math.max(
        toRankTier(season?.Rank) || 0,
        toRankTier(season?.CompetitiveTier) || 0,
        toRankTier(season?.SeasonHighestCompetitiveTier) || 0
      )
    )
  );

  return {
    currentRank: {
      tier: currentTier,
      name: rankName(currentTier),
      icon: null,
    },
    peakRank: {
      tier: peakTier || null,
      name: rankName(peakTier || null),
      icon: null,
    },
    latestCompetitiveUpdate: latest,
  };
};

const main = async () => {
  const envPath = loadEnvFile(getArg("--env", DEFAULT_ENV_PATH));
  const outputPath = path.resolve(
    getArg("--out", DEFAULT_OUTPUT_PATH)
  );
  const accessToken = normalizeToken(process.env.VALORANT_ACCESS_TOKEN);
  const entitlementsToken = normalizeToken(process.env.VALORANT_ENTITLEMENTS_TOKEN);
  const accessPayload = decodeJwtPayload(accessToken);
  const userId = process.env.VALORANT_PUUID || accessPayload?.sub || "";
  const region = (process.env.VALORANT_REGION || process.env.RIOT_REGION || "").toLowerCase();
  const shard = (process.env.VALORANT_SHARD || region || "ap").toLowerCase();
  const clientVersion = process.env.VALORANT_CLIENT_VERSION || DEFAULT_CLIENT_VERSION;

  console.log("[profile-card-reference] env", {
    path: envPath || DEFAULT_ENV_PATH,
    hasAccessToken: Boolean(accessToken),
    hasEntitlementsToken: Boolean(entitlementsToken),
    accessToken: maskSecret(accessToken),
    entitlementsToken: maskSecret(entitlementsToken),
    accessTokenLength: accessToken.length,
    entitlementsTokenLength: entitlementsToken.length,
    accessTokenExpiresAt: accessPayload?.exp
      ? new Date(accessPayload.exp * 1000).toISOString()
      : null,
  });

  if (!accessToken || !entitlementsToken || !userId || !shard) {
    throw new Error(
      `Missing VALORANT_ACCESS_TOKEN, VALORANT_ENTITLEMENTS_TOKEN, VALORANT_PUUID, or VALORANT_SHARD in ${envPath || DEFAULT_ENV_PATH}`
    );
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Riot-Entitlements-JWT": entitlementsToken,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    "X-Riot-ClientVersion": clientVersion,
    "Content-Type": "application/json",
  };

  const pdBase = `https://pd.${shard}.a.pvp.net`;
  const responses = {};

  responses.name = await requestJson(
    "name",
    `${pdBase}/name-service/v2/players`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify([userId]),
    }
  );
  responses.wallet = await requestJson(
    "wallet",
    `${pdBase}/store/v1/wallet/${userId}`,
    { headers }
  );
  responses.playerXp = await requestJson(
    "playerXp",
    `${pdBase}/account-xp/v1/players/${userId}`,
    { headers }
  );
  responses.playerLoadout = await requestJson(
    "playerLoadout",
    `${pdBase}/personalization/v2/players/${userId}/playerloadout`,
    { headers }
  );
  responses.playerMmr = await requestJson(
    "playerMmr",
    `${pdBase}/mmr/v1/players/${userId}`,
    { headers }
  );
  responses.competitiveUpdates = await requestJson(
    "competitiveUpdates",
    `${pdBase}/mmr/v1/players/${userId}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive`,
    { headers }
  );

  const nameBody = responses.name.response.body?.[0] || {};
  const walletBalances = responses.wallet.response.body?.Balances || {};
  const playerXp = responses.playerXp.response.body?.Progress || {};
  const identity = responses.playerLoadout.response.body?.Identity || {};
  if (identity.PlayerCardID) {
    responses.playerCard = await requestJson(
      "playerCard",
      `https://valorant-api.com/v1/playercards/${identity.PlayerCardID}`,
      {}
    );
  }
  const mmrSummary = responses.playerMmr.response.ok
    ? summarizePlayerMmr(responses.playerMmr.response.body)
    : null;
  const updatesSummary = responses.competitiveUpdates.response.ok
    ? summarizeCompetitiveUpdates(responses.competitiveUpdates.response.body)
    : null;
  const rankSummary = mmrSummary?.currentRank?.tier ? mmrSummary : updatesSummary;

  const output = {
    generatedAt: new Date().toISOString(),
    source: envPath ? `env:${envPath}` : "process.env",
    note: "Tokens are read from test/.env and are not written to this JSON file.",
    session: {
      puuid: maskId(userId),
      region,
      shard,
      clientVersion,
      accessTokenExpiresAt: accessPayload?.exp
        ? new Date(accessPayload.exp * 1000).toISOString()
        : null,
    },
    profileCardDataFields: [
      "badgeLabel",
      "regionLabel",
      "playerName",
      "tagLine",
      "subtitle",
      "level",
      "authStatus",
      "authLabel",
      "currencies",
      "currentRank",
      "peakRank",
    ],
    profileCardData: {
      badgeLabel: "Account",
      regionLabel: region.toUpperCase() || "VAL",
      playerName: nameBody.GameName || "Agent",
      tagLine: nameBody.TagLine || null,
      subtitle: "Profile overview",
      level: playerXp.Level ?? 0,
      authStatus: "synced",
      authLabel: "Account synced",
      playerCard: {
        id: identity.PlayerCardID || null,
        name: responses.playerCard?.response.body?.data?.displayName || null,
        displayIcon:
          responses.playerCard?.response.body?.data?.displayIcon || null,
        smallArt: responses.playerCard?.response.body?.data?.smallArt || null,
        wideArt: responses.playerCard?.response.body?.data?.wideArt || null,
        largeArt: responses.playerCard?.response.body?.data?.largeArt || null,
      },
      currencies: [
        {
          key: "vp",
          label: "VP",
          value: walletBalances[CURRENCY_IDS.vp] ?? 0,
          icon: "vp",
        },
        {
          key: "rad",
          label: "Radianite",
          value: walletBalances[CURRENCY_IDS.rad] ?? 0,
          icon: "rad",
        },
        {
          key: "kc",
          label: "Kingdom Credits",
          value: walletBalances[CURRENCY_IDS.kc] ?? 0,
          icon: "kc",
        },
      ],
      currentRank: rankSummary?.currentRank || {
        tier: null,
        name: "Unrated",
        icon: null,
      },
      peakRank: rankSummary?.peakRank || {
        tier: null,
        name: "Unrated",
        icon: null,
      },
    },
    responses,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`wrote ${outputPath}`);
};

main().catch((error) => {
  console.error(`profile-card-reference failed: ${error.message}`);
  process.exitCode = 1;
});
