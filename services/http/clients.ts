import axios from "axios";
import { getRiotHttpAdapter } from "./riot-adapter";
import { installApiResponseLogging } from "~/utils/api-response-logger";

/**
 * HTTP clients are intentionally isolated by responsibility.
 *
 * Never mutate axios.defaults in the app: doing so makes the effective timeout
 * and interceptors depend on module import order.
 */
export const riotHttpClient = axios.create({
  timeout: 10_000,
  adapter: getRiotHttpAdapter(),
});

export const publicHttpClient = axios.create({
  timeout: 15_000,
  headers: {
    Accept: "application/json",
  },
});

installApiResponseLogging(riotHttpClient, "riot");
installApiResponseLogging(publicHttpClient, "public");

export const telemetryHttpClient = axios.create({
  timeout: 8_000,
});

installApiResponseLogging(telemetryHttpClient, "telemetry");

