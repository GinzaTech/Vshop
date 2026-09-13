/**
 * riot-auth-navigation.ts — Kiểm soát điều hướng của WebView đăng nhập Riot
 * (OAuth): chỉ cho phép điều hướng tới host Riot tin cậy và phát hiện URL
 * callback chứa token để app bắt lấy.
 */

// Các host gốc được tin cậy (bao gồm mọi subdomain).
const TRUSTED_AUTH_HOSTS = ["riotgames.com", "playvalorant.com"] as const;

/**
 * isTrustedHostname — Hostname có thuộc một host tin cậy (hoặc subdomain của
 * nó) không. So khớp sau khi trim + lowercase + bỏ dấu "." cuối.
 * @param {string} hostname - Hostname cần kiểm tra
 * @returns {boolean} true nếu hostname là Riot/PlayValorant tin cậy
 */
const isTrustedHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return TRUSTED_AUTH_HOSTS.some(
    (trustedHost) =>
      normalized === trustedHost || normalized.endsWith(`.${trustedHost}`)
  );
};

/** Restrict top-level OAuth navigation while allowing Riot-owned subdomains. */
/**
 * isAllowedRiotAuthNavigation — Cho phép WebView điều hướng tới URL này không.
 * Chỉ chấp nhận https + host Riot tin cậy; "about:blank" được cho qua vì
 * WebView dùng nó làm trang trung gian. Mọi URL khác (kể cả http, host lạ,
 * URL lỗi) đều chặn — chống rò rỉ token OAuth sang trang bên thứ ba.
 * @param {string} value - URL sắp điều hướng tới
 * @returns {boolean} true nếu được phép điều hướng
 */
export const isAllowedRiotAuthNavigation = (value: string): boolean => {
  if (value === "about:blank") return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && isTrustedHostname(url.hostname);
  } catch {
    return false;
  }
};

/**
 * isRiotAuthCallbackUrl — URL có phải callback OAuth của Riot chứa token
 * không (khi login thành công, Riot redirect tới playvalorant.com/opt_in
 * kèm access_token + id_token trong hash hoặc query). App bắt URL này để
 * trích token thay vì để WebView điều hướng tiếp.
 * @param {string} value - URL cần kiểm tra
 * @returns {boolean} true nếu là callback OAuth hợp lệ chứa đủ 2 token
 */
export const isRiotAuthCallbackUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
    return url.protocol === "https:" && url.hostname === "playvalorant.com" &&
      !url.username && !url.password && /^\/(?:[a-z]{2}-[a-z]{2}\/)?opt_in\/?$/i.test(url.pathname) &&
      Boolean(params.get("access_token") && params.get("id_token"));
  } catch {
    return false;
  }
};
