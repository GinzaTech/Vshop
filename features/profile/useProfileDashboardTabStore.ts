import { create } from "zustand";

export type ProfileDashboardTab = "overview" | "details";

type ProfileDashboardTabState = {
  activeTab: ProfileDashboardTab;
  setActiveTab: (tab: ProfileDashboardTab) => void;
};

/**
 * State UI nhỏ, tách khỏi ProfileScreen để đổi Tổng quan/Chi tiết không làm
 * render lại pager trang bị, collection và toàn bộ hero phía trên.
 */
export const useProfileDashboardTabStore = create<ProfileDashboardTabState>(
  (set) => ({
    activeTab: "overview",
    setActiveTab: (activeTab) =>
      set((current) =>
        current.activeTab === activeTab ? current : { activeTab }
      ),
  })
);
