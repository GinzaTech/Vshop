# 09 — Cấu trúc phối hợp bên trong Profile

Góc nhìn Composite Structure: các phần nội bộ cộng tác để tạo ra một màn
hình. Các port/part là ký pháp minh hoạ bằng Mermaid subgraph, không phải
component UML được công cụ sinh tự động.

```mermaid
flowchart TB
    U[Thao tác người dùng]
    subgraph Profile[ProfileScreen]
        Session[useProfileSession: auth và cache]
        State[useProfileState: state và refs]
        Fetch[useProfileFetch: tải và refresh]
        Derived[LoadoutData + HeroData + Collection]
        Picker[PickerOptions + Pickers]
        Mutation[useProfileMutations]
        Motion[Motion + Pager + CollapsibleHeader]
        StatsTabs[Dashboard tab store + UI-thread progress]
        View[Hero, EquipmentSections, PickerModal, Dashboard]
        Session --> State
        Session --> Fetch
        Fetch --> State
        State --> Derived
        Derived --> View
        Derived --> Picker
        Picker --> View
        Picker --> Mutation
        Mutation --> State
        State --> Motion
        Motion --> View
        StatsTabs --> View
        Motion --> StatsTabs
    end
    U --> View
    View -->|Refresh / chọn Act| Fetch
    View -->|Thao tác trang bị rõ ràng| Mutation
    Fetch --> Riot[Riot service facade]
    Mutation --> Riot
    Fetch --> Cache[(Profile và match stores)]
    Session --> Cache
    Fetch --> Baseline[Act recording policy]
    Baseline --> Cache
```

Không có dependency từ HTTP client quay ngược vào UI. Các hook được tách theo
trách nhiệm; store liên tài khoản và state picker/motion cục bộ có vòng đời khác
nhau. Tab Tổng quan/Chi tiết dùng store UI riêng để không render lại toàn bộ
Profile; hai panel đã layout sẵn chỉ đổi lớp bằng shared value trên UI thread.
Dashboard chỉ nhận `seasonOptions` đã lọc; component không tự nhân đôi policy
baseline hoặc đọc archive legacy trực tiếp.

Nguồn: [ProfileScreen](../features/profile/ProfileScreen.tsx),
[fetch](../features/profile/useProfileFetch.ts), [mutations](../features/profile/useProfileMutations.ts),
[motion](../features/profile/useProfileMotion.ts),
[dashboard tab store](../features/profile/useProfileDashboardTabStore.ts),
[pager](../features/profile/useProfilePager.ts).
