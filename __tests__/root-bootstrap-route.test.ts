import { captureRootBootstrapRoute } from "~/utils/root-bootstrap-route";

describe("root bootstrap route snapshot", () => {
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
