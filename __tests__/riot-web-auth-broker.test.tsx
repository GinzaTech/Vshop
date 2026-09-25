import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  useRiotWebAuthBroker,
  type RiotWebAuthBrokerController,
} from "~/hooks/useRiotWebAuthBroker";
import {
  PentestCompanionError,
  type PentestCompanionClient,
  type RiotProxyRequest,
} from "~/services/pentest-companion/types";

const authSessionId = "b".repeat(64);
const callbackUrl = "https://playvalorant.com/opt_in#access_token=access-secret&id_token=id-secret";

const createClient = (): jest.Mocked<PentestCompanionClient> => ({
  connect: jest.fn(async () => ({ mutationMode: false })),
  startAuth: jest.fn(async (_authorizationUrl: string) => ({ authSessionId })),
  getAuthStatus: jest.fn(async (_authSessionId: string) => ({
    status: "pending" as const,
  })),
  consumeAuth: jest.fn(async (_authSessionId: string) => ({ callbackUrl })),
  cancelAuth: jest.fn(async (_authSessionId: string) => undefined),
  proxy: jest.fn(async (_request: RiotProxyRequest, _signal?: AbortSignal) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    data: {},
  })),
});

let latest!: RiotWebAuthBrokerController;

function HookHarness({
  client,
  onCallback,
  now,
  authTimeoutMs,
}: {
  client?: PentestCompanionClient;
  onCallback: (value: string) => Promise<void>;
  now?: () => number;
  authTimeoutMs?: number;
}) {
  const controller = useRiotWebAuthBroker({
    ...(client ? { client } : {}),
    loginUrl: "https://auth.riotgames.com/authorize?safe=1",
    onCallback,
    ...(now ? { now } : {}),
    ...(authTimeoutMs ? { authTimeoutMs } : {}),
  });
  useEffect(() => { latest = controller; }, [controller]);
  return null;
}

