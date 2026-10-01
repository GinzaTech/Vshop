import { jwtDecode } from "jwt-decode";

import type {
  MobileVaultManifest,
  PentestCompanionClient,
  TransferredAccountSession,
} from "~/services/pentest-companion/types";
import { defaultUser } from "~/utils/valorant-user";
import { getAccountSessionKey, normalizeAccountId } from "~/utils/saved-accounts";

export class TransferredSessionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "TransferredSessionError";
    this.code = code;
  }
}

type User = typeof defaultUser;

export type TransferredSessionDependencies = Readonly<{
  invalidateSession: () => void;
  getGeneration: () => number;
  getUser: () => User;
  activateUser: (user: User) => void;
  buildAuthenticatedUser: (
    accessToken: string,
    region: string,
    seedUser: User,
    idToken: string,
  ) => Promise<User>;
  clearSavedAccounts: () => void;
  /** Snapshot toàn bộ danh sách tài khoản đã lưu (kèm activeAccountId). */
  getAccounts: () => unknown;
  /** Khôi phục danh sách tài khoản đã lưu khi rollback activation. */
  setAccounts: (snapshot: unknown) => void;
  captureMatchCache: () => unknown;
  restoreMatchCache: (snapshot: unknown) => void;
  getProfileCaches: () => unknown;
  setProfileCaches: (cache: unknown) => void;
  getWishlist: () => unknown;
  setWishlist: (wishlist: unknown) => void;
  getScreenshotMode: () => boolean;
  setScreenshotMode: (value: boolean) => void;
  /** Vô hiệu cache tài nguyên gắn credential cũ (combat/warmup/player/sync). */
  invalidateResourceCaches: () => void;
  /** Giữ quyền biến đổi phiên (false khi đang switch/login khác chạy). */
  beginActivation: () => boolean;
  endActivation: () => void;
  /** Hàng đợi tuần tự toàn cục cho thao tác trên phiên. */
  runInSessionQueue: <T>(operation: () => Promise<T>) => Promise<T>;
  syncAllData: (user: User, region: string) => Promise<unknown>;
  disconnectChat: () => void;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const tokenSubject = (value: string) => {
  try {
    const payload = jwtDecode<{ sub?: unknown }>(value);
    return typeof payload.sub === "string" ? normalizeAccountId(payload.sub) : "";
  } catch {
    return "";
  }
};

const validateIdentity = (
  selected: TransferredAccountSession,
  handle: string,
  manifest: MobileVaultManifest,
) => {
  const metadata = manifest.accounts.find((account) => account.handle === handle);
  const accountId = normalizeAccountId(selected.accountId);
  if (!metadata || selected.tokenStatus !== metadata.tokenStatus ||
      selected.tokenStatus !== "ready" || !accountId ||
      tokenSubject(selected.accessToken) !== accountId ||
      tokenSubject(selected.idToken) !== accountId ||
      selected.region !== metadata.region || selected.name !== metadata.name ||
      selected.tagLine !== metadata.tagLine) {
    throw new TransferredSessionError(
      selected.tokenStatus === "needs_reauth"
        ? "MOBILE_ACCOUNT_NEEDS_REAUTH"
        : "TRANSFERRED_ACCOUNT_REJECTED",
    );
  }
  return { accountId, metadata };
};

const snapshotForSelectedAccount = (
  selected: TransferredAccountSession,
  accountId: string,
) => {
  if (selected.stateSnapshot === null) return null;
  const snapshot = selected.stateSnapshot;
  const activeUser = snapshot.activeUser;
  if (!isRecord(activeUser) || normalizeAccountId(String(activeUser.id || "")) !== accountId ||
      activeUser.region !== selected.region) {
    throw new TransferredSessionError("TRANSFERRED_SNAPSHOT_REJECTED");
  }
  const authKey = getAccountSessionKey({ id: accountId, region: selected.region });
  const matchCache = snapshot.matchCache;
  if (matchCache !== null && (!isRecord(matchCache) || matchCache.authKey !== authKey)) {
    throw new TransferredSessionError("TRANSFERRED_SNAPSHOT_REJECTED");
  }
  const profileCaches = isRecord(snapshot.profileCaches) ? snapshot.profileCaches : {};
  const selectedProfileCache = isRecord(profileCaches[authKey])
    ? { [authKey]: profileCaches[authKey] }
    : {};
  if (!isRecord(snapshot.wishlist) || !Array.isArray(snapshot.wishlist.skinIds) ||
      typeof snapshot.wishlist.notificationEnabled !== "boolean" ||
      !isRecord(snapshot.preferences) ||
      typeof snapshot.preferences.screenshotModeEnabled !== "boolean") {
    throw new TransferredSessionError("TRANSFERRED_SNAPSHOT_REJECTED");
  }
  return {
    activeUser,
    matchCache: matchCache === null
      ? null
      : {
        ...matchCache,
        detailsById: {},
        error: null,
      },
    profileCaches: selectedProfileCache,
    wishlist: {
      skinIds: [...snapshot.wishlist.skinIds],
      notificationEnabled: snapshot.wishlist.notificationEnabled,
    },
    screenshotModeEnabled: snapshot.preferences.screenshotModeEnabled,
  };
};

/**
 * activateTransferredAccount — Kích hoạt tài khoản nhận từ vault điện thoại.
 *
 * Ràng buộc đúng-đuổi (đúng nguyên lý, siết an toàn):
 * 1. Chỉ MỘT biến đổi phiên tại một thời điểm: `beginActivation` (false khi
 *    switch/login/activation khác đang chạy) + toàn bộ thân trong
 *    `runInSessionQueue`. Không nơi nào bên trong được re-enter hàng đợi.
 * 2. Snapshot rollback bao gồm CẢ danh sách tài khoản đã lưu, vì
 *    `clearSavedAccounts` chạy sau khi sync thành công — mọi lỗi trước/sau
 *    đó phải trả lại đúng trạng thái ban đầu.
 * 3. Cache tài nguyên bị vô hiệu trước khi áp dữ liệu mới và một lần nữa khi
 *    rollback để không rời lại in-flight scope của credential cũ.
 * 4. `clearSavedAccounts` chỉ chạy SAU KHI `syncAllData` thành công và
 *    generation vẫn còn nguyên — đây là bước vệ sinh, không phải điều kiện
 *    tiên quyết, nên không được chạy trước đường có rủi ro nhất.
 */
export async function activateTransferredAccount({
  client,
  handle,
  manifest,
  dependencies,
}: {
  client: PentestCompanionClient;
  handle: string;
  manifest: MobileVaultManifest;
  dependencies: TransferredSessionDependencies;
}): Promise<User> {
  // Phải từ chối TRƯỚC khi consume vault (activateMobileVaultAccount là
  // one-time consume — từ chối sau consume sẽ mất vĩnh viễn phiên đã nhận).
  if (!dependencies.beginActivation()) {
    throw new TransferredSessionError("SESSION_BUSY");
  }
  try {
    return await dependencies.runInSessionQueue(() =>
      activateTransferredAccountInternal({ client, handle, manifest, dependencies })
    );
  } finally {
    dependencies.endActivation();
  }
}

async function activateTransferredAccountInternal({
  client,
  handle,
  manifest,
  dependencies,
}: {
  client: PentestCompanionClient;
  handle: string;
  manifest: MobileVaultManifest;
  dependencies: TransferredSessionDependencies;
}): Promise<User> {
  const selected = await client.activateMobileVaultAccount(handle);
  const { accountId } = validateIdentity(selected, handle, manifest);
  const snapshot = snapshotForSelectedAccount(selected, accountId);
  const previous = {
    user: dependencies.getUser(),
    accounts: dependencies.getAccounts(),
    matchCache: dependencies.captureMatchCache(),
    profileCaches: dependencies.getProfileCaches(),
    wishlist: dependencies.getWishlist(),
    screenshotMode: dependencies.getScreenshotMode(),
  };
  dependencies.invalidateSession();
  const generation = dependencies.getGeneration();
  // Credential cũ sắp bị thay: mọi cache tài nguyên in-flight phải chết ngay.
  dependencies.invalidateResourceCaches();

  const seedUser = {
    ...defaultUser,
    ...(snapshot?.activeUser ?? {}),
    id: accountId,
    name: selected.name,
    TagLine: selected.tagLine,
    region: selected.region,
    accessToken: selected.accessToken,
    idToken: selected.idToken,
    entitlementsToken: selected.entitlementsToken,
  } as User;

  try {
    dependencies.disconnectChat();
    dependencies.activateUser(seedUser);
    if (snapshot?.matchCache) dependencies.restoreMatchCache(snapshot.matchCache);
    if (snapshot) {
      dependencies.setProfileCaches(snapshot.profileCaches);
      dependencies.setWishlist(snapshot.wishlist);
      dependencies.setScreenshotMode(snapshot.screenshotModeEnabled);
    }
    const authenticatedUser = await dependencies.buildAuthenticatedUser(
      selected.accessToken,
      selected.region,
      seedUser,
      selected.idToken,
    );
    if (dependencies.getGeneration() !== generation) {
      throw new TransferredSessionError("SESSION_CHANGED");
    }
    if (normalizeAccountId(authenticatedUser.id) !== accountId) {
      throw new TransferredSessionError("TRANSFERRED_ACCOUNT_REJECTED");
    }
    dependencies.activateUser(authenticatedUser);
    await dependencies.syncAllData(authenticatedUser, authenticatedUser.region);
    if (dependencies.getGeneration() !== generation) {
      throw new TransferredSessionError("SESSION_CHANGED");
    }
    // Chỉ xóa tài khoản trình duyệt khi phiên chuyển giao đã commit thành công.
    dependencies.clearSavedAccounts();
    return authenticatedUser;
  } catch (error) {
    if (dependencies.getGeneration() !== generation) {
      throw new TransferredSessionError("SESSION_CHANGED");
    }
    dependencies.invalidateResourceCaches();
    dependencies.activateUser(previous.user);
    dependencies.setAccounts(previous.accounts);
    dependencies.restoreMatchCache(previous.matchCache);
    dependencies.setProfileCaches(previous.profileCaches);
    dependencies.setWishlist(previous.wishlist);
    dependencies.setScreenshotMode(previous.screenshotMode);
    if (error instanceof TransferredSessionError) throw error;
    throw new TransferredSessionError("TRANSFERRED_ACCOUNT_ACTIVATION_FAILED");
  }
}
