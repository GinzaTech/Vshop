#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasFlag = (name) => process.argv.includes(name);

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

const requestRiotLocalJson = ({ port, password, endpoint }) =>
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

const readSessionFromDb = (dbPath) => {
  if (!dbPath || !fs.existsSync(dbPath)) {
    throw new Error(`RKStorage sqlite DB not found: ${dbPath}`);
  }

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
    throw new Error(`Cannot read RKStorage sqlite DB: ${reason}`);
  }

  const raw = result.stdout.trim();
  if (!raw) {
    throw new Error("No user-session row found in RKStorage sqlite DB.");
  }

  const parsed = JSON.parse(raw);
  const user = parsed?.state?.user;
  if (!user?.accessToken || !user?.entitlementsToken) {
    throw new Error("user-session does not contain both Valorant tokens.");
  }

  return user;
};

const readSessionFromRiotClient = async (lockfilePath) => {
  if (!lockfilePath || !fs.existsSync(lockfilePath)) {
    throw new Error(
      `Riot Client lockfile not found: ${lockfilePath}. Open Riot Client/Valorant first.`
    );
  }

  const lockfile = fs.readFileSync(lockfilePath, "utf8").trim();
  const [name, pid, port, password, protocol] = lockfile.split(":");
  if (!port || !password) {
    throw new Error(`Invalid Riot Client lockfile format: ${lockfilePath}`);
  }

  const [entitlements, chatSession, regionLocale, accessTokenResponse] =
    await Promise.all([
      requestRiotLocalJson({ port, password, endpoint: "entitlements/v1/token" }),
      requestRiotLocalJson({ port, password, endpoint: "chat/v1/session" }),
      requestRiotLocalJson({ port, password, endpoint: "riotclient/region-locale" }),
      requestRiotLocalJson({
        port,
        password,
        endpoint: "rso-auth/v1/authorization/access-token",
      }),
    ]);

  if (!entitlements.ok) {
    throw new Error(
      `Cannot read local entitlements token: ${entitlements.status} ${entitlements.statusText}`
    );
  }

  const accessToken =
    entitlements.data?.accessToken || accessTokenResponse.data?.token || "";
  const entitlementsToken = entitlements.data?.token || "";
  const decodedAccessToken = decodeJwtPayload(accessToken);
  const region = resolveShard(
    regionLocale.data?.region,
    chatSession.data?.region,
    decodedAccessToken?.dat?.r
  );
  const userId =
    entitlements.data?.subject ||
    chatSession.data?.puuid ||
    decodedAccessToken?.sub ||
    "";

  if (!accessToken || !entitlementsToken || !userId) {
    throw new Error("Local Riot Client session did not include required Valorant tokens.");
  }

  return {
    accessToken,
    entitlementsToken,
    region,
    id: userId,
    source: `local:${name || "Riot Client"}:${pid || "unknown"}:${protocol || "https"}`,
  };
};

const writeEnvFile = (outPath, user) => {
  const decodedAccessToken = decodeJwtPayload(user.accessToken);
  const content = [
    "# Local Valorant API test credentials.",
    "# Do not commit this file.",
    `VALORANT_ACCESS_TOKEN=${user.accessToken}`,
    `VALORANT_ENTITLEMENTS_TOKEN=${user.entitlementsToken}`,
    `VALORANT_REGION=${user.region || ""}`,
    `VALORANT_SHARD=${user.region || ""}`,
    `VALORANT_PUUID=${user.id || decodedAccessToken?.sub || ""}`,
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");

  return {
    expiresAt: decodedAccessToken?.exp
      ? new Date(decodedAccessToken.exp * 1000).toISOString()
      : "unknown",
  };
};

const main = () => {
  const useLocal = hasFlag("--local");
  const dbPath =
    getArg("--db") ||
    process.env.VSHOP_SESSION_DB ||
    path.join(os.tmpdir(), "vshop_RKStorage_live.sqlite");
  const lockfilePath =
    getArg("--lockfile") || process.env.RIOT_LOCKFILE || DEFAULT_LOCKFILE_PATH;
  const outPath = path.resolve(getArg("--out") || path.join("test", ".env"));

  const readSession = useLocal
    ? readSessionFromRiotClient(lockfilePath)
    : Promise.resolve(readSessionFromDb(dbPath));

  return readSession.then((user) => {
  const result = writeEnvFile(outPath, user);

  console.log(`Wrote ${outPath}`);
  console.log(`source=${user.source || (useLocal ? "local" : "db")}`);
  console.log(`region=${user.region || ""}`);
  console.log(`puuid=${user.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : ""}`);
  console.log(`accessTokenLength=${user.accessToken.length}`);
  console.log(`entitlementsTokenLength=${user.entitlementsToken.length}`);
  console.log(`accessTokenExpiresAt=${result.expiresAt}`);
  });
};

main().catch((error) => {
  console.error(`Failed to write MMR env: ${error.message}`);
  process.exitCode = 1;
});
