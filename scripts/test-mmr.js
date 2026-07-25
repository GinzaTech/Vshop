#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
const DEFAULT_CLIENT_VERSION = "43.0.1.4195386.4190634";
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_MATCHES = 120;

const RANK_NAMES = {
  0: "Unrated",
  1: "Unused 1",
  2: "Unused 2",
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
  br: "na",
  eu: "eu",
  kr: "kr",
  latam: "na",
  na: "na",
};

const MMR_ENDPOINTS = {
  player: {
    queryName: "MMR_FetchPlayer",
    method: "GET",
    docs:
      "valorant-api-docs/docs/PVP Endpoints/GET MMR_FetchPlayer.md",
    path: (session) => `/mmr/v1/players/${session.userId}`,
  },
  competitiveUpdates: {
    queryName: "MMR_FetchCompetitiveUpdates",
    method: "GET",
    docs:
      "valorant-api-docs/docs/PVP Endpoints/GET MMR_FetchCompetitiveUpdates.md",
    path: (session) => `/mmr/v1/players/${session.userId}/competitiveupdates`,
  },
  leaderboard: {
    queryName: "MMR_FetchLeaderboard",
    method: "GET",
    docs:
      "valorant-api-docs/docs/PVP Endpoints/GET MMR_FetchLeaderboard.md",
    path: (_session, seasonId) =>
      `/mmr/v1/leaderboards/affinity/${getLeaderboardAffinity(_session)}/queue/competitive/season/${seasonId}`,
  },
};

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasFlag = (name) => process.argv.includes(name);

