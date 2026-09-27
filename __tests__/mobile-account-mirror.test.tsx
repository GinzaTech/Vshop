import {
  createMobileAccountMirrorController,
} from "~/hooks/useMobileAccountMirror";
import {
  initialMobileMirrorState,
  useMobileMirrorStore,
} from "~/hooks/useMobileMirrorStore";
import { activateTransferredAccount } from "~/services/accounts/transferred-session";
import type {
  MobileVaultManifest,
  PentestCompanionClient,
} from "~/services/pentest-companion/types";

jest.mock("~/services/accounts/transferred-session", () => ({
  activateTransferredAccount: jest.fn(async ({ handle }: { handle: string }) => ({
    id: handle,
    region: "ap",
  })),
}));

const activeHandle = "a".repeat(64);
const manifest: MobileVaultManifest = {
  schemaVersion: 2,
  capturedAt: Date.now(),
  activeHandle,
  accounts: [{
    handle: activeHandle,
    name: "Agent",
    tagLine: "AP",
    region: "ap",
    lastUsedAt: Date.now(),
    tokenStatus: "ready",
  }],
  snapshotManifest: { hasMatchCache: true, profileCacheCount: 1, wishlistCount: 1 },
};

const createClient = (): jest.Mocked<PentestCompanionClient> => ({
  connect: jest.fn(async () => ({ mutationMode: false })),
  startAuth: jest.fn(),
  getAuthStatus: jest.fn(),
  consumeAuth: jest.fn(),
  cancelAuth: jest.fn(),
  startMobileVault: jest.fn(async () => ({
    vaultId: "d".repeat(64),
    status: "waiting_for_phone" as const,
    expiresAt: Date.now() + 60_000,
  })),
  getMobileVaultStatus: jest.fn(async (_vaultId: string) => ({ status: "ready" as const })),
  consumeMobileVault: jest.fn(async (_vaultId: string) => ({
    expiresAt: Date.now() + 60_000,
    manifest,
  })),
  activateMobileVaultAccount: jest.fn(),
  cancelMobileVault: jest.fn(async () => undefined),
  proxy: jest.fn(),
});

describe("mobile account mirror controller", () => {
  beforeEach(() => {
    useMobileMirrorStore.setState(initialMobileMirrorState, true);
    jest.clearAllMocks();
  });

  it("imports the manifest and activates the phone-active account", async () => {
    const client = createClient();
    const controller = createMobileAccountMirrorController({
      client,
      dependencies: {} as never,
      wait: async () => undefined,
    });

    await controller.start();

    expect(useMobileMirrorStore.getState()).toMatchObject({
      status: "ready",
      manifest,
      activeHandle,
    });
    expect(activateTransferredAccount).toHaveBeenCalledWith(expect.objectContaining({
      client,
      handle: activeHandle,
      manifest,
    }));
  });

  it("keeps the manifest and previous active handle when a switch fails", async () => {
    const client = createClient();
    const controller = createMobileAccountMirrorController({
      client,
      dependencies: {} as never,
      wait: async () => undefined,
    });
    await controller.start();
    jest.mocked(activateTransferredAccount).mockRejectedValueOnce(new Error("secret"));

    await expect(controller.activate("b".repeat(64))).rejects.toThrow("MOBILE_ACCOUNT_ACTIVATION_FAILED");
    expect(useMobileMirrorStore.getState()).toMatchObject({
      status: "error",
      manifest,
      activeHandle,
      errorCode: "MOBILE_ACCOUNT_ACTIVATION_FAILED",
    });
  });

  it("cancels an in-flight import and ignores its later status", async () => {
    const client = createClient();
    let resolveStatus!: (value: { status: "ready" }) => void;
    client.getMobileVaultStatus.mockImplementationOnce(
      () => new Promise((resolve) => { resolveStatus = resolve; }),
    );
    const controller = createMobileAccountMirrorController({
      client,
      dependencies: {} as never,
      wait: async () => undefined,
    });
    const running = controller.start();
    for (let attempt = 0;
      attempt < 10 && client.getMobileVaultStatus.mock.calls.length === 0;
      attempt += 1) {
      await Promise.resolve();
    }
    await controller.cancel();
    resolveStatus({ status: "ready" });
    await running;

    expect(useMobileMirrorStore.getState()).toMatchObject({
      status: "idle",
      manifest: null,
    });
  });
});
