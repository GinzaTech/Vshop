import type { MobileAccountVaultEnvelope } from "./types";

const HEX_256 = /^[a-f0-9]{64}$/i;
const CLAIM_BASE_URL = "http://127.0.0.1:49331";

export const isMobileHandoffBuildEnabled = ({
  platform,
  publicFlag,
}: {
  platform: string;
  publicFlag: string | undefined;
}) => platform === "android" && publicFlag === "1";

export const isMobileHandoffRouteAllowed = ({
  pathname,
  platform,
  publicFlag,
}: {
  pathname: string;
  platform: string;
  publicFlag: string | undefined;
}) => pathname.replace(/\/+$/, "") === "/session_handoff" &&
  isMobileHandoffBuildEnabled({ platform, publicFlag });

export function validateMobileHandoffParams(value: {
  id?: string | string[];
  code?: string | string[];
}) {
  if (typeof value.id !== "string" || typeof value.code !== "string" ||
      !HEX_256.test(value.id) || !HEX_256.test(value.code)) {
    throw new Error("MOBILE_HANDOFF_PARAMS_REJECTED");
  }
  return Object.freeze({ id: value.id, code: value.code });
}

export async function claimMobileAccountVault({
  id,
  code,
  envelope,
  fetchImpl = fetch,
}: {
  id: string;
  code: string;
  envelope: MobileAccountVaultEnvelope;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const params = validateMobileHandoffParams({ id, code });
  let response: Response;
  try {
    response = await fetchImpl(
      `${CLAIM_BASE_URL}/v1/mobile-vaults/${params.id}/claim`,
      {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "X-VShop-Pairing-Code": params.code,
        },
        body: JSON.stringify(envelope),
      },
    );
  } catch {
    throw new Error("MOBILE_HANDOFF_UNAVAILABLE");
  }
  if (!response.ok || response.status !== 204) {
    throw new Error("MOBILE_HANDOFF_REJECTED");
  }
}
