/** Geometry only: account/session owners continue to supply all data and actions. */
export function getProfileCompactLayout(width: number, fontScale: number) {
  const available = Math.max(48, width - 32);
  const columns = width < 350 || fontScale >= 1.3 ? 2 : width >= 700 ? 6 : 3;
  const gridWidth = Math.floor((available - 8 * (columns - 1)) / columns);
  const rowWidth = Math.min(160, Math.max(124, Math.floor(available / (fontScale >= 1.3 ? 2.2 : 2.6))));
  return { profileGridColumns: columns, profileGridCardWidth: Math.max(48, gridWidth), profileSkinRowCardWidth: rowWidth };
}
