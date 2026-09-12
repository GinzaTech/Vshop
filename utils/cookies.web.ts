/**
 * clearAllCookies - Phiên bản dành cho web, luôn trả về false vì không dùng cookie manager native
 * @returns {Promise<false>} Promise luôn trả về false
 */
export const clearAllCookies = async () => false;

/** Browser cookies are HttpOnly and cannot be snapshotted safely from JS. */
export const captureRiotAuthCookies = async () => [];

/** Multi-account cookie restoration is available only in native builds. */
export const restoreRiotAuthCookies = async () => false;
