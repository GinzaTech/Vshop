#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");

const CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
const DEFAULT_CLIENT_VERSION = "43.0.1.4195386.4190634";
const DEFAULT_LOCKFILE_PATH = path.join(
  process.env.LOCALAPPDATA || "",
  "Riot Games",
  "Riot Client",
  "Config",
  "lockfile"
);
const DEFAULT_VALORANT_LOG_DIR = path.join(
  process.env.LOCALAPPDATA || "",
  "VALORANT",
  "Saved",
  "Logs"
);

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

const SHARD_BY_REGION = {
  ap: "ap",
  as: "ap",
  jp1: "ap",
  vn2: "ap",
  br1: "na",
  la1: "na",
  la2: "na",
  na1: "na",
  eu: "eu",
  euw1: "eu",
  eun1: "eu",
  tr1: "eu",
  ru: "eu",
  kr: "kr",
  kr1: "kr",
};

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasFlag = (name) => process.argv.includes(name);

const maskId = (value) => {
  const text = String(value || "");
  return text.length > 12
    ? `${text.slice(0, 8)}...${text.slice(-4)}`
    : text;
};

const toTier = (value) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

const rankName = (tier) => (tier ? RANK_NAMES[tier] || `Tier ${tier}` : "Unrated");

const resolveShard = (...regions) => {
  for (const region of regions) {
    const normalized = String(region || "").trim().toLowerCase();
    if (!normalized) continue;
    return SHARD_BY_REGION[normalized] || normalized;
  }
  return "ap";
};

const decodeJwtPayload = (token) => {
  if (!token || !token.includes(".")) return null;

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const requestLocalJson = ({ port, password, endpoint }) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "127.0.0.1",
        port,
        path: `/${endpoint.replace(/^\//, "")}`,
        method: "GET",
        rejectUnauthorized: false,
        headers: {
          Authorization: `Basic ${Buffer.from(`riot:${password}`).toString("base64")}`,
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let data = null;
          try {
            data = body ? JSON.parse(body) : null;
          } catch {
            data = { rawText: body.slice(0, 300) };
          }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, statusText: res.statusMessage, data });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });

const requestJson = async ({ url, headers }) => {
  const startedAt = Date.now();
  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { rawText: text.slice(0, 300) };
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs: Date.now() - startedAt,
    data,
    responseHeaders: Object.fromEntries(response.headers.entries()),
  };
};

const requireOk = (name, response) => {
  if (response.ok) return response.data;
  throw new Error(`${name} failed: ${response.status} ${response.statusText}`);
};

const readLocalSession = async () => {
  const lockfilePath = getArg("--lockfile") || DEFAULT_LOCKFILE_PATH;
  if (!fs.existsSync(lockfilePath)) {
    throw new Error(`Riot Client lockfile not found: ${lockfilePath}`);
  }

  const [, , port, password] = fs.readFileSync(lockfilePath, "utf8").trim().split(":");
  const [entitlements, chatSession, regionLocale] = await Promise.all([
    requestLocalJson({ port, password, endpoint: "entitlements/v1/token" }),
    requestLocalJson({ port, password, endpoint: "chat/v1/session" }),
    requestLocalJson({ port, password, endpoint: "riotclient/region-locale" }),
  ]);

  const entitlementData = requireOk("Local entitlements", entitlements);
  const accessToken = entitlementData.accessToken || "";
  const entitlementsToken = entitlementData.token || "";
  const accessPayload = decodeJwtPayload(accessToken);
  const puuid =
    entitlementData.subject || chatSession.data?.puuid || accessPayload?.sub || "";
  const riotRegion =
    regionLocale.data?.region || chatSession.data?.region || accessPayload?.dat?.r || "";
  const shard = resolveShard(riotRegion, accessPayload?.dat?.r);

  if (!accessToken || !entitlementsToken || !puuid) {
    throw new Error("Local Riot Client session is missing token or PUUID.");
  }

  return {
    accessToken,
    entitlementsToken,
    accessPayload,
    puuid,
    riotRegion,
    shard,
  };
};

