import axios from "axios";

/**
 * HTTP clients are intentionally isolated by responsibility.
 *
 * Never mutate axios.defaults in the app: doing so makes the effective timeout
 * and interceptors depend on module import order.
 */
export const riotHttpClient = axios.create({
  timeout: 10_000,
});

export const publicHttpClient = axios.create({
  timeout: 15_000,
  headers: {
    Accept: "application/json",
  },
});

export const telemetryHttpClient = axios.create({
  timeout: 8_000,
});

