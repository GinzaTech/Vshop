import { useProfileDashboardTabStore } from "~/features/profile/useProfileDashboardTabStore";

describe("profile dashboard tab store", () => {
  beforeEach(() => {
    useProfileDashboardTabStore.setState({ activeTab: "overview" });
  });

  it("switches the dashboard tab without requiring ProfileScreen state", () => {
    useProfileDashboardTabStore.getState().setActiveTab("details");

    expect(useProfileDashboardTabStore.getState().activeTab).toBe("details");
  });
});
