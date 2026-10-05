import React from "react";
import { FlatList, ScrollView, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import Profile from "~/features/profile/ProfileScreen";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import { CollectionCheckerExportProvider } from "~/components/profile/CollectionCheckerExport";
import type { useProfileState } from "~/features/profile/useProfileState";
import type { useProfilePickers } from "~/features/profile/useProfilePickers";
import type { PickerState } from "~/features/profile/profile-loadout";
import type { EquippedWeapon } from "~/components/GalleryProfile";
import type { useProfileLoadoutData } from "~/features/profile/useProfileLoadoutData";
import type { useProfileCollection } from "~/features/profile/useProfileCollection";
import type { useProfileHeroData } from "~/features/profile/useProfileHeroData";
import type { useProfileSession } from "~/features/profile/useProfileSession";
import type { SeasonPerformanceStats } from "~/types/match-ui";
import { defaultUser } from "~/utils/valorant-user";

let mockFocused = true;
let mockFreshSeasonFallback = false;
let mockState: ReturnType<typeof useProfileState>;
const mockDismiss = jest.fn();
const mockUnmount = jest.fn();
const mockUser = { ...defaultUser, id: "retained-account", name: "Retained Profile", ownedSkinIds: ["owned-skin"] };
const mockSetUser = jest.fn();
const mockPagerRef = { current: { scrollTo: jest.fn() } };
const mockInteractionLockedRef = { current: false };
const mockInteractionTimerRef = { current: null };
const mockPickerCommits: { focused: boolean; presented: PickerState | null; stored: PickerState | null }[] = [];
const mockRootEffects = jest.fn();
const mockRenderCounts = { hero: 0, skin: 0, dashboard: 0 };
const mockEmptyList: never[] = [];
const mockEmptyRecord = {};
const mockEmptySet = new Set<string>();
const mockEmptyMap = new Map();
const mockStyle = {};
const mockProgress = { value: 0 };
const mockNoop = jest.fn();
const mockTranslateEn = (key: string) => `en:${key}`;
const mockTranslateVi = (key: string) => `vi:${key}`;
const mockWeapon: EquippedWeapon = {
  weaponId: "vandal", weaponName: "Vandal", category: "rifles", skinId: "owned-skin",
  skinLevelId: "level-1", chromaId: "chroma-1", skinName: "Owned Vandal",
};
const mockFetchBase = {
  syncLoadoutState: mockNoop, handleRefresh: mockNoop,
  handleStatsRefresh: mockNoop, handleSeasonChange: mockNoop,
};
let mockFetch = mockFetchBase;
const mockMotionBase = {
  activeTab: "loadout", setActiveTab: mockNoop, reduceMotionEnabled: false,
  profileNavContentMode: "profile", profilePagerRef: mockPagerRef,
  profileModeInteractionLockedRef: mockInteractionLockedRef,
  profileModeInteractionTimerRef: mockInteractionTimerRef, statsDashboardMounted: true,
  skinWhitespacePagerOriginRef: { current: 0 },
  pageModeProgress: mockProgress, heroModeProgress: mockProgress, rankSplitProgress: mockProgress,
  statsVisibilityProgress: mockProgress, statsTabProgress: mockProgress,
  profileExpandedHeroHeight: mockProgress, isPlayerInfoMode: false, profileModeTransitioning: false,
  rankSplitContentMode: "profile", handleSegmentContainerLayout: mockNoop, handlePagerScroll: mockNoop,
  handleRegionPress: mockNoop, toggleHeroMode: mockNoop, handleStatsDashboardTabChange: mockNoop,
  segmentIndicatorAnimatedStyle: mockStyle, profileSegmentLayerAnimatedStyle: mockStyle,
  statsSegmentLayerAnimatedStyle: mockStyle, loadoutSegmentLabelAnimatedStyle: mockStyle,
  skinsSegmentLabelAnimatedStyle: mockStyle, collectionSegmentLabelAnimatedStyle: mockStyle,
  legacyContentAnimatedStyle: mockStyle, statsDashboardLayerAnimatedStyle: mockStyle,
  profileSegmentPositionAnimatedStyle: mockStyle, profileHeaderTitleAnimatedStyle: mockStyle,
  profileBalancePillAnimatedStyle: mockStyle,
};
let mockMotion = mockMotionBase;
const mockSessionBase = {
  user: mockUser, setUser: mockSetUser, insets: { bottom: 24 }, colors: mockEmptyRecord, viewportWidth: 360,
  t: mockTranslateEn, hasAuth: true, authKey: "retained-account", dashboardMatches: mockEmptyList,
  dashboardSeasonStats: null as SeasonPerformanceStats | null,
  dashboardSeasonStatsById: mockEmptyRecord as ReturnType<typeof useProfileSession>["dashboardSeasonStatsById"],
  dashboardSeasonMatchesById: mockEmptyRecord as ReturnType<typeof useProfileSession>["dashboardSeasonMatchesById"],
  dashboardSeasonOptions: mockEmptyList as ReturnType<typeof useProfileSession>["dashboardSeasonOptions"],
  cachedLoadoutSnapshot: null, cachedProfile: null, cachedCompetitiveRank: null, isProfileDemo: false,
  matchHistoryLoading: false, seasonStatsLoading: false, fetchMatches: mockNoop,
  fetchSeasonStats: mockNoop, setProfileCache: mockNoop,
};
let mockSession = mockSessionBase;
const mockPalette = { accent: "red", card: "white", cardBorder: "gray", textPrimary: "black", textSecondary: "gray" };
const mockPickerOptions = {
  buildOwnedSkinOptions: mockNoop, buildOwnedSprayOptions: mockNoop, buildOwnedExpressionOptions: mockNoop,
};
const mockMutationsBase = {
  handleEquipIdentity: mockNoop, handleEquipWeapon: mockNoop, handleEquipCollectionSkin: mockNoop,
  handleEquipSpray: mockNoop, handleEquipExpression: mockNoop,
};
let mockMutations = mockMutationsBase;
const mockPager = {
  skinWhitespacePagerPanResponder: { panHandlers: {} }, handleTabChange: mockNoop,
  setPagerGestureEnabled: mockNoop, collapsibleBodyAnimatedStyle: mockStyle,
  profileContentPanGesture: mockEmptyRecord, handleProfileContentScroll: mockNoop,
  handleHeaderLayout: mockNoop, collapsibleHeaderAnimatedStyle: mockStyle,
  collapsibleHeaderHeight: 0, profileHeaderPanGesture: mockEmptyRecord, handlePagerMomentumEnd: mockNoop,
};

function MockHero(props: Record<string, unknown>) {
  mockRenderCounts.hero += 1;
  return React.createElement("HeroCard", props);
}
function MockSkin(props: Record<string, unknown>) {
  mockRenderCounts.skin += 1;
  return React.createElement("SkinCard", props);
}
function MockDashboard(props: Record<string, unknown>) {
  mockRenderCounts.dashboard += 1;
  return React.createElement("PlayerInfoView", props);
}

jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("react-native-gesture-handler", () => ({ GestureDetector: "GestureDetector" }));
jest.mock("react-native-reanimated", () => {
  const Native = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: { View: Native.View, Text: Native.Text, ScrollView: Native.ScrollView, FlatList: Native.FlatList }, useDerivedValue: (factory: () => number) => ({ get value() { return factory(); } }) };
});
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 360, height: 800, fontScale: 1, scale: 1 }) }));
jest.mock("~/components/ui/refractive-glass", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return {
    RefractiveGlassViewport: ({ children, enabled: _enabled, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement(Native.View, props, children),
    GlassClip: ({ children, height: _height, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement(Native.View, props, children),
    GlassFlatList: Native.FlatList,
    GlassScrollView: ReactModule.forwardRef((props: Record<string, unknown>, ref: React.Ref<import("react-native").ScrollView>) => ReactModule.createElement(Native.ScrollView, { ...props, ref })),
  };
});
jest.mock("react-native-paper", () => ({ ActivityIndicator: "ActivityIndicator", Searchbar: "Searchbar" }));
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({ __esModule: true, default: "Searchbar" }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/PaperIcon", () => ({ PaperClearIcon: "ClearIcon", PaperSearchIcon: "SearchIcon" }));
jest.mock("~/components/profile/PlayerInfoView", () => ({ __esModule: true, default: MockDashboard }));
jest.mock("~/components/profile/CollectionCheckerExport", () => ({ CollectionCheckerExport: "CollectionCheckerExport", CollectionCheckerExportProvider: "ExportProvider" }));
jest.mock("~/features/profile/CompactProfileSkinCard", () => ({ CompactProfileSkinCard: MockSkin }));
jest.mock("~/features/profile/ProfileSegmentedControl", () => ({ ProfileSegmentedControl: "SegmentedControl" }));
jest.mock("~/features/profile/ProfileHeroCard", () => ({ ProfileHeroCard: MockHero }));
jest.mock("~/features/profile/ProfileEquipmentSections", () => ({ ProfileExpressionSection: "ExpressionSection", ProfileIdentitySection: "IdentitySection" }));
jest.mock("~/features/profile/useProfileCollapsibleHeader", () => ({ PROFILE_STICKY_SEGMENT_HEIGHT: 48 }));
jest.mock("~/features/profile/ProfilePickerModal", () => ({ ProfilePickerModal: (props: { pickerState: PickerState | null }) => {
  const ReactModule = require("react") as typeof React;
  ReactModule.useLayoutEffect(() => {
    mockPickerCommits.push({ focused: mockFocused, presented: props.pickerState, stored: mockState.pickerState });
  });
  return props.pickerState ? ReactModule.createElement("PickerModal", { testID: "profile-native-picker" }) : null;
} }));
jest.mock("~/features/profile/useProfileSession", () => ({ useProfileSession: () => {
  const ReactModule = require("react") as typeof React;
  ReactModule.useEffect(() => { mockRootEffects(mockFocused); });
  // Match the real auth-mismatch fallback: only these empty outputs are fresh.
  return mockFreshSeasonFallback ? {
    ...mockSession, dashboardSeasonStatsById: {}, dashboardSeasonMatchesById: {}, dashboardSeasonOptions: [],
  } : mockSession;
} }));
jest.mock("~/features/profile/useProfileState", () => ({ useProfileState: (props: Parameters<typeof useProfileState>[0]) => {
  const ReactModule = require("react") as typeof React;
  const actual = jest.requireActual("~/features/profile/useProfileState") as { useProfileState: typeof useProfileState };
  mockState = actual.useProfileState(props);
  ReactModule.useEffect(() => () => mockUnmount(), []);
  return mockState;
} }));
jest.mock("~/features/profile/useProfileMotion", () => ({ useProfileMotion: () => mockMotion }));
jest.mock("~/features/profile/useProfileHeroData", () => ({ useProfileHeroData: (props: Parameters<typeof useProfileHeroData>[0]) => {
  const ReactModule = require("react") as typeof React;
  return ReactModule.useMemo(() => ({
    palette: mockPalette, regionLabel: props.user.region.toUpperCase(),
    profileStats: [{ key: "vp", label: props.t("vp"), value: props.user.balances.vp }],
    actRankSummaryStats: mockEmptyRecord,
    tabItems: [{ key: "loadout", label: props.t("equip_page.title") }],
    formatCategoryLabel: (category: string) => props.t(category),
  }), [props.t, props.user.region, props.user.balances.vp]);
} }));
jest.mock("~/features/profile/useProfileFetch", () => ({ useProfileFetch: () => mockFetch }));
jest.mock("~/features/profile/useProfileLoadoutData", () => ({ useProfileLoadoutData: (props: Parameters<typeof useProfileLoadoutData>[0]) => {
  const ReactModule = require("react") as typeof React;
  return ReactModule.useMemo(() => {
    const weapon = props.rawGuns[0] ? { ...mockWeapon, skinId: props.rawGuns[0].SkinID } : mockWeapon;
    return {
      loadoutDetails: [weapon], loadoutSorted: [weapon], loadoutByCategory: { rifles: [weapon] },
      orderedLoadoutCategories: ["rifles"], sprayDetails: mockEmptyList, expressionDetails: mockEmptyList,
      identityDetails: null, collectionCheckerProfile: { name: props.user.name },
      ownedSkinIdSet: new Set(props.ownedSkinItemIds), ownedSprayIdSet: mockEmptySet, ownedFlexIdSet: mockEmptySet,
      ownedPlayerCardOptions: mockEmptyList, ownedPlayerTitleOptions: mockEmptyList,
      equippedExpressionIdSet: mockEmptySet, skinWeaponMetadata: mockEmptyMap,
    };
  }, [props.rawGuns, props.ownedSkinItemIds, props.user.name, props.t]);
} }));
jest.mock("~/features/profile/useProfilePickerOptions", () => ({ useProfilePickerOptions: () => mockPickerOptions }));
jest.mock("~/features/profile/useProfileCollection", () => ({ useProfileCollection: (props: Parameters<typeof useProfileCollection>[0]) => {
  const ReactModule = require("react") as typeof React;
  return ReactModule.useMemo(() => {
    const ownedCollection = [...props.ownedSkinIdSet].map((id) => ({ ...mockWeapon, skinId: id, collectionId: id }));
    const filtered = ownedCollection.filter((item) => item.skinId.includes(props.searchQuery));
    return {
      ownedCollection, collectionWeaponTabs: ["all", "Vandal"],
      profileListRowsByTab: {
        loadout: [{ key: "loadout-rifles", kind: "skin-category", category: "rifles" }],
        skins: [{ key: "skins-rifles", kind: "skin-category", category: "rifles" }],
        collection: [{ key: "collection-1", kind: "collection-row", items: filtered }],
      },
    };
  }, [props.ownedSkinIdSet, props.searchQuery, props.collectionWeaponFilter, props.loading, props.error, props.t, props.orderedLoadoutCategories]);
} }));
jest.mock("~/features/profile/useProfilePickers", () => ({ useProfilePickers: (props: Parameters<typeof useProfilePickers>[0]) => {
  const ReactModule = require("react") as typeof React;
  const actual = jest.requireActual("~/features/profile/useProfilePickers") as { useProfilePickers: typeof useProfilePickers };
  const controls = actual.useProfilePickers(props);
  const handleDismissPicker = ReactModule.useCallback(() => { mockDismiss(); controls.handleDismissPicker(); }, [controls.handleDismissPicker]);
  return { ...controls, handleDismissPicker };
} }));
jest.mock("~/features/profile/useProfilePager", () => ({ useProfilePager: () => mockPager }));
jest.mock("~/features/profile/useProfileMutations", () => ({ useProfileMutations: () => mockMutations }));
jest.mock("~/mocks/profile-ui", () => ({ PROFILE_DEMO_RANK: null }));

const picker: PickerState = { type: "expression", mode: "flex", expression: { id: "slot-4", name: "Flex", kind: "flex", slotIndex: 3 }, options: [] };

beforeEach(() => {
  mockFreshSeasonFallback = false;
  mockSession = mockSessionBase;
  mockMotion = mockMotionBase;
  mockFetch = mockFetchBase;
  mockMutations = mockMutationsBase;
  mockRenderCounts.hero = 0;
  mockRenderCounts.skin = 0;
  mockRenderCounts.dashboard = 0;
});

describe("retained Profile picker focus lifetime", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    mockFocused = true;
    mockPickerCommits.splice(0);
    jest.clearAllMocks();
    act(() => { renderer = TestRenderer.create(<Profile />); });
    act(() => mockState.setPickerState(picker));
  });
  afterEach(() => { act(() => renderer?.unmount()); });

  it("hides the native picker in the blur commit before dismissing its stored state", () => {
    expect(renderer.root.findByType(ProfilePickerModal).props.pickerState).toBe(picker);
    mockFocused = false;
    act(() => renderer.update(<Profile />));
    const firstBlurCommit = mockPickerCommits.find((commit) => !commit.focused);
    expect(firstBlurCommit).toEqual({ focused: false, presented: null, stored: picker });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockState.pickerState).toBeNull();
    expect(renderer.root.findAllByProps({ testID: "profile-native-picker" })).toHaveLength(0);
  });

  it("does not dismiss or clear the picker while Profile remains focused", () => {
    act(() => renderer.update(<Profile />));
    act(() => mockState.setIdentityPickerQuery("keep query"));
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockState.pickerState).toBe(picker);
    expect(mockState.identityPickerQuery).toBe("keep query");
    expect(renderer.root.findAllByProps({ testID: "profile-native-picker" })).toHaveLength(1);
  });

  it("does not reopen the dismissed picker when focus returns and permits a fresh selection", () => {
    mockFocused = false;
    act(() => renderer.update(<Profile />));
    act(() => renderer.update(<Profile />));
    mockFocused = true;
    act(() => renderer.update(<Profile />));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockState.pickerState).toBeNull();
    expect(renderer.root.findAllByProps({ testID: "profile-native-picker" })).toHaveLength(0);
    act(() => mockState.setPickerState(picker));
    expect(renderer.root.findAllByProps({ testID: "profile-native-picker" })).toHaveLength(1);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("retains account, collection, pager and queued loadout work while canceling only picker preparation", () => {
    const initialFetchCancel = jest.fn();
    const pickerCancel = jest.fn();
    const pager = renderer.root.findByType(ScrollView);
    act(() => {
      mockState.setSearchQuery("retained collection filter");
      mockState.setOwnedSkinItemIds(["owned-skin", "second-skin"]);
      mockState.setUpdatingLoadout(true);
    });
    mockState.pickerTaskRef.current = { cancel: pickerCancel };
    mockState.initialFetchTaskRef.current = { cancel: initialFetchCancel };
    mockState.fetchLoadoutInFlightRef.current = true;
    mockState.loadoutMutationVersionRef.current = 7;
    const pendingWork = mockState.pendingLoadoutRef;
    const sessionUser = mockState.sessionUserRef.current;
    mockFocused = false;
    act(() => renderer.update(<Profile />));
    mockFocused = true;
    act(() => renderer.update(<Profile />));
    expect(mockState.searchQuery).toBe("retained collection filter");
    expect(mockState.ownedSkinItemIds).toEqual(["owned-skin", "second-skin"]);
    expect(mockState.sessionUserRef.current).toBe(sessionUser);
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(renderer.root.findByType(ScrollView)).toBe(pager);
    expect(mockPagerRef.current.scrollTo).not.toHaveBeenCalled();
    expect(mockState.pendingLoadoutRef).toBe(pendingWork);
    expect(mockState.fetchLoadoutInFlightRef.current).toBe(true);
    expect(mockState.loadoutMutationVersionRef.current).toBe(7);
    expect(mockState.updatingLoadout).toBe(true);
    expect(initialFetchCancel).not.toHaveBeenCalled();
    expect(pickerCancel).toHaveBeenCalledTimes(1);
    expect(mockUnmount).not.toHaveBeenCalled();
  });
});

