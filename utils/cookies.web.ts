/**
 * clearAllCookies - Phiên bản dành cho web, luôn trả về false vì không dùng cookie manager native
 * @returns {Promise<false>} Promise luôn trả về false
 */
export const clearAllCookies = async () => false;
