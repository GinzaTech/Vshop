const BASE_URL = "https://valorant-api.com/v1";
const TIMEOUT_MS = 20_000;

const checks = [
  ["version", "/version", "object"],
  ["weapon skins", "/weapons/skins", "array"],
  ["buddies", "/buddies", "array"],
  ["sprays", "/sprays", "array"],
  ["weapons", "/weapons", "array"],
  ["flex", "/flex", "array"],
  ["player cards", "/playercards", "array"],
  ["player titles", "/playertitles", "array"],
  ["maps", "/maps", "array"],
  ["competitive tiers", "/competitivetiers", "array"],
  ["bundles", "/bundles", "array"],
  ["agents", "/agents?isPlayableCharacter=true", "array"],
  ["contracts", "/contracts", "array"],
];

async function smokeCheck([name, path, expectedType]) {
  const startedAt = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status}`);
  }

  const body = await response.json();
  const data = body?.data;
  const valid =
    body?.status === 200 &&
    (expectedType === "array"
      ? Array.isArray(data) && data.length > 0
      : data !== null && typeof data === "object" && !Array.isArray(data));

  if (!valid) {
    throw new Error(`${name}: response schema is not usable`);
  }

  return {
    name,
    durationMs: Math.round(performance.now() - startedAt),
    records: Array.isArray(data) ? data.length : 1,
  };
}

const results = await Promise.allSettled(checks.map(smokeCheck));
let failed = false;

for (const result of results) {
  if (result.status === "fulfilled") {
    const { name, durationMs, records } = result.value;
    console.log(`PASS ${name} (${records} records, ${durationMs}ms)`);
  } else {
    failed = true;
    console.error(`FAIL ${result.reason?.message || String(result.reason)}`);
  }
}

if (failed) process.exitCode = 1;

