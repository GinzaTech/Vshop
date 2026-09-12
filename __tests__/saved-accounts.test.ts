import {
  getAccountSessionKey,
  hasUnexpiredAuthCookies,
  isSameAccountSessionKey,
  shouldAcceptSessionUpdate,
  upsertSavedAccount,
  type AccountSessionSource,
} from "~/utils/saved-accounts";

const makeSession = (
  id: string,
  accessToken = `access-${id}`
): AccountSessionSource => ({
  id,
  name: `Player ${id}`,
  TagLine: "VSP",
  region: "ap",
  accessToken,
  idToken: `id-${id}`,
  entitlementsToken: `entitlements-${id}`,
});

describe("saved account helpers", () => {
  it("requires a live Riot session cookie, not a remaining tracking cookie", () => {
    const now = Date.parse("2026-09-05T00:00:00Z");
    expect(hasUnexpiredAuthCookies([{ name: "__cf_bm", value: "tracking" }], now)).toBe(false);
    expect(hasUnexpiredAuthCookies([{ name: "ssid", value: "session" }], now)).toBe(true);
    expect(hasUnexpiredAuthCookies([
      { name: "ssid", value: "expired", expires: "2026-09-04T00:00:00Z" },
      { name: "tdid", value: "tracking", expires: "2027-01-01T00:00:00Z" },
    ], now)).toBe(false);
  });
  it("creates a stable account-scoped cache key", () => {
    expect(
      getAccountSessionKey({ id: " ACCOUNT-A ", region: " AP " })
    ).toBe("ap|account-a");
    expect(getAccountSessionKey({ id: "", region: "ap" })).toBe("guest");
    expect(isSameAccountSessionKey("ap|account-a", "ap|account-a")).toBe(
      true
    );
    expect(isSameAccountSessionKey("ap|account-b", "ap|account-a")).toBe(
      false
    );
  });

  it("updates an existing account without creating a duplicate", () => {
    const authCookies = [
      {
        name: "ssid",
        value: "account-a-cookie",
        domain: ".riotgames.com",
        path: "/",
      },
    ];
    const initial = upsertSavedAccount([], makeSession("account-a"), {
      now: 100,
      touch: true,
      authCookies,
    });
    const updated = upsertSavedAccount(
      initial,
      makeSession("ACCOUNT-A", "refreshed-token"),
      { now: 200 }
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: "ACCOUNT-A",
      accessToken: "refreshed-token",
      authCookies,
      lastUsedAt: 100,
    });
  });

  it("replaces a saved cookie snapshot only when a new snapshot is supplied", () => {
    const initial = upsertSavedAccount([], makeSession("account-a"), {
      now: 100,
      authCookies: [
        {
          name: "ssid",
          value: "old-cookie",
          domain: ".riotgames.com",
        },
      ],
    });
    const updated = upsertSavedAccount(
      initial,
      makeSession("account-a", "new-access-token"),
      {
        now: 200,
        authCookies: [
          {
            name: "ssid",
            value: "new-cookie",
            domain: ".riotgames.com",
          },
        ],
      }
    );

    expect(updated[0]?.authCookies).toEqual([
      {
        name: "ssid",
        value: "new-cookie",
        domain: ".riotgames.com",
      },
    ]);
  });

  it("keeps only the most recently used accounts", () => {
    let accounts = upsertSavedAccount([], makeSession("account-a"), {
      now: 100,
      touch: true,
      maxAccounts: 2,
    });
    accounts = upsertSavedAccount(accounts, makeSession("account-b"), {
      now: 200,
      touch: true,
      maxAccounts: 2,
    });
    accounts = upsertSavedAccount(accounts, makeSession("account-c"), {
      now: 300,
      touch: true,
      maxAccounts: 2,
    });

    expect(accounts.map((account) => account.id)).toEqual([
      "account-c",
      "account-b",
    ]);
  });

  it("rejects a late update from a different active account", () => {
    expect(shouldAcceptSessionUpdate("account-b", "account-a")).toBe(false);
    expect(shouldAcceptSessionUpdate("account-b", "ACCOUNT-B")).toBe(true);
    expect(shouldAcceptSessionUpdate("", "account-a")).toBe(true);
  });
});
