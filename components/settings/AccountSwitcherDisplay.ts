import type { SavedAccount } from "~/utils/saved-accounts";

export type AccountDisplayStatus = "current" | "ready" | "login-required";
export type AccountDisplayRow = Readonly<{
  id: string;
  displayName: string;
  region: string;
  status: AccountDisplayStatus;
}>;

/** Explicit public projection: never spread a saved session into UI props. */
export function toAccountDisplayRow(
  account: Pick<SavedAccount, "id" | "name" | "tagLine" | "region">,
  status: AccountDisplayStatus,
): AccountDisplayRow {
  return {
    id: account.id,
    displayName: account.name ? `${account.name}#${account.tagLine}` : account.id,
    region: account.region.toUpperCase(),
    status,
  };
}