const getLatestClientVersion = async () => {
  const localClientVersion = getLocalClientVersion();
  if (localClientVersion) {
    return {
      version: localClientVersion,
      source: "ShooterGame.log",
    };
  }

  const result = await requestJson({
    url: "https://valorant-api.com/v1/version",
    headers: {},
  }).catch(() => null);
  const remoteVersion =
    result?.data?.data?.riotClientVersion ||
    result?.data?.data?.riotClientBuild ||
    null;

  return {
    version: remoteVersion || DEFAULT_CLIENT_VERSION,
    source: remoteVersion ? "valorant-api.com/v1/version" : "default",
  };
};

const getLocalClientVersion = () => {
  const logDir = getArg("--valorant-log-dir") || DEFAULT_VALORANT_LOG_DIR;
  if (!logDir || !fs.existsSync(logDir)) return null;

  const logFiles = fs
    .readdirSync(logDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^ShooterGame.*\.log$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(logDir, entry.name);
      const stat = fs.statSync(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const { filePath } of logFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/CI server version:\s*(release-[^\r\n\s]+)/i);
    if (match?.[1]) return match[1];
  }

  return null;
};

const getCompetitiveQueue = (mmr) => {
  const queueSkills = mmr?.QueueSkills;
  if (!queueSkills || typeof queueSkills !== "object") return null;
  return (
    queueSkills.competitive ||
    Object.entries(queueSkills).find(([queue]) =>
      String(queue).toLowerCase().includes("competitive")
    )?.[1] ||
    null
  );
};

const highestTierFromWins = (winsByTier) => {
  if (!winsByTier || typeof winsByTier !== "object") return null;
  return Object.keys(winsByTier).reduce((max, key) => {
    const tier = toTier(key);
    return tier && tier > (max || 0) ? tier : max;
  }, null);
};

const summaryFromPlayerMmr = (mmr) => {
  const competitive = getCompetitiveQueue(mmr);
  const seasons = Object.values(competitive?.SeasonalInfoBySeasonID || {});
  const latest = mmr?.LatestCompetitiveUpdate || null;
  const latestSeason = latest?.SeasonID
    ? competitive?.SeasonalInfoBySeasonID?.[latest.SeasonID]
    : null;
  const fallbackSeason =
    latestSeason ||
    seasons.find((season) => toTier(season?.CompetitiveTier || season?.Rank)) ||
    null;
  const currentTier =
    toTier(latest?.TierAfterUpdate) ||
    toTier(fallbackSeason?.CompetitiveTier) ||
    toTier(fallbackSeason?.Rank);
  const peakTier =
    seasons.reduce((max, season) => {
      const candidates = [
        toTier(season?.SeasonHighestCompetitiveTier),
        toTier(season?.HighestCompetitiveTier),
        highestTierFromWins(season?.WinsByTier),
      ].filter(Boolean);
      const seasonPeak = candidates.length ? Math.max(...candidates) : null;
      return seasonPeak && seasonPeak > (max || 0) ? seasonPeak : max;
    }, null) || currentTier;

  return {
    source: "MMR_FetchPlayer",
    currentTier,
    currentRank: rankName(currentTier),
    rankedRating: latest?.RankedRatingAfterUpdate ?? fallbackSeason?.RankedRating ?? null,
    peakTier,
    peakRank: rankName(peakTier),
    latestMatchId: latest?.MatchID || null,
    latestMatchTime: latest?.MatchStartTime
      ? new Date(latest.MatchStartTime).toISOString()
      : null,
  };
};

