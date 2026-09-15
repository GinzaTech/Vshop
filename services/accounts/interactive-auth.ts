import { getRandomBytesAsync } from "expo-crypto";
import { jwtDecode } from "jwt-decode";
import { isRiotAuthCallbackUrl } from "~/utils/riot-auth-navigation";

export type InteractiveAuthAttempt = Readonly<{ state: string; nonce: string }>;

/** Async native RNG has no Math.random fallback, including development builds. */
export async function createInteractiveAuthAttempt(): Promise<InteractiveAuthAttempt> {
  const [stateBytes, nonceBytes] = await Promise.all([getRandomBytesAsync(32), getRandomBytesAsync(32)]);
  const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { state: hex(stateBytes), nonce: hex(nonceBytes) };
}

/** Binds the redirect and ID token to the current attempt before upstream authentication.
 * Decoding the nonce is a correlation check, not signature verification of the ID token.
 */
export function validateInteractiveAuthCallback(value: string, attempt: InteractiveAuthAttempt) {
  const invalid = () => new Error("Invalid authentication callback");
  try {
    if (!attempt.state || !attempt.nonce || !isRiotAuthCallbackUrl(value)) throw invalid();
    const url = new URL(value);
    if (url.port && url.port !== "443") throw invalid();
    const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
    const query = new URLSearchParams(url.search);
    if (url.hash && ["state", "access_token", "id_token"].some((key) => query.has(key))) throw invalid();
    for (const key of ["state", "access_token", "id_token"]) {
      if (params.getAll(key).length !== 1 || !params.get(key)?.trim()) throw invalid();
    }
    if (params.has("error") || params.get("state") !== attempt.state) throw invalid();
    const accessToken = params.get("access_token")!;
    const idToken = params.get("id_token")!;
    const claims = jwtDecode<{ nonce?: unknown }>(idToken);
    if (!claims || typeof claims.nonce !== "string" || claims.nonce !== attempt.nonce) throw invalid();
    return { accessToken, idToken };
  } catch { throw invalid(); }
}
