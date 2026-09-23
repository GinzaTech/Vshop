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
 * Bootstrap chỉ sở hữu route tại thời điểm khởi động. Riêng development demo
 * deep link được phép nâng snapshot `/` ban đầu vì Expo Router có thể publish
 * initial URL sau khi persisted stores đã hydrate. Sau khi demo được nhận,
 * điều hướng bình thường không được kéo bootstrap sang route khác.
 */
export function captureRootBootstrapRoute(
  existing: RootBootstrapRouteSnapshot | null,
  input: RootBootstrapRouteInput
): RootBootstrapRouteSnapshot {
  const allowDemoRoute = isDevelopmentDemoRoute(input);
  if (existing?.allowDemoRoute || (existing && !allowDemoRoute)) {
    return existing;
  }

  return {
    allowDemoRoute,
    pathname: input.pathname,
  };
}
