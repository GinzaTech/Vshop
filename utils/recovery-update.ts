import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  compareVersions,
  getCurrentVersion,
  getLatestRelease,
  getUpdateEnvironment,
  getUpdatesModule,
  type UpdateEnvironment,
} from "~/utils/app-update";

const RECOVERY_UPDATE_ATTEMPT_KEY = "recovery-update-attempt-v1";
const MAX_FAILED_STARTS = 2;

type RecoveryManifest = {
  id?: string;
};

export type RecoveryUpdates = {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{
    isAvailable: boolean;
    manifest?: RecoveryManifest | null;
  }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

export type RecoveryStorage = Pick<
  typeof AsyncStorage,
  "getItem" | "setItem" | "removeItem"
>;

type RecoveryUpdateAttempt = {
  failures: number;
  updateId: string;
};

export type RecoveryUpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "downloading" }
  | { kind: "restarting" }
  | { kind: "up-to-date" }
  | { kind: "native-update"; releaseUrl: string }
  | { kind: "error"; message: string };

export type RecoveryUpdateDependencies = {
  currentVersion: string;
  environment: UpdateEnvironment;
  getLatestRelease: () => Promise<{ version: string; url: string }>;
  storage: RecoveryStorage;
  updates: RecoveryUpdates | null;
};

function isRecoveryAttempt(value: unknown): value is RecoveryUpdateAttempt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.updateId === "string" &&
    candidate.updateId.length > 0 &&
    typeof candidate.failures === "number" &&
    Number.isInteger(candidate.failures) &&
    candidate.failures >= 0
  );
}

async function readAttempt(
  storage: RecoveryStorage,
): Promise<RecoveryUpdateAttempt | null> {
  try {
    const stored = await storage.getItem(RECOVERY_UPDATE_ATTEMPT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isRecoveryAttempt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeAttempt(
  storage: RecoveryStorage,
  attempt: RecoveryUpdateAttempt,
) {
  await storage.setItem(
    RECOVERY_UPDATE_ATTEMPT_KEY,
    JSON.stringify(attempt),
  );
}

async function recordFailure(storage: RecoveryStorage, updateId: string) {
  const existing = await readAttempt(storage);
  await writeAttempt(storage, {
    failures:
      existing?.updateId === updateId ? existing.failures + 1 : 1,
    updateId,
  });
}

function manifestId(manifest: RecoveryManifest | null | undefined) {
  return typeof manifest?.id === "string" && manifest.id.length > 0
    ? manifest.id
    : "unknown-update";
}

async function resolveNativeFallback(
  dependencies: RecoveryUpdateDependencies,
): Promise<RecoveryUpdateState> {
  try {
    const release = await dependencies.getLatestRelease();
    if (compareVersions(dependencies.currentVersion, release.version) < 0) {
      return { kind: "native-update", releaseUrl: release.url };
    }
    return { kind: "up-to-date" };
  } catch {
    return {
      kind: "error",
      message: "Unable to check for updates right now.",
    };
  }
}

export async function runRecoveryUpdate(
  dependencies: RecoveryUpdateDependencies,
  publish: (state: RecoveryUpdateState) => void,
): Promise<RecoveryUpdateState> {
  const finish = (state: RecoveryUpdateState) => {
    publish(state);
    return state;
  };

  publish({ kind: "checking" });
  if (
    dependencies.environment !== "standalone" ||
    !dependencies.updates?.isEnabled
  ) {
    return finish({
      kind: "error",
      message:
        "Recovery updates are available only in an installed production build.",
    });
  }

  let checkResult: Awaited<
    ReturnType<RecoveryUpdates["checkForUpdateAsync"]>
  >;
  try {
    checkResult = await dependencies.updates.checkForUpdateAsync();
  } catch {
    const fallback = await resolveNativeFallback(dependencies);
    return fallback.kind === "native-update"
      ? finish(fallback)
      : finish({
          kind: "error",
          message: "Unable to check for updates right now.",
        });
  }

  if (!checkResult.isAvailable) {
    return finish(await resolveNativeFallback(dependencies));
  }

  const updateId = manifestId(checkResult.manifest);
  const previousAttempt = await readAttempt(dependencies.storage);
  if (
    previousAttempt?.updateId === updateId &&
    previousAttempt.failures >= MAX_FAILED_STARTS
  ) {
    return finish({
      kind: "error",
      message:
        "This update failed to start more than once. Install a newer native release or retry later.",
    });
  }

  publish({ kind: "downloading" });
  await writeAttempt(dependencies.storage, {
    failures:
      previousAttempt?.updateId === updateId
        ? previousAttempt.failures
        : 0,
    updateId,
  });

  let fetchResult: Awaited<ReturnType<RecoveryUpdates["fetchUpdateAsync"]>>;
  try {
    fetchResult = await dependencies.updates.fetchUpdateAsync();
  } catch {
    await recordFailure(dependencies.storage, updateId);
    return finish({
      kind: "error",
      message: "Unable to download the update right now.",
    });
  }

  if (!fetchResult.isNew) {
    await dependencies.storage.removeItem(RECOVERY_UPDATE_ATTEMPT_KEY);
    return finish({ kind: "up-to-date" });
  }

  publish({ kind: "restarting" });
  try {
    await dependencies.updates.reloadAsync();
  } catch {
    await recordFailure(dependencies.storage, updateId);
    return finish({
      kind: "error",
      message: "The update downloaded but VShop could not restart.",
    });
  }

  return { kind: "restarting" };
}

export async function startRecoveryUpdate(
  publish: (state: RecoveryUpdateState) => void,
) {
  return runRecoveryUpdate(
    {
      currentVersion: getCurrentVersion(),
      environment: getUpdateEnvironment(),
      getLatestRelease,
      storage: AsyncStorage,
      updates: getUpdatesModule() as unknown as RecoveryUpdates | null,
    },
    publish,
  );
}

export async function markRecoveryStartupFailure(
  storage: RecoveryStorage = AsyncStorage,
) {
  const attempt = await readAttempt(storage);
  if (!attempt) return;
  await writeAttempt(storage, {
    failures: attempt.failures + 1,
    updateId: attempt.updateId,
  });
}

export async function clearRecoveryUpdateFailure(
  storage: RecoveryStorage = AsyncStorage,
) {
  await storage.removeItem(RECOVERY_UPDATE_ATTEMPT_KEY);
}