const debugBodyFromPlayerMmr = (mmr) => {
  const competitive = getCompetitiveQueue(mmr);
  const seasons = Object.values(competitive?.SeasonalInfoBySeasonID || {});
  const peakCandidates = seasons
    .map((season) => ({
      seasonId: season?.SeasonID || null,
      rank: toTier(season?.Rank),
      competitiveTier: toTier(season?.CompetitiveTier),
      seasonHighestCompetitiveTier: toTier(season?.SeasonHighestCompetitiveTier),
      highestCompetitiveTier: toTier(season?.HighestCompetitiveTier),
      winsByTierPeak: highestTierFromWins(season?.WinsByTier),
      wins: season?.NumberOfWins ?? null,
      games: season?.NumberOfGames ?? null,
    }))
    .filter(
      (season) =>
        season.rank ||
        season.competitiveTier ||
        season.seasonHighestCompetitiveTier ||
        season.highestCompetitiveTier ||
        season.winsByTierPeak
    )
    .sort((a, b) => {
      const peakA = Math.max(
        a.rank || 0,
        a.competitiveTier || 0,
        a.seasonHighestCompetitiveTier || 0,
        a.highestCompetitiveTier || 0,
        a.winsByTierPeak || 0
      );
      const peakB = Math.max(
        b.rank || 0,
        b.competitiveTier || 0,
        b.seasonHighestCompetitiveTier || 0,
        b.highestCompetitiveTier || 0,
        b.winsByTierPeak || 0
      );
      return peakB - peakA;
    })
    .slice(0, 8);

  return {
    version: mmr?.Version ?? null,
    subject: maskId(mmr?.Subject),
    latestCompetitiveUpdate: mmr?.LatestCompetitiveUpdate || null,
    competitiveSeasonCount: seasons.length,
    topPeakCandidates: peakCandidates,
    keys: mmr && typeof mmr === "object" ? Object.keys(mmr) : [],
  };
};

const summaryFromCompetitiveUpdates = (updates) => {
  const matches = Array.isArray(updates?.Matches) ? updates.Matches : [];
  const sorted = [...matches].sort(
    (a, b) => Number(b?.MatchStartTime || 0) - Number(a?.MatchStartTime || 0)
  );
  const latest = sorted[0] || null;
  const currentTier = toTier(latest?.TierAfterUpdate);
  const peakTier =
    sorted.reduce((max, match) => {
      const candidates = [
        toTier(match?.TierAfterUpdate),
        toTier(match?.TierBeforeUpdate),
      ].filter(Boolean);
      const matchPeak = candidates.length ? Math.max(...candidates) : null;
      return matchPeak && matchPeak > (max || 0) ? matchPeak : max;
    }, null) || currentTier;

  return {
    source: "MMR_FetchCompetitiveUpdates fallback",
    currentTier,
    currentRank: rankName(currentTier),
    rankedRating: latest?.RankedRatingAfterUpdate ?? null,
    recentPeakTier: peakTier,
    recentPeakRank: rankName(peakTier),
    latestRankedRatingDelta: latest?.RankedRatingEarned ?? null,
    latestPerformanceBonus: latest?.RankedRatingPerformanceBonus ?? null,
    latestMatchId: latest?.MatchID || null,
    latestMatchTime: latest?.MatchStartTime
      ? new Date(latest.MatchStartTime).toISOString()
      : null,
    checkedMatches: sorted.length,
    note: "Player MMR endpoint did not return 200, so this uses the latest competitive update.",
  };
};

