/**
 * cookies.ts — Facade mặc định: trỏ tới riot-cookies (triển khai native).
 * Metro resolve cookies.native.ts / cookies.web.ts theo platform khi import
 * có đuôi platform, còn import "utils/cookies" mặc định dùng file này.
 */
export * from "./riot-cookies";
