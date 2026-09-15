import { isDevelopmentDemoRoute } from "~/utils/demo-mode";

export type RootBootstrapRouteSnapshot = {
  allowDemoRoute: boolean;
  pathname: string;
};

type RootBootstrapRouteInput = {
  demo: string | string[] | undefined;
  isDev: boolean;
  pathname: string;
};

/**
 * Bootstrap chỉ sở hữu route tại thời điểm khởi động. Điều hướng sau đó không
 * được tạo snapshot mới rồi kéo người dùng ngược về Profile.
 */
export function captureRootBootstrapRoute(
  existing: RootBootstrapRouteSnapshot | null,
  input: RootBootstrapRouteInput
): RootBootstrapRouteSnapshot {
  if (existing) return existing;

  return {
    allowDemoRoute: isDevelopmentDemoRoute(input),
    pathname: input.pathname,
  };
}