describe("useRiotWebAuthBroker", () => {
  let renderer: TestRenderer.ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const mount = async (
    client?: PentestCompanionClient,
    onCallback: (value: string) => Promise<void> = async () => undefined,
    timing?: { now: () => number; authTimeoutMs: number },
  ) => {
    await act(async () => {
      renderer = TestRenderer.create(
        <HookHarness
          client={client}
          onCallback={onCallback}
          now={timing?.now}
          authTimeoutMs={timing?.authTimeoutMs}
        />,
      );
    });
  };

  it("connects on mount but never opens auth before direct start", async () => {
    const client = createClient();
    await mount(client);
    expect(latest.state).toEqual({ kind: "ready", mutationMode: false });
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.startAuth).not.toHaveBeenCalled();
  });

  it("polls one request at a time and consumes a completed callback once", async () => {
    const client = createClient();
    client.getAuthStatus
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "completed" });
    const onCallback = jest.fn(async () => undefined);
    await mount(client, onCallback);
    await act(async () => latest.start());
    expect(client.startAuth).toHaveBeenCalledWith(
      "https://auth.riotgames.com/authorize?safe=1",
    );
    expect(latest.state).toEqual({ kind: "waiting", authSessionId });

    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(client.getAuthStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(client.getAuthStatus).toHaveBeenCalledTimes(2);
    expect(client.consumeAuth).toHaveBeenCalledTimes(1);
    expect(onCallback).toHaveBeenCalledWith(callbackUrl);
    expect(latest.state.kind).toBe("completing");
  });

  it("cancels timer and server auth explicitly", async () => {
    const client = createClient();
    await mount(client);
    await act(async () => latest.start());
    await act(async () => latest.cancel());
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
    expect(latest.state).toEqual({ kind: "cancelled" });
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    expect(client.getAuthStatus).not.toHaveBeenCalled();
  });

  it("cancels an active server auth session on unmount", async () => {
    const client = createClient();
    await mount(client);
    await act(async () => latest.start());
    await act(async () => renderer.unmount());
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
  });

  it("fails closed when companion connection is unavailable", async () => {
    const client = createClient();
    client.connect.mockRejectedValueOnce(
      new PentestCompanionError("COMPANION_DISABLED"),
    );
    await mount(client);
    expect(latest.state).toEqual({
      kind: "error",
      code: "COMPANION_DISABLED",
    });
    expect(client.startAuth).not.toHaveBeenCalled();
  });

  it("maps unknown connection failures to a safe unavailable code", async () => {
    const client = createClient();
    client.connect.mockRejectedValueOnce(new Error("raw-connection-secret"));
    await mount(client);
    expect(latest.state).toEqual({
      kind: "error",
      code: "COMPANION_UNAVAILABLE",
    });
  });

  it("fails closed when no companion client can be resolved", async () => {
    await mount(undefined);
    expect(latest.state).toEqual({
      kind: "error",
      code: "COMPANION_DISABLED",
    });
  });

  it("maps browser cancellation and supports retry without stale polling", async () => {
    const client = createClient();
    client.getAuthStatus.mockResolvedValueOnce({ status: "cancelled" });
    await mount(client);
    await act(async () => latest.start());
    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(latest.state).toEqual({ kind: "cancelled" });
    await act(async () => latest.retry());
    expect(latest.state).toEqual({ kind: "ready", mutationMode: false });
  });

  it("maps failed browser status and start errors", async () => {
    const client = createClient();
    client.getAuthStatus.mockResolvedValueOnce({ status: "failed" });
    await mount(client);
    await act(async () => latest.start());
    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(latest.state).toEqual({
      kind: "error",
      code: "BROWSER_UNAVAILABLE",
    });

    client.startAuth.mockRejectedValueOnce(
      new PentestCompanionError("BROWSER_UNAVAILABLE"),
    );
    await act(async () => latest.retry());
    await act(async () => latest.start());
    expect(latest.state).toEqual({
      kind: "error",
      code: "BROWSER_UNAVAILABLE",
    });
  });

  it("cancels and reports a local polling timeout", async () => {
    let current = 1_800_000_000_000;
    const client = createClient();
    await mount(client, async () => undefined, {
      now: () => current,
      authTimeoutMs: 500,
    });
    await act(async () => latest.start());
    current += 501;
    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
    expect(latest.state).toEqual({ kind: "error", code: "AUTH_TIMEOUT" });
  });

  it("cancels a server session when polling throws", async () => {
    const client = createClient();
    client.getAuthStatus.mockRejectedValueOnce(
      new PentestCompanionError("SESSION_EXPIRED"),
    );
    await mount(client);
    await act(async () => latest.start());
    await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
    expect(latest.state).toEqual({ kind: "error", code: "SESSION_EXPIRED" });
  });

  it("cancels a browser session that opens after unmount", async () => {
    const client = createClient();
    let resolveStart!: (value: { authSessionId: string }) => void;
    client.startAuth.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStart = resolve;
    }));
    await mount(client);
    let opening!: Promise<void>;
    await act(async () => {
      opening = latest.start();
      await Promise.resolve();
    });
    await act(async () => renderer.unmount());
    resolveStart({ authSessionId });
    await act(async () => opening);
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
  });

  it("deduplicates rapid start presses before the server responds", async () => {
    const client = createClient();
    let resolveStart!: (value: { authSessionId: string }) => void;
    client.startAuth.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStart = resolve;
    }));
    await mount(client);
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = latest.start();
      second = latest.start();
      await Promise.resolve();
    });
    expect(client.startAuth).toHaveBeenCalledTimes(1);
    resolveStart({ authSessionId });
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(latest.state).toEqual({ kind: "waiting", authSessionId });
  });

  it("keeps cancelled state when start resolves after cancel", async () => {
    const client = createClient();
    let resolveStart!: (value: { authSessionId: string }) => void;
    client.startAuth.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStart = resolve;
    }));
    await mount(client);
    let opening!: Promise<void>;
    await act(async () => {
      opening = latest.start();
      await Promise.resolve();
    });
    await act(async () => latest.cancel());
    expect(latest.state).toEqual({ kind: "cancelled" });
    resolveStart({ authSessionId });
    await act(async () => opening);
    expect(client.cancelAuth).toHaveBeenCalledWith(authSessionId);
    expect(latest.state).toEqual({ kind: "cancelled" });
  });
});
