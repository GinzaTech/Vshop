import { useMemo } from "react";

import {
  activateTransferredAccount,
  type TransferredSessionDependencies,
} from "~/services/accounts/transferred-session";
import type { PentestCompanionClient } from "~/services/pentest-companion/types";
import {
  initialMobileMirrorState,
  useMobileMirrorStore,
} from "~/hooks/useMobileMirrorStore";

type ControllerOptions = Readonly<{
  client: PentestCompanionClient;
  dependencies: TransferredSessionDependencies;
  wait?: (durationMs: number) => Promise<void>;
}>;

const defaultWait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const safeErrorCode = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code)
    ? code
    : "MOBILE_ACCOUNT_ACTIVATION_FAILED";
};

export function createMobileAccountMirrorController({
  client,
  dependencies,
  wait = defaultWait,
}: ControllerOptions) {
  let attempt = 0;

  const activate = async (handle: string) => {
    const state = useMobileMirrorStore.getState();
    if (!state.manifest) throw new Error("MOBILE_VAULT_UNAVAILABLE");
    const previousHandle = state.activeHandle;
    useMobileMirrorStore.setState({ status: "activating", errorCode: null });
    try {
      const user = await activateTransferredAccount({
        client,
        handle,
        manifest: state.manifest,
        dependencies,
      });
      useMobileMirrorStore.setState({
        status: "ready",
        activeHandle: handle,
        errorCode: null,
      });
      return user;
    } catch (error) {
      const code = safeErrorCode(error);
      useMobileMirrorStore.setState({
        status: "error",
        activeHandle: previousHandle,
        errorCode: code,
      });
      throw new Error(code);
    }
  };

  const start = async () => {
    const currentAttempt = ++attempt;
    useMobileMirrorStore.setState({
      ...initialMobileMirrorState,
      status: "checking",
    });
    try {
      await client.connect();
      if (attempt !== currentAttempt) return;
      const created = await client.startMobileVault();
      if (attempt !== currentAttempt) return;
      useMobileMirrorStore.setState({
        status: "waiting_for_phone",
        expiresAt: created.expiresAt,
      });
      while (attempt === currentAttempt) {
        const result = await client.getMobileVaultStatus(created.vaultId);
        if (attempt !== currentAttempt) return;
        if (result.status === "ready") break;
        if (result.status !== "waiting_for_phone") {
          throw new Error("MOBILE_VAULT_REJECTED");
        }
        await wait(350);
      }
      if (attempt !== currentAttempt) return;
      useMobileMirrorStore.setState({ status: "importing" });
      const consumed = await client.consumeMobileVault(created.vaultId);
      if (attempt !== currentAttempt) return;
      useMobileMirrorStore.setState({
        manifest: consumed.manifest,
        activeHandle: null,
        expiresAt: consumed.expiresAt,
        errorCode: null,
      });
      await activate(consumed.manifest.activeHandle);
    } catch (error) {
      if (attempt !== currentAttempt) return;
      useMobileMirrorStore.setState({
        status: "error",
        errorCode: safeErrorCode(error),
      });
      throw error;
    }
  };

  const cancel = async () => {
    attempt += 1;
    try {
      await client.cancelMobileVault();
    } finally {
      useMobileMirrorStore.setState({ ...initialMobileMirrorState });
    }
  };

  return Object.freeze({ start, activate, cancel });
}

export function useMobileAccountMirror(options: ControllerOptions) {
  const state = useMobileMirrorStore();
  const { client, dependencies, wait } = options;
  const controller = useMemo(
    () => createMobileAccountMirrorController({ client, dependencies, wait }),
    [client, dependencies, wait],
  );
  return { ...state, ...controller };
}
