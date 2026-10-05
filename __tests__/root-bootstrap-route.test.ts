import { captureRootBootstrapRoute, resolveRootBootstrapHandoffPath } from "~/utils/root-bootstrap-route";

describe("root bootstrap route snapshot", () => {
  it("hands off to a live policy-approved mobile route after an early root snapshot", () => {
    const early = captureRootBootstrapRoute(null, { demo: undefined, isDev: true, pathname: "/" });
    const live = captureRootBootstrapRoute(early, { demo: undefined, isDev: true, pathname: "/session_handoff" });
    expect(live.pathname).toBe("/");
    expect(resolveRootBootstrapHandoffPath(live.pathname, "/session_handoff", true)).toBe("/session_handoff");
    expect(resolveRootBootstrapHandoffPath(live.pathname, "/store", false)).toBe("/");
  });
  it("keeps the launch route stable when authenticated navigation changes later", () => {
    const launch = captureRootBootstrapRoute(null, {
      demo: undefined,
      isDev: true,
      pathname: "/profile",
    });
    const afterNavigation = captureRootBootstrapRoute(launch, {
      demo: undefined,
      isDev: true,
      pathname: "/store",
    });

    expect(afterNavigation).toBe(launch);
    expect(afterNavigation.pathname).toBe("/profile");
    expect(afterNavigation.allowDemoRoute).toBe(false);
  });

  it("upgrades an early root snapshot when an explicit development demo deep link arrives", () => {
    const earlyRoot = captureRootBootstrapRoute(null, {
      demo: undefined,
      isDev: true,
      pathname: "/",
    });
    const demoDeepLink = captureRootBootstrapRoute(earlyRoot, {
      demo: "1",
      isDev: true,
      pathname: "/profile",
    });
    const afterNavigation = captureRootBootstrapRoute(demoDeepLink, {
      demo: undefined,
      isDev: true,
      pathname: "/store",
    });

    expect(demoDeepLink).toEqual({
      allowDemoRoute: true,
      pathname: "/profile",
    });
    expect(afterNavigation).toBe(demoDeepLink);
  });
});
