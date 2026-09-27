import type { SavedAccount } from "~/utils/saved-accounts";

export type MobileAccountVaultSource = Readonly<{
  packageName: "com.android.vshop";
  appVersion: string;
  versionCode: number;
}>;

export type MobileVaultSnapshotInput = Readonly<{
  accounts: readonly SavedAccount[];
  activeAccountId: string;
  activeUser: Readonly<Record<string, unknown>>;
  matchCache: Readonly<Record<string, unknown>> | null;
  profileCaches: Readonly<Record<string, unknown>>;
  wishlist: Readonly<Record<string, unknown>>;
  screenshotModeEnabled: boolean;
  source: MobileAccountVaultSource;
  capturedAt: number;
  [key: string]: unknown;
}>;

export type MobileAccountVaultEnvelope = Readonly<{
  schemaVersion: 2;
  capturedAt: number;
  source: MobileAccountVaultSource;
  activeAccountId: string;
  accounts: readonly SavedAccount[];
  stateSnapshot: Readonly<{
    activeUser: Readonly<Record<string, unknown>>;
    matchCache: Readonly<Record<string, unknown>> | null;
    profileCaches: Readonly<Record<string, unknown>>;
    wishlist: Readonly<{
      skinIds: readonly string[];
      notificationEnabled: boolean;
    }>;
    preferences: Readonly<{ screenshotModeEnabled: boolean }>;
  }>;
}>;
