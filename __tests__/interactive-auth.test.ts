import { Buffer } from "buffer";
import { getRandomBytesAsync } from "expo-crypto";
import { createInteractiveAuthAttempt, validateInteractiveAuthCallback } from "~/services/accounts/interactive-auth";
import { buildRiotInteractiveAuthUrl } from "~/services/riot/endpoints";

jest.mock("expo-crypto", () => ({ getRandomBytesAsync: jest.fn() }));
const attempt = { state: "s".repeat(64), nonce: "n".repeat(64) };
const jwt = (nonce: unknown) => `e30.${Buffer.from(JSON.stringify({ nonce })).toString("base64url")}.signature`;
const callback = (state = attempt.state, nonce: unknown = attempt.nonce) =>
  `https://playvalorant.com/opt_in#access_token=fake-access&id_token=${jwt(nonce)}&state=${state}`;

describe("interactive auth attempt binding", () => {
  it("uses fresh cryptographic bytes for independent nonce and state on each attempt", async () => {
    jest.mocked(getRandomBytesAsync).mockResolvedValueOnce(new Uint8Array(32).fill(1))
      .mockResolvedValueOnce(new Uint8Array(32).fill(2)).mockResolvedValueOnce(new Uint8Array(32).fill(3))
      .mockResolvedValueOnce(new Uint8Array(32).fill(4));
    const first = await createInteractiveAuthAttempt();
    const second = await createInteractiveAuthAttempt();
    expect(getRandomBytesAsync).toHaveBeenCalledTimes(4);
    expect(getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(new Set([first.state, first.nonce, second.state, second.nonce]).size).toBe(4);
    expect(first.state).toMatch(/^[a-f0-9]{64}$/);
  });
  it("builds the existing Riot OAuth contract with encoded state and nonce", () => {
    const url = new URL(buildRiotInteractiveAuthUrl(attempt));
    expect(url.origin + url.pathname).toBe("https://auth.riotgames.com/authorize");
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      client_id: "play-valorant-web-prod", redirect_uri: "https://playvalorant.com/opt_in",
      response_type: "token id_token", scope: "account openid", ...attempt,
    });
    expect(() => buildRiotInteractiveAuthUrl({ state: "", nonce: "" })).toThrow();
  });
  it("accepts only a callback bound to this attempt", () => {
    expect(validateInteractiveAuthCallback(callback(), attempt)).toEqual({ accessToken: "fake-access", idToken: jwt(attempt.nonce) });
  });
  it.each([
    () => callback("wrong-state"), () => callback(attempt.state, "wrong-nonce"),
    () => callback(attempt.state, null), () => callback().replace(/&state=.*/, ""),
    () => callback().replace("playvalorant.com", "attacker.test"),
    () => callback().replace("https:", "http:"),
    () => callback() + "&state=duplicate", () => callback() + "&id_token=duplicate",
    () => callback().replace(jwt(attempt.nonce), "invalid-token"),
  ])("rejects mismatched, missing or ambiguous callback fields", (makeUrl) => {
    expect(() => validateInteractiveAuthCallback(makeUrl(), attempt)).toThrow("Invalid authentication callback");
  });
});
