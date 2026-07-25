#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");

const DEFAULT_LOCKFILE_PATH = path.join(
  process.env.LOCALAPPDATA || "",
  "Riot Games",
  "Riot Client",
  "Config",
  "lockfile"
);

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

const resolveShard = (...regions) => {
  for (const region of regions) {
    const normalized = String(region || "").trim().toLowerCase();
    if (!normalized) continue;
    return SHARD_BY_REGION[normalized] || normalized;
  }

  return "";
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

const readLockfile = (lockfilePath) => {
  if (!fs.existsSync(lockfilePath)) {
    throw new Error(
      `Riot Client lockfile not found: ${lockfilePath}. Open Riot Client/Valorant first.`
    );
  }

  const [name, pid, port, password, protocol] = fs
    .readFileSync(lockfilePath, "utf8")
    .trim()
    .split(":");

  if (!port || !password) {
    throw new Error(`Invalid Riot Client lockfile format: ${lockfilePath}`);
  }

  return { name, pid, port, password, protocol };
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

          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            data,
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });

const requireOk = (name, response) => {
  if (response.ok) return response.data;

  throw new Error(
    `${name} failed: ${response.status} ${response.statusText} ${JSON.stringify(
      response.data
    )}`
  );
};

const readLocalRso = async (lockfilePath) => {
  const lockfile = readLockfile(lockfilePath);
  const [rsoAccess, entitlement, chatSession, regionLocale] = await Promise.all([
    requestLocalJson({
      ...lockfile,
      endpoint: "rso-auth/v1/authorization/access-token",
    }),
    requestLocalJson({ ...lockfile, endpoint: "entitlements/v1/token" }),
    requestLocalJson({ ...lockfile, endpoint: "chat/v1/session" }),
    requestLocalJson({ ...lockfile, endpoint: "riotclient/region-locale" }),
  ]);

  const rsoAccessData = requireOk("RSO access token", rsoAccess);
  const entitlementData = requireOk("Entitlements token", entitlement);
  const accessToken = rsoAccessData.token || entitlementData.accessToken || "";
  const entitlementsToken = entitlementData.token || "";
  const payload = decodeJwtPayload(accessToken);
  const puuid =
    entitlementData.subject || chatSession.data?.puuid || payload?.sub || "";
  const region = regionLocale.data?.region || chatSession.data?.region || "";
  const shard = resolveShard(region, payload?.dat?.r);

  if (!accessToken) {
    throw new Error("Local Riot Client did not return an RSO access token.");
  }

  return {
    source: `local:${lockfile.name || "Riot Client"}:${lockfile.pid || "unknown"}`,
    accessToken,
    entitlementsToken,
    puuid,
    region,
    shard,
    payload,
    scopes: rsoAccessData.scopes || payload?.scp || [],
  };
};

const summarize = (session) => ({
  source: session.source,
  puuid: maskId(session.puuid),
  region: session.region || null,
  shard: session.shard || null,
  accessToken: {
    issuer: session.payload?.iss || null,
    clientId: session.payload?.cid || null,
    platformId: session.payload?.plt?.id || null,
    tokenRegion: session.payload?.dat?.r || null,
    expiresAt: session.payload?.exp
      ? new Date(session.payload.exp * 1000).toISOString()
      : null,
    expired: session.payload?.exp ? session.payload.exp * 1000 <= Date.now() : null,
    scopes: session.scopes,
    length: session.accessToken.length,
  },
  entitlementsToken: {
    present: Boolean(session.entitlementsToken),
    length: session.entitlementsToken.length,
  },
});

const writeEnv = (outPath, session) => {
  const resolvedPath = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(
    resolvedPath,
    [
      "# Local Riot Client RSO credentials.",
      "# Do not commit this file.",
      `VALORANT_ACCESS_TOKEN=${session.accessToken}`,
      `VALORANT_ENTITLEMENTS_TOKEN=${session.entitlementsToken}`,
      `VALORANT_PUUID=${session.puuid}`,
      `VALORANT_REGION=${session.shard}`,
      `VALORANT_SHARD=${session.shard}`,
      `RIOT_REGION=${session.region}`,
      "",
    ].join("\n"),
    "utf8"
  );

  return resolvedPath;
};

const main = async () => {
  const lockfilePath = getArg("--lockfile") || DEFAULT_LOCKFILE_PATH;
  const outPath = getArg("--out");
  const session = await readLocalRso(lockfilePath);

  if (outPath) {
    const resolvedPath = writeEnv(outPath, session);
    console.log(`Wrote ${resolvedPath}`);
  }

  if (hasFlag("--print-token")) {
    console.log(session.accessToken);
    return;
  }

  console.log(JSON.stringify(summarize(session), null, 2));
};

main().catch((error) => {
  console.error(`Local RSO failed: ${error.message}`);
  process.exitCode = 1;
});
