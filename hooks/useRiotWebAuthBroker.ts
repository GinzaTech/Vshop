import { useCallback, useEffect, useRef, useState } from "react";

import { getPentestCompanionClient } from "~/services/pentest-companion/client.web";
import {
  PentestCompanionError,
  type PentestCompanionClient,
  type PentestCompanionErrorCode,
} from "~/services/pentest-companion/types";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_AUTH_TIMEOUT_MS = 5 * 60_000;

export type RiotWebAuthState =
  | { kind: "checking" }
  | { kind: "ready"; mutationMode: boolean }
  | { kind: "opening" }
  | { kind: "waiting"; authSessionId: string }
  | { kind: "completing" }
  | { kind: "cancelled" }
  | { kind: "error"; code: PentestCompanionErrorCode };

export type RiotWebAuthBrokerController = Readonly<{
  state: RiotWebAuthState;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
}>;

type BrokerOptions = Readonly<{
  client?: PentestCompanionClient;
  loginUrl: string | null;
  onCallback: (callbackUrl: string) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  authTimeoutMs?: number;
}>;

const errorCode = (error: unknown): PentestCompanionErrorCode =>
  error instanceof PentestCompanionError
    ? error.code
    : "COMPANION_UNAVAILABLE";

const resolveDefaultClient = () => {
  try {
    return getPentestCompanionClient();
  } catch {
    return null;
  }
};

export function useRiotWebAuthBroker({
  client: suppliedClient,
  loginUrl,
  onCallback,
  now = Date.now,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  authTimeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
}: BrokerOptions): RiotWebAuthBrokerController {
  const [client] = useState<PentestCompanionClient | null>(
    () => suppliedClient ?? resolveDefaultClient(),
  );
  const [state, setState] = useState<RiotWebAuthState>(
    client ? { kind: "checking" } : { kind: "error", code: "COMPANION_DISABLED" },
  );
  const mountedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authSessionRef = useRef<string | null>(null);
  const authStartedAtRef = useRef(0);
  const pollingRef = useRef(false);
  const callbackRef = useRef(onCallback);
  const loginUrlRef = useRef(loginUrl);
  const pollRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => { callbackRef.current = onCallback; }, [onCallback]);
  useEffect(() => { loginUrlRef.current = loginUrl; }, [loginUrl]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancelSession = useCallback(async () => {
    clearTimer();
    const authSessionId = authSessionRef.current;
    authSessionRef.current = null;
    if (!client || !authSessionId) return;
    try {
      await client.cancelAuth(authSessionId);
    } catch {
      // Cancellation is best-effort; companion expiry still removes the session.
    }
  }, [clearTimer, client]);

  const schedulePoll = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => { void pollRef.current(); }, pollIntervalMs);
  }, [clearTimer, pollIntervalMs]);

  const poll = useCallback(async (): Promise<void> => {
    const authSessionId = authSessionRef.current;
    if (!client || !authSessionId || pollingRef.current || !mountedRef.current) return;
    if (now() - authStartedAtRef.current >= authTimeoutMs) {
      await cancelSession();
      if (mountedRef.current) setState({ kind: "error", code: "AUTH_TIMEOUT" });
      return;
    }
    pollingRef.current = true;
    try {
      const result = await client.getAuthStatus(authSessionId);
      if (!mountedRef.current || authSessionRef.current !== authSessionId) return;
      if (result.status === "pending") {
        schedulePoll();
        return;
      }
      if (result.status === "cancelled") {
        authSessionRef.current = null;
        setState({ kind: "cancelled" });
        return;
      }
      if (result.status === "failed") {
        authSessionRef.current = null;
        setState({ kind: "error", code: "BROWSER_UNAVAILABLE" });
        return;
      }

      setState({ kind: "completing" });
      const consumed = await client.consumeAuth(authSessionId);
      authSessionRef.current = null;
      if (!mountedRef.current) return;
      await callbackRef.current(consumed.callbackUrl);
    } catch (error) {
      await cancelSession();
      if (mountedRef.current) setState({ kind: "error", code: errorCode(error) });
    } finally {
      pollingRef.current = false;
    }
  }, [authTimeoutMs, cancelSession, client, now, schedulePoll]);

  useEffect(() => { pollRef.current = poll; }, [poll]);

  const connect = useCallback(async () => {
    if (!client) {
      if (mountedRef.current) setState({ kind: "error", code: "COMPANION_DISABLED" });
      return;
    }
    if (mountedRef.current) setState({ kind: "checking" });
    try {
      const result = await client.connect();
      if (mountedRef.current) {
        setState({ kind: "ready", mutationMode: result.mutationMode });
      }
    } catch (error) {
      if (mountedRef.current) setState({ kind: "error", code: errorCode(error) });
    }
  }, [client]);

  useEffect(() => {
    mountedRef.current = true;
    void connect();
    return () => {
      mountedRef.current = false;
      clearTimer();
      void cancelSession();
    };
  }, [cancelSession, clearTimer, connect]);

  const start = useCallback(async () => {
    const currentLoginUrl = loginUrlRef.current;
    if (!client || !currentLoginUrl || authSessionRef.current) return;
    setState({ kind: "opening" });
    try {
      const result = await client.startAuth(currentLoginUrl);
      if (!mountedRef.current) {
        await client.cancelAuth(result.authSessionId).catch(() => undefined);
        return;
      }
      authSessionRef.current = result.authSessionId;
      authStartedAtRef.current = now();
      setState({ kind: "waiting", authSessionId: result.authSessionId });
      schedulePoll();
    } catch (error) {
      if (mountedRef.current) setState({ kind: "error", code: errorCode(error) });
    }
  }, [client, now, schedulePoll]);

  const cancel = useCallback(async () => {
    await cancelSession();
    if (mountedRef.current) setState({ kind: "cancelled" });
  }, [cancelSession]);

  const retry = useCallback(async () => {
    await cancelSession();
    await connect();
  }, [cancelSession, connect]);

  return { state, start, cancel, retry };
}
