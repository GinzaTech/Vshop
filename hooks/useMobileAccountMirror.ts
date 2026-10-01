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
  // Đúng MỘT activation chạy tại một thời điểm: trong lúc đó cancel không được
  // phép "hồi sinh" UI hay nuốt kết quả thật của phiên (activation là nguyên tử
  // và được bảo vệ bởi session mutex — không hủy giữa chừng được).
  let activationInFlight = false;

  const activate = async (handle: string) => {
    const state = useMobileMirrorStore.getState();
    if (!state.manifest) throw new Error("MOBILE_VAULT_UNAVAILABLE");
    const previousHandle = state.activeHandle;
    const activationAttempt = ++attempt;
    activationInFlight = true;
    useMobileMirrorStore.setState({ status: "activating", errorCode: null });
    try {
      const user = await activateTransferredAccount({
        client,
        handle,
        manifest: state.manifest,
        dependencies,
      });
      // Cancel/start mới trong lúc activation chạy phải thắng việc publish.
      if (attempt !== activationAttempt) return user;
      useMobileMirrorStore.setState({
        status: "ready",
        activeHandle: handle,
        errorCode: null,
      });
      return user;
    } catch (error) {
      if (attempt === activationAttempt) {
        const code = safeErrorCode(error);
        useMobileMirrorStore.setState({
          status: "error",
          activeHandle: previousHandle,
          errorCode: code,
        });
      }
      throw new Error(safeErrorCode(error));
    } finally {
      activationInFlight = false;
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
    } catch {
      // Vault có thể đã bị consume/hết hạn phía server — việc reset store
      // về idle quan trọng hơn lỗi hủy; mã lỗi không đáng để đẩy lên UI.
    } finally {
      useMobileMirrorStore.setState({ ...initialMobileMirrorState });
    }
  };

  /** Dừng vòng chờ điện thoại khi panel unmount (không reset store, không
   *  chạm vault, không nuốt kết quả activation đang chạy thật). */
  const abortWait = () => {
    if (!activationInFlight) attempt += 1;
  };

  return Object.freeze({ start, activate, cancel, abortWait });
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