describe("Profile presentation focus isolation", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    mockFocused = true;
    mockPickerCommits.splice(0);
    jest.clearAllMocks();
    act(() => { renderer = TestRenderer.create(<Profile />); });
    act(() => mockState.setLoading(false));
  });
  afterEach(() => { act(() => renderer?.unmount()); });

  it.each([
    { label: "stable session outputs", fallback: false },
    { label: "fresh empty auth-mismatch maps/options", fallback: true },
  ])("skips header, skin-list and dashboard renders across unchanged blur/focus with $label while root effects run", ({ fallback }) => {
    mockFreshSeasonFallback = fallback;
    if (fallback) act(() => renderer.update(<Profile />));
    const before = { ...mockRenderCounts };
    Object.values(before).forEach((count) => expect(count).toBeGreaterThan(0));
    const commitsBefore = mockRootEffects.mock.calls.length;
    mockFocused = false;
    act(() => renderer.update(<Profile />));
    const afterBlur = { ...mockRenderCounts };
    mockFocused = true;
    act(() => renderer.update(<Profile />));
    expect(mockRootEffects.mock.calls.slice(commitsBefore).map(([focused]) => focused)).toEqual([false, true]);
    expect(mockUnmount).not.toHaveBeenCalled();
    // Report both phases in the RED failure so each expensive surface is observable.
    expect({ before, afterBlur, afterFocus: { ...mockRenderCounts } }).toEqual({
      before, afterBlur: before, afterFocus: before,
    });
  });

  it("passes nonempty account/season maps and options through by reference and updates their replacements", () => {
    const stats: SeasonPerformanceStats = {
      calculationVersion: 6, seasonId: "first-act", seasonName: "First Act", matchCount: 1,
      wins: 1, losses: 0, kills: 20, deaths: 10, score: 4000, damage: 3000, roundsPlayed: 20,
      kastRounds: 15, kastRoundsPlayed: 20, headshots: 10, bodyshots: 20, legshots: 0,
      headshotPercent: 33.3, kd: 2, acs: 200, adr: 150, kast: 75, winRate: 100, updatedAt: 1,
    };
    mockSession = {
      ...mockSession, authKey: "first-account", dashboardSeasonStats: stats,
      dashboardSeasonStatsById: { "first-act": stats }, dashboardSeasonMatchesById: { "first-act": [] },
      dashboardSeasonOptions: [{ id: "first-act", name: "First Act", isActive: true, startTime: "2026-09-01T00:00:00Z" }],
    };
    act(() => renderer.update(<Profile />));
    const expectCurrentSeason = () => {
      const dashboard = renderer.root.findByType(MockDashboard);
      expect(dashboard.props.seasonStats).toBe(mockSession.dashboardSeasonStats);
      expect(dashboard.props.seasonStatsById).toBe(mockSession.dashboardSeasonStatsById);
      expect(dashboard.props.seasonMatchesById).toBe(mockSession.dashboardSeasonMatchesById);
      expect(dashboard.props.seasonOptions).toBe(mockSession.dashboardSeasonOptions);
    };
    expectCurrentSeason();
    const nextStats = { ...stats, seasonId: "next-act", seasonName: "Next Act", updatedAt: 2 };
    mockSession = {
      ...mockSession, authKey: "next-account", dashboardSeasonStats: nextStats,
      dashboardSeasonStatsById: { "next-act": nextStats }, dashboardSeasonMatchesById: { "next-act": [] },
      dashboardSeasonOptions: [{ id: "next-act", name: "Next Act", isActive: true, startTime: "2026-10-01T00:00:00Z" }],
    };
    act(() => renderer.update(<Profile />));
    expectCurrentSeason();
  });

  it("renders the current account, balances and locale after session changes", () => {
    const before = mockRenderCounts.hero;
    mockSession = { ...mockSession, user: {
      ...mockUser, id: "next-account", name: "Next Profile", TagLine: "NEXT",
      balances: { ...mockUser.balances, vp: 900 }, progress: { ...mockUser.progress, level: 42 },
    }, authKey: "next-account", t: mockTranslateVi };
    act(() => renderer.update(<Profile />));
    const hero = renderer.root.findByType(MockHero);
    expect(hero.props).toMatchObject({ name: "Next Profile", tagLine: "NEXT", accountLevel: 42 });
    expect(hero.props.profileStats).toEqual([{ key: "vp", label: "vi:vp", value: 900 }]);
    expect(mockState.sessionUserRef.current.id).toBe("next-account");
    expect(renderer.root.findAllByType(Text).some((text) => text.props.children === "vi:rifles")).toBe(true);
    expect(mockRenderCounts.hero).toBeGreaterThan(before);
    expect(renderer.root.findByType(MockDashboard).props.matches).toBe(mockSession.dashboardMatches);
  });

  it("forwards changed callbacks even when every data prop stays equal", () => {
    const toggle = jest.fn();
    const refresh = jest.fn();
    const season = jest.fn();
    const equip = jest.fn();
    const before = { ...mockRenderCounts };
    mockMotion = { ...mockMotion, toggleHeroMode: toggle };
    mockFetch = { ...mockFetch, handleStatsRefresh: refresh, handleSeasonChange: season };
    mockMutations = { ...mockMutations, handleEquipCollectionSkin: equip };
    act(() => renderer.update(<Profile />));
    const dashboard = renderer.root.findByType(MockDashboard);
    const collectionCard = renderer.root.findAllByType(MockSkin).find((card) => card.props.weapon.collectionId)!;
    act(() => {
      renderer.root.findByType(MockHero).props.onToggleMode();
      dashboard.props.onRefresh("selected-act");
      dashboard.props.onSeasonChange("older-act");
      collectionCard.props.onPress();
    });
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("selected-act");
    expect(season).toHaveBeenCalledWith("older-act");
    expect(equip).toHaveBeenCalledWith(collectionCard.props.weapon);
    expect(mockRenderCounts.hero).toBeGreaterThan(before.hero);
    expect(mockRenderCounts.dashboard).toBeGreaterThan(before.dashboard);
    expect(mockRenderCounts.skin).toBeGreaterThan(before.skin);
  });

  it("updates native refresh controls, export availability and dashboard refreshing", () => {
    const refresh = jest.fn();
    mockFetch = { ...mockFetch, handleRefresh: refresh };
    act(() => renderer.update(<Profile />));
    act(() => { mockState.setRefreshing(true); mockState.setStatsRefreshing(true); });
    const lists = renderer.root.findAllByType(FlatList).filter((list) => !list.props.horizontal);
    expect(lists).toHaveLength(3);
    lists.forEach((list) => expect(list.props.refreshControl.props.refreshing).toBe(true));
    act(() => lists[0].props.refreshControl.props.onRefresh());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType(MockDashboard).props.refreshing).toBe(true);
    expect(renderer.root.findByType(CollectionCheckerExportProvider).props.disabled).toBe(true);
    act(() => { mockState.setRefreshing(false); mockState.setStatsRefreshing(false); });
    expect(renderer.root.findByType(MockDashboard).props.refreshing).toBe(false);
    expect(renderer.root.findByType(CollectionCheckerExportProvider).props.disabled).toBe(false);
  });

  it("updates owned collection rows, filtering and equipped skin selection", () => {
    act(() => mockState.setOwnedSkinItemIds(["owned-skin", "second-skin"]));
    const collectionSkins = () => renderer.root.findAllByType(MockSkin)
      .filter((card) => card.props.weapon.collectionId).map((card) => card.props.weapon.skinId);
    expect(collectionSkins()).toEqual(["owned-skin", "second-skin"]);
    expect(renderer.root.findByType(CollectionCheckerExportProvider).props.items).toHaveLength(2);
    act(() => mockState.setSearchQuery("second"));
    expect(collectionSkins()).toEqual(["second-skin"]);
    act(() => mockState.setRawGuns([{ ID: "vandal", SkinID: "second-skin", SkinLevelID: "level-2", ChromaID: "chroma-2" }]));
    const equipped = renderer.root.findAllByType(MockSkin).filter((card) => !card.props.weapon.collectionId);
    expect(equipped.length).toBeGreaterThan(0);
    equipped.forEach((card) => expect(card.props.weapon.skinId).toBe("second-skin"));
  });

  it("prioritizes collection thumbnails only when their retained page is selected without changing its geometry", () => {
    const collectionCards = () => renderer.root.findAllByType(MockSkin).filter(card => card.props.weapon.collectionId);
    const widths = collectionCards().map(card => card.props.width);
    expect(collectionCards().every(card => card.props.imagePriority === "low")).toBe(true);
    mockMotion = { ...mockMotion, activeTab: "collection" };
    act(() => renderer.update(<Profile />));
    expect(collectionCards().every(card => card.props.imagePriority === "high")).toBe(true);
    expect(collectionCards().map(card => card.props.width)).toEqual(widths);
    expect(renderer.root.findAllByType(MockSkin).filter(card => !card.props.weapon.collectionId)
      .every(card => card.props.imagePriority === undefined)).toBe(true);
    mockMotion = { ...mockMotion, activeTab: "loadout" };
    act(() => renderer.update(<Profile />));
    expect(collectionCards().every(card => card.props.imagePriority === "low")).toBe(true);
  });
});
