type DemoParam = string | string[] | undefined;

type DevelopmentDemoRouteInput = {
  demo: DemoParam;
  isDev: boolean;
  pathname: string;
};

const isTruthyDemoParam = (value: DemoParam) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "1" || normalizedValue === "true";
};

/** Keep demo data reachable only from explicitly supported development routes. */
export function isDevelopmentDemoRoute({
  demo,
  isDev,
  pathname,
}: DevelopmentDemoRouteInput) {
  if (!isDev || !isTruthyDemoParam(demo)) return false;

  return (
    pathname === "/history" ||
    pathname === "/profile" ||
    pathname.startsWith("/match_details/")
  );
}
