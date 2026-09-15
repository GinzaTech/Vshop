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
});
