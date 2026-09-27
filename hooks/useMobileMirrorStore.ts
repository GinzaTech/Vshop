import { create } from "zustand";

import type { MobileVaultManifest } from "~/services/pentest-companion/types";

export type MobileMirrorStatus =
  | "idle"
  | "checking"
  | "waiting_for_phone"
  | "importing"
  | "activating"
  | "ready"
  | "error";

export type MobileMirrorState = Readonly<{
  status: MobileMirrorStatus;
  manifest: MobileVaultManifest | null;
  activeHandle: string | null;
  expiresAt: number | null;
  errorCode: string | null;
}>;

export const initialMobileMirrorState: MobileMirrorState = Object.freeze({
  status: "idle",
  manifest: null,
  activeHandle: null,
  expiresAt: null,
  errorCode: null,
});

export const useMobileMirrorStore = create<MobileMirrorState>(() => ({
  ...initialMobileMirrorState,
}));