const main = async () => {
  const session = await readLocalSession();
  const clientVersionInfo = await getLatestClientVersion();
  const clientVersion = clientVersionInfo.version;
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "X-Riot-Entitlements-JWT": session.entitlementsToken,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    "X-Riot-ClientVersion": clientVersion,
  };
  const baseUrl = `https://pd.${session.shard}.a.pvp.net/mmr/v1/players/${session.puuid}`;
  const maskedBaseUrl = `https://pd.${session.shard}.a.pvp.net/mmr/v1/players/${maskId(session.puuid)}`;
  const playerMmr = await requestJson({ url: baseUrl, headers });
  const debugPlayerMmr = hasFlag("--debug-player") || hasFlag("--debug");

  if (debugPlayerMmr) {
    console.log(
      JSON.stringify(
        {
          debug: "MMR_FetchPlayer request",
          request: {
            method: "GET",
            url: maskedBaseUrl,
            shard: session.shard,
            puuid: maskId(session.puuid),
            headers: {
              Authorization: `Bearer [redacted:${session.accessToken.length}]`,
              "X-Riot-Entitlements-JWT": `[redacted:${session.entitlementsToken.length}]`,
              "X-Riot-ClientPlatform": CLIENT_PLATFORM,
              "X-Riot-ClientVersion": clientVersion,
            },
            clientVersionSource: clientVersionInfo.source,
            tokenClaims: {
              iss: session.accessPayload?.iss || null,
              cid: session.accessPayload?.cid || null,
              platformId: session.accessPayload?.plt?.id || null,
              tokenRegion: session.accessPayload?.dat?.r || null,
              country: session.accessPayload?.dat?.c || null,
              exp: session.accessPayload?.exp
                ? new Date(session.accessPayload.exp * 1000).toISOString()
                : null,
              expired: session.accessPayload?.exp
                ? session.accessPayload.exp * 1000 <= Date.now()
                : null,
              scopes: session.accessPayload?.scp || null,
            },
          },
          response: {
            status: playerMmr.status,
            statusText: playerMmr.statusText,
            durationMs: playerMmr.durationMs,
            headers: {
              "content-type": playerMmr.responseHeaders["content-type"] || null,
              "x-riot-edge-trace-id":
                playerMmr.responseHeaders["x-riot-edge-trace-id"] || null,
              "x-riot-edge-region": playerMmr.responseHeaders["x-riot-edge-region"] || null,
              "x-envoy-upstream-service-time":
                playerMmr.responseHeaders["x-envoy-upstream-service-time"] || null,
              date: playerMmr.responseHeaders.date || null,
            },
            body: hasFlag("--full-body") ? playerMmr.data : playerMmr.ok ? null : playerMmr.data,
            bodySummary: playerMmr.ok ? debugBodyFromPlayerMmr(playerMmr.data) : null,
          },
        },
        null,
        2
      )
    );
  }

  const updates = await requestJson({
    url: `${baseUrl}/competitiveupdates?startIndex=0&endIndex=${Number(getArg("--limit") || 20)}&queue=competitive`,
    headers,
  });
  const summary = playerMmr.ok
    ? summaryFromPlayerMmr(playerMmr.data)
    : updates.ok
      ? summaryFromCompetitiveUpdates(updates.data)
      : null;

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        puuid: maskId(session.puuid),
        riotRegion: session.riotRegion,
        shard: session.shard,
        clientVersion: {
          value: clientVersion,
          source: clientVersionInfo.source,
        },
        token: {
          clientId: session.accessPayload?.cid || null,
          platformId: session.accessPayload?.plt?.id || null,
          expiresAt: session.accessPayload?.exp
            ? new Date(session.accessPayload.exp * 1000).toISOString()
            : null,
          expired: session.accessPayload?.exp
            ? session.accessPayload.exp * 1000 <= Date.now()
            : null,
        },
        endpoints: {
          playerMmr: {
            status: playerMmr.status,
            statusText: playerMmr.statusText,
            durationMs: playerMmr.durationMs,
            error: playerMmr.ok ? null : playerMmr.data,
          },
          competitiveUpdates: {
            status: updates.status,
            statusText: updates.statusText,
            durationMs: updates.durationMs,
            matches: Array.isArray(updates.data?.Matches) ? updates.data.Matches.length : 0,
            error: updates.ok ? null : updates.data,
          },
        },
        currentMmr: summary,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(`MMR current check failed: ${error.message}`);
  process.exitCode = 1;
});