const getNumberArg = (name, fallback) => {
  const value = Number(getArg(name));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const getLeaderboardAffinity = (session) =>
  (
    getArg("--leaderboard-affinity") ||
    process.env.VALORANT_LEADERBOARD_AFFINITY ||
    session.shard ||
    session.region ||
    "ap"
  ).toLowerCase();

const loadEnvFile = (envPath, { override = false } = {}) => {
  if (!envPath) return null;

  const resolvedPath = path.resolve(envPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Env file not found: ${resolvedPath}`);
  }

  const lines = fs.readFileSync(resolvedPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }

  return resolvedPath;
};

const explicitEnvPath = getArg("--env") || process.env.VSHOP_ENV_FILE;
const explicitDbPath = getArg("--db") || process.env.VSHOP_SESSION_DB;
const explicitSessionJsonPath =
  getArg("--session-json") || process.env.VSHOP_SESSION_JSON;
const defaultEnvPath = path.resolve("test", ".env");
const shouldUseDefaultEnv =
  !explicitEnvPath &&
  !explicitDbPath &&
  !explicitSessionJsonPath &&
  fs.existsSync(defaultEnvPath);
const loadedEnvPath = loadEnvFile(explicitEnvPath || (shouldUseDefaultEnv ? defaultEnvPath : null), {
  override: Boolean(explicitEnvPath || shouldUseDefaultEnv),
});

const maskId = (value) => {
  if (!value) return "";
  const text = String(value);
  return text.length > 12
    ? `${text.slice(0, 8)}...${text.slice(-4)}`
    : text;
};

const normalizeToken = (value) => {
  let token = String(value || "").trim();

  if (!token) return "";

  if (token.includes("access_token=")) {
    const match = token.match(/access_token=([^&#\s]+)/);
    token = match?.[1] || token;
  }

  if (token.includes("entitlements_token=")) {
    const match = token.match(/entitlements_token=([^&#\s]+)/);
    token = match?.[1] || token;
  }

  if (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "");
  }

  try {
    token = decodeURIComponent(token);
  } catch {}

  return token.trim();
};

const decodeJwtPayload = (token) => {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken || !normalizedToken.includes(".")) return null;

  try {
    const payload = normalizedToken.split(".")[1];
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

const summarizeJwt = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    iss: payload.iss || null,
    cid: payload.cid || null,
    sub: maskId(payload.sub),
    exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    scp: Array.isArray(payload.scp) ? payload.scp : null,
    platformId: payload?.plt?.id || null,
    region: payload?.dat?.r || null,
    country: payload?.dat?.c || null,
  };
};

const validateSessionClaims = (session) => {
  const accessPayload = decodeJwtPayload(session.accessToken);

  if (!accessPayload) {
    throw new Error(
      "VALORANT_ACCESS_TOKEN is not a valid JWT. Use the RSO access token, not id_token or a copied header value."
    );
  }

  if (accessPayload.iss !== "https://auth.riotgames.com") {
    throw new Error(
      `VALORANT_ACCESS_TOKEN has wrong issuer: ${accessPayload.iss || "unknown"}. Use the RSO access token from Riot auth.`
    );
  }

  if (accessPayload.exp && accessPayload.exp * 1000 <= Date.now()) {
    throw new Error(
      `VALORANT_ACCESS_TOKEN expired at ${new Date(accessPayload.exp * 1000).toISOString()}. Re-login to Riot Client/Valorant and export a fresh local session token.`
    );
  }

  if (accessPayload.cid) {
    console.log(`[token] client id: ${accessPayload.cid}`);
  }

  if (accessPayload?.plt?.id) {
    console.log(`[token] platform id: ${accessPayload.plt.id}`);
  }

  if (accessPayload.cid === "play-valorant-web-prod") {
    throw new Error(
      "VALORANT_ACCESS_TOKEN is a Riot web token from play-valorant-web-prod. Valorant PVP/MMR endpoints require a Riot Client/Valorant local session access token, not a web login token."
    );
  }

  if (accessPayload?.plt?.id === "web") {
    throw new Error(
      "VALORANT_ACCESS_TOKEN has plt.id=web. This is a web token and is not valid for pd.{shard}.a.pvp.net PVP/MMR endpoints. Use a Riot Client/Valorant local session token."
    );
  }

  const tokenRegion = String(accessPayload?.dat?.r || "").toLowerCase();
  const configuredRegion = String(session.region || session.shard || "").toLowerCase();
  if (tokenRegion && configuredRegion && tokenRegion !== configuredRegion) {
    console.warn(
      `[token] access token region (${tokenRegion}) differs from configured region/shard (${configuredRegion}). This is a warning only; continuing with configured shard.`
    );
  }

  const scopes = Array.isArray(accessPayload.scp) ? accessPayload.scp : [];
  if (!scopes.includes("account") || !scopes.includes("openid")) {
    console.warn(
      `[token] access token scope looks unusual: ${JSON.stringify(scopes)}`
    );
  }

  const entitlementPayload = decodeJwtPayload(session.entitlementsToken);
  if (
    entitlementPayload?.iss &&
    entitlementPayload.iss !== "https://entitlements.auth.riotgames.com"
  ) {
    console.warn(
      `[token] entitlement token issuer looks unusual: ${entitlementPayload.iss}`
    );
  }

  return accessPayload;
};

const readSessionFromDb = (dbPath) => {
  if (!dbPath || !fs.existsSync(dbPath)) return null;

  const result = spawnSync(
    "sqlite3",
    [
      dbPath,
      "select value from catalystLocalStorage where key='user-session' limit 1;",
    ],
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (result.error || result.status !== 0) {
    const reason = result.error?.message || result.stderr?.trim();
    throw new Error(`Cannot read AsyncStorage sqlite DB: ${reason}`);
  }

  const raw = result.stdout.trim();
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  return parsed?.state?.user ?? null;
};

const readSessionFromJson = (sessionJsonPath) => {
  if (!sessionJsonPath) return null;

  const raw = fs.readFileSync(sessionJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed?.state?.user ?? parsed?.user ?? parsed;
};

const getSession = () => {
  const dbPath =
    explicitDbPath ||
    path.join(os.tmpdir(), "vshop_RKStorage.sqlite");
  const sessionJsonPath = explicitSessionJsonPath;
  const fileSession =
    readSessionFromJson(sessionJsonPath) || readSessionFromDb(dbPath);
  const accessToken = normalizeToken(
    process.env.VALORANT_ACCESS_TOKEN ||
    process.env.RIOT_ACCESS_TOKEN ||
    fileSession?.accessToken ||
    ""
  );
  const idToken =
    process.env.VALORANT_ID_TOKEN ||
    process.env.RIOT_ID_TOKEN ||
    fileSession?.idToken ||
    "";
  const decodedAccessToken = decodeJwtPayload(accessToken);
  const region = (
    process.env.VALORANT_REGION ||
    process.env.RIOT_REGION ||
    fileSession?.region ||
    ""
  ).toLowerCase();

  return {
    accessToken,
    idToken,
    entitlementsToken: normalizeToken(
      process.env.VALORANT_ENTITLEMENTS_TOKEN ||
      process.env.RIOT_ENTITLEMENTS_TOKEN ||
      fileSession?.entitlementsToken ||
      ""
    ),
    region,
    shard: (
      process.env.VALORANT_SHARD ||
      process.env.RIOT_SHARD ||
      SHARD_BY_REGION[region] ||
      region ||
      ""
    ).toLowerCase(),
    userId:
      process.env.VALORANT_PUUID ||
      process.env.RIOT_PUUID ||
      fileSession?.id ||
      decodedAccessToken?.sub ||
      "",
    source: loadedEnvPath
      ? `env:${loadedEnvPath}`
      : sessionJsonPath
        ? `json:${sessionJsonPath}`
        : fs.existsSync(dbPath)
          ? `db:${dbPath}`
          : "env",
    accessTokenExpiresAt: decodedAccessToken?.exp
      ? new Date(decodedAccessToken.exp * 1000).toISOString()
      : null,
  };
};

const requestJson = async ({ url, method = "GET", headers = {}, body }) => {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text.slice(0, 500) };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    durationMs: Date.now() - startedAt,
    data,
    url,
  };
};

const getLatestClientVersion = async () => {
  const response = await requestJson({
    url: "https://valorant-api.com/v1/version",
  });

  return (
    response.data?.data?.riotClientVersion ||
    response.data?.data?.riotClientBuild ||
    DEFAULT_CLIENT_VERSION
  );
};

const getEntitlementsToken = async (session, clientVersion) => {
  const response = await requestJson({
    url: "https://entitlements.auth.riotgames.com/api/token/v1/",
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      "X-Riot-ClientPlatform": CLIENT_PLATFORM,
      "X-Riot-ClientVersion": clientVersion,
    },
    body: {},
  });

  return response.ok ? response.data?.entitlements_token || "" : "";
};

const resolveLiveShard = async (session) => {
  if (!session.idToken) return session.shard;

  const response = await requestJson({
    url: "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
    method: "PUT",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: { id_token: session.idToken },
  });

  const liveRegion = response.data?.affinities?.live;
  return (
    SHARD_BY_REGION[liveRegion] ||
    liveRegion ||
    session.shard ||
    session.region
  ).toLowerCase();
};

const clientHeaders = (session, clientVersion) => ({
  Authorization: `Bearer ${session.accessToken}`,
  "X-Riot-Entitlements-JWT": session.entitlementsToken,
  "X-Riot-ClientPlatform": CLIENT_PLATFORM,
  "X-Riot-ClientVersion": clientVersion,
});

const makePdUrl = (session, endpointPath, query) => {
  const url = new URL(`https://pd.${session.shard}.a.pvp.net${endpointPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
};

const toTier = (value) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

const rankName = (tier) => (tier ? RANK_NAMES[tier] || `Tier ${tier}` : "Unrated");

const getMatchStartMs = (value) => {
  const ms = Number(value ?? 0);
  return Number.isFinite(ms) ? ms : 0;
};

const highestTierFromWins = (winsByTier) => {
  if (!winsByTier || typeof winsByTier !== "object") return null;

  return Object.keys(winsByTier).reduce((max, key) => {
    const tier = toTier(key);
    return tier && tier > (max || 0) ? tier : max;
  }, null);
};

const resolveCompetitiveQueue = (queueSkills) => {
  if (!queueSkills || typeof queueSkills !== "object") return null;
  return (
    queueSkills.competitive ||
    Object.entries(queueSkills).find(([queueId]) =>
      String(queueId).toLowerCase().includes("competitive")
    )?.[1] ||
    Object.values(queueSkills).find((queue) => queue?.SeasonalInfoBySeasonID) ||
    null
  );
};

const summarizePlayerMmr = (mmr) => {
  const queueSkills = mmr?.QueueSkills || {};
  const competitive = resolveCompetitiveQueue(queueSkills);
  const seasonalInfo = competitive?.SeasonalInfoBySeasonID || {};
  const seasons = Object.values(seasonalInfo);
  const latest = mmr?.LatestCompetitiveUpdate || null;
  const latestSeason = latest?.SeasonID ? seasonalInfo[latest.SeasonID] : null;
  const fallbackSeason =
    latestSeason ||
    seasons.find((season) => toTier(season?.CompetitiveTier)) ||
    seasons.find((season) => toTier(season?.Rank)) ||
    null;
  const currentTier =
    toTier(latest?.TierAfterUpdate) ||
    toTier(fallbackSeason?.CompetitiveTier) ||
    toTier(fallbackSeason?.Rank);
  const seasonSummaries = seasons.map((season) => {
    const peakTier = Math.max(
      toTier(season?.Rank) || 0,
      toTier(season?.CompetitiveTier) || 0,
      highestTierFromWins(season?.WinsByTier) || 0
    );

    return {
      seasonId: season?.SeasonID || null,
      rank: toTier(season?.Rank),
      competitiveTier: toTier(season?.CompetitiveTier),
      rankedRating: season?.RankedRating ?? null,
      wins: season?.NumberOfWins ?? null,
      games: season?.NumberOfGames ?? null,
      peakTier: peakTier || null,
      peakName: peakTier ? rankName(peakTier) : "Unrated",
    };
  });
  const bestSeason = [...seasonSummaries].sort(
    (left, right) => (right.peakTier || 0) - (left.peakTier || 0)
  )[0] || null;
  const peakTier = bestSeason?.peakTier || null;

  return {
    subject: maskId(mmr?.Subject),
    queues: Object.keys(queueSkills),
    seasonCount: seasons.length,
    currentTier,
    currentName: rankName(currentTier),
    peakTier,
    peakName: rankName(peakTier),
    bestSeason,
    latestCompetitiveUpdate: latest
      ? {
          matchId: latest.MatchID,
          seasonId: latest.SeasonID,
          tierBefore: toTier(latest.TierBeforeUpdate),
          tierAfter: toTier(latest.TierAfterUpdate),
          rrBefore: latest.RankedRatingBeforeUpdate ?? null,
          rrAfter: latest.RankedRatingAfterUpdate ?? null,
          rrEarned: latest.RankedRatingEarned ?? null,
          performanceBonus: latest.RankedRatingPerformanceBonus ?? null,
          afkPenalty: latest.AFKPenalty ?? null,
          matchStartTime: latest.MatchStartTime
            ? new Date(latest.MatchStartTime).toISOString()
            : null,
        }
      : null,
    isLeaderboardAnonymized: mmr?.IsLeaderboardAnonymized ?? null,
    isActRankBadgeHidden: mmr?.IsActRankBadgeHidden ?? null,
  };
};

const summarizeCompetitiveUpdates = (updates) => {
  const matches = Array.isArray(updates?.Matches) ? updates.Matches : [];
  const sorted = [...matches].sort(
    (left, right) =>
      getMatchStartMs(right?.MatchStartTime) - getMatchStartMs(left?.MatchStartTime)
  );
  const latest = sorted[0] || null;
  const rrDelta = sorted.reduce(
    (total, match) => total + Number(match?.RankedRatingEarned || 0),
    0
  );

  return {
    subject: maskId(updates?.Subject),
    matches: sorted.length,
    note: "Not used as a rank source; rank must come from MMR_FetchPlayer.",
    rrDelta,
    latest: latest
      ? {
          matchId: latest.MatchID,
          seasonId: latest.SeasonID,
          tierBefore: toTier(latest.TierBeforeUpdate),
          tierAfter: toTier(latest.TierAfterUpdate),
          rrBefore: latest.RankedRatingBeforeUpdate ?? null,
          rrAfter: latest.RankedRatingAfterUpdate ?? null,
          rrEarned: latest.RankedRatingEarned ?? null,
          performanceBonus: latest.RankedRatingPerformanceBonus ?? null,
          afkPenalty: latest.AFKPenalty ?? null,
          matchStartTime: latest.MatchStartTime
            ? new Date(latest.MatchStartTime).toISOString()
            : null,
        }
      : null,
  };
};

const summarizeLeaderboard = (leaderboard, session) => {
  const players = Array.isArray(leaderboard?.Players) ? leaderboard.Players : [];
  const ownPlayer = players.find((player) => player?.puuid === session.userId);

  return {
    deployment: leaderboard?.Deployment ?? null,
    queueId: leaderboard?.QueueID ?? null,
    seasonId: leaderboard?.SeasonID ?? null,
    totalPlayers: leaderboard?.totalPlayers ?? null,
    returnedPlayers: players.length,
    ownPlayer: ownPlayer
      ? {
          gameName: ownPlayer.gameName,
          tagLine: ownPlayer.tagLine,
          leaderboardRank: ownPlayer.leaderboardRank,
          rankedRating: ownPlayer.rankedRating,
          numberOfWins: ownPlayer.numberOfWins,
          competitiveTier: ownPlayer.competitiveTier,
          competitiveName: rankName(ownPlayer.competitiveTier),
        }
      : null,
  };
};

const validatePlayerMmr = (data) => {
  const missing = [];
  if (typeof data?.Version !== "number") missing.push("Version");
  if (typeof data?.Subject !== "string") missing.push("Subject");
  if (!data?.QueueSkills || typeof data.QueueSkills !== "object") {
    missing.push("QueueSkills");
  }
  return missing;
};

const validateCompetitiveUpdates = (data) => {
  const missing = [];
  if (typeof data?.Version !== "number") missing.push("Version");
  if (typeof data?.Subject !== "string") missing.push("Subject");
  if (!Array.isArray(data?.Matches)) missing.push("Matches[]");
  return missing;
};

const validateLeaderboard = (data) => {
  const missing = [];
  if (typeof data?.Deployment !== "string") missing.push("Deployment");
  if (typeof data?.SeasonID !== "string") missing.push("SeasonID");
  if (!Array.isArray(data?.Players)) missing.push("Players[]");
  return missing;
};

const printEndpointResult = ({ endpoint, result, validation, summary }) => {
  console.log(`\n[${endpoint.queryName}]`);
  console.log(`docs: ${endpoint.docs}`);
  console.log(`status: ${result.status} ${result.statusText}`);
  console.log(`durationMs: ${result.durationMs}`);

  if (!result.ok) {
    const error = result.data && typeof result.data === "object" ? result.data : {};
    console.log(
      `error: ${JSON.stringify({
        httpStatus: error.httpStatus ?? result.status,
        errorCode: error.errorCode ?? null,
        message: error.message ?? null,
      })}`
    );
    if (error.errorCode === "BAD_CLAIMS") {
      console.log(
        "hint: BAD_CLAIMS usually means the access token claims are not accepted by Valorant PVP/MMR. Use a Riot Client/Valorant local session token, not a web/login token."
      );
    }
    return;
  }

  if (validation?.length) {
    console.log(`schemaWarnings: missing ${validation.join(", ")}`);
  } else {
    console.log("schema: ok");
  }

  console.log(JSON.stringify(summary, null, 2));
};

const fetchPlayerMmr = async ({ session, headers }) => {
  const endpoint = MMR_ENDPOINTS.player;
  const result = await requestJson({
    url: makePdUrl(session, endpoint.path(session)),
    headers,
  });

  return {
    endpoint,
    result,
    validation: result.ok ? validatePlayerMmr(result.data) : [],
    summary: result.ok ? summarizePlayerMmr(result.data) : null,
  };
};

const fetchCompetitiveUpdatesPage = async ({
  session,
  headers,
  startIndex,
  endIndex,
  queue,
}) => {
  const endpoint = MMR_ENDPOINTS.competitiveUpdates;
  const result = await requestJson({
    url: makePdUrl(session, endpoint.path(session), {
      startIndex,
      endIndex,
      queue,
    }),
    headers,
  });

  return {
    endpoint,
    result,
    validation: result.ok ? validateCompetitiveUpdates(result.data) : [],
    summary: result.ok ? summarizeCompetitiveUpdates(result.data) : null,
  };
};

const fetchCompetitiveUpdatesPaged = async ({ session, headers }) => {
  const endpoint = MMR_ENDPOINTS.competitiveUpdates;
  const pageSize = getNumberArg("--page-size", DEFAULT_PAGE_SIZE);
  const maxMatches = getNumberArg("--max-matches", DEFAULT_MAX_MATCHES);
  const queue = getArg("--queue") || "competitive";
  const matches = [];
  const seen = new Set();
  const statuses = [];
  let subject = null;

  for (let startIndex = 0; startIndex < maxMatches; startIndex += pageSize) {
    const endIndex = startIndex + pageSize;
    const page = await fetchCompetitiveUpdatesPage({
      session,
      headers,
      startIndex,
      endIndex,
      queue,
    });

    statuses.push({
      startIndex,
      endIndex,
      status: page.result.status,
      durationMs: page.result.durationMs,
      matches: Array.isArray(page.result.data?.Matches)
        ? page.result.data.Matches.length
        : 0,
    });

    if (!page.result.ok) {
      return {
        endpoint,
        result: page.result,
        validation: [],
        summary: {
          paging: { pageSize, maxMatches, queue, statuses },
          matches: matches.length,
        },
      };
    }

    subject = subject || page.result.data?.Subject || null;
    const pageMatches = Array.isArray(page.result.data?.Matches)
      ? page.result.data.Matches
      : [];

    for (const match of pageMatches) {
      const matchId = String(match?.MatchID || "");
      if (matchId && seen.has(matchId)) continue;
      if (matchId) seen.add(matchId);
      matches.push(match);
    }

    if (pageMatches.length < pageSize) {
      break;
    }
  }

  return {
    endpoint,
    result: {
      ok: true,
      status: 200,
      statusText: "OK",
      durationMs: statuses.reduce(
        (total, item) => total + Number(item.durationMs || 0),
        0
      ),
      data: { Version: 0, Subject: subject, Matches: matches },
    },
    validation: validateCompetitiveUpdates({ Version: 0, Subject: subject, Matches: matches }),
    summary: {
      paging: { pageSize, maxMatches, queue, statuses },
      ...summarizeCompetitiveUpdates({ Subject: subject, Matches: matches }),
    },
  };
};

const fetchLeaderboard = async ({ session, headers }) => {
  const seasonId = getArg("--season-id") || process.env.VALORANT_SEASON_ID;
  if (!seasonId) return null;

  const endpoint = MMR_ENDPOINTS.leaderboard;
  const result = await requestJson({
    url: makePdUrl(session, endpoint.path(session, seasonId), {
      startIndex: getNumberArg("--leaderboard-start", 0),
      size: getNumberArg("--leaderboard-size", 510),
      query: getArg("--leaderboard-query"),
    }),
    headers,
  });

  return {
    endpoint,
    result,
    validation: result.ok ? validateLeaderboard(result.data) : [],
    summary: result.ok ? summarizeLeaderboard(result.data, session) : null,
  };
};

const writeJsonOut = (payload) => {
  const outPath = getArg("--json-out");
  if (!outPath) return;

  const resolvedPath = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nwrote: ${resolvedPath}`);
};

const main = async () => {
  const session = getSession();
  const clientVersion =
    getArg("--client-version") ||
    process.env.VALORANT_CLIENT_VERSION ||
    (await getLatestClientVersion().catch(() => DEFAULT_CLIENT_VERSION));

  if (!session.accessToken) {
    throw new Error(
      "Missing access token. Set VALORANT_ACCESS_TOKEN or pass --db <RKStorage.sqlite>."
    );
  }

  if (!session.userId) {
    throw new Error("Missing PUUID. Set VALORANT_PUUID or use a saved app session.");
  }

  console.log("Valorant MMR API test");
  console.log("docsSource: valorant-api-docs");
  const accessTokenSummary = summarizeJwt(session.accessToken);
  if (accessTokenSummary) {
    console.log("accessTokenSummary:");
    console.log(JSON.stringify(accessTokenSummary, null, 2));
  }

  validateSessionClaims(session);

  if (!session.entitlementsToken) {
    session.entitlementsToken = await getEntitlementsToken(session, clientVersion);
  }

  if (!session.entitlementsToken) {
    throw new Error("Missing entitlements token and could not request a new one.");
  }

  const liveShard = await resolveLiveShard(session).catch(() => session.shard);
  if (liveShard) session.shard = liveShard;

  if (!session.shard) {
    throw new Error("Missing shard. Set VALORANT_SHARD/VALORANT_REGION or use a saved app session.");
  }

  const headers = clientHeaders(session, clientVersion);
  const tokenExpired = session.accessTokenExpiresAt
    ? new Date(session.accessTokenExpiresAt).getTime() <= Date.now()
    : null;

  console.log(`source: ${session.source}`);
  console.log(`puuid: ${maskId(session.userId)}`);
  console.log(`region: ${session.region || "unknown"}`);
  console.log(`shard: ${session.shard}`);
  console.log(`clientVersion: ${clientVersion}`);
  console.log(`accessTokenExpiresAt: ${session.accessTokenExpiresAt || "unknown"}`);
  console.log(`accessTokenExpired: ${tokenExpired ?? "unknown"}`);
  console.log(`accessTokenLength: ${session.accessToken.length}`);
  console.log(`entitlementsTokenLength: ${session.entitlementsToken.length}`);

  const results = [];
  const playerMmr = await fetchPlayerMmr({ session, headers });
  results.push(playerMmr);
  printEndpointResult(playerMmr);

  const updatesDefault = await fetchCompetitiveUpdatesPage({
    session,
    headers,
    startIndex: undefined,
    endIndex: undefined,
    queue: undefined,
  });
  results.push(updatesDefault);
  printEndpointResult({
    ...updatesDefault,
    endpoint: {
      ...updatesDefault.endpoint,
      queryName: `${updatesDefault.endpoint.queryName} default`,
    },
  });

  const updatesFirstPage = await fetchCompetitiveUpdatesPage({
    session,
    headers,
    startIndex: 0,
    endIndex: getNumberArg("--page-size", DEFAULT_PAGE_SIZE),
    queue: getArg("--queue") || "competitive",
  });
  results.push(updatesFirstPage);
  printEndpointResult({
    ...updatesFirstPage,
    endpoint: {
      ...updatesFirstPage.endpoint,
      queryName: `${updatesFirstPage.endpoint.queryName} page`,
    },
  });

  const updatesPaged = await fetchCompetitiveUpdatesPaged({ session, headers });
  results.push(updatesPaged);
  printEndpointResult({
    ...updatesPaged,
    endpoint: {
      ...updatesPaged.endpoint,
      queryName: `${updatesPaged.endpoint.queryName} paged`,
    },
  });

  const leaderboard = await fetchLeaderboard({ session, headers });
  if (leaderboard) {
    results.push(leaderboard);
    printEndpointResult(leaderboard);
  }

  if (hasFlag("--raw")) {
    console.log("\n[raw responses]");
    console.log(JSON.stringify(results.map((item) => item.result.data), null, 2));
  }

  writeJsonOut({
    generatedAt: new Date().toISOString(),
    source: session.source,
    puuid: maskId(session.userId),
    shard: session.shard,
    clientVersion,
    results: results.map((item) => ({
      queryName: item.endpoint.queryName,
      status: item.result.status,
      statusText: item.result.statusText,
      validation: item.validation,
      summary: item.summary,
      raw: hasFlag("--json-raw") ? item.result.data : undefined,
    })),
  });
};

main().catch((error) => {
  console.error(`MMR API test failed: ${error.message}`);
  process.exitCode = 1;
});
