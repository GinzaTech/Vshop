import React from "react";
import {
  AppState,
  TextInput,
  TouchableOpacity,
  type AppStateStatus,
} from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import CombatScreen, {
  PartyChatPanel,
} from "~/app/(authenticated)/combat";
import FriendsScreen from "~/app/(authenticated)/friends";
import SettingsScreen from "~/app/(authenticated)/settings";
import ChatScreen from "~/app/chat/[friendId]";
import CombatSessionScreen from "~/features/combat/CombatSessionScreen";

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockTranslate = (key: string) => key;
let mockNavigationOptions: {
  headerRight?: () => React.ReactElement;
} = {};
const mockNavigation = {
  setOptions: jest.fn((options: typeof mockNavigationOptions) => {
    mockNavigationOptions = options;
  }),
};

const mockFetchSession = jest.fn();
const mockMatchDetails = jest.fn();
const mockCompetitive = jest.fn();
const mockContent = jest.fn();
const mockMMR = jest.fn();
let mockCombatStoreLoading = false;
let mockCombatSnapshot = createCombatSessionSnapshot();

let mockUser = createUser();
const mockResetUser = jest.fn();
const mockRemoveAccount = jest.fn();
const mockTogglePartyReadyState = jest.fn();
const mockLoadSessionSnapshot = jest.fn();
let mockCombatHookState = createCombatHookState(false);

const mockChatActions = {
  addPartyMessage: jest.fn(),
  setCurrentPartyId: jest.fn(),
  setPartyChatRoom: jest.fn(),
};
let mockChatState = createChatState("chat");

const mockRefreshFriendsRoster = jest.fn();
const mockInitChatService = jest.fn();
const mockRequestChatHistory = jest.fn();
const mockSendChatMessage = jest.fn();
const mockJoinPartyXmppChat = jest.fn();
const mockWatchOwnPartyPresence = jest.fn();

const mockReducedAnimation = {
  duration: () => mockReducedAnimation,
  reduceMotion: () => mockReducedAnimation,
};

jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const ReactRuntime = require("react") as typeof React;
  const MockFlatList = ReactRuntime.forwardRef<
    { scrollToEnd: () => void },
    {
      ListEmptyComponent?: React.ReactElement | React.ComponentType;
      data?: readonly unknown[];
      keyExtractor?: (item: unknown, index: number) => string;
      renderItem?: (info: { item: unknown; index: number }) => React.ReactElement;
    }
  >(({ ListEmptyComponent, data = [], keyExtractor, renderItem, ...props }, ref) => {
    ReactRuntime.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
    const children = data.length
      ? data.map((item, index) => (
          <ReactRuntime.Fragment key={keyExtractor?.(item, index) ?? index}>
            {renderItem?.({ index, item })}
          </ReactRuntime.Fragment>
        ))
      : ReactRuntime.isValidElement(ListEmptyComponent)
        ? ListEmptyComponent
        : ListEmptyComponent
          ? ReactRuntime.createElement(ListEmptyComponent)
          : null;

    return ReactRuntime.createElement("FlatList", props, children);
  });

  return { __esModule: true, default: MockFlatList };
});

jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("expo-router", () => ({
  router: mockRouter,
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const ReactRuntime = jest.requireActual<typeof import("react")>("react");
    ReactRuntime.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => ({ friendId: "friend-1" }),
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));
jest.mock("react-native-reanimated", () => {
  const ReactRuntime = require("react") as typeof React;

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: React.PropsWithChildren) =>
        ReactRuntime.createElement("AnimatedView", props, children),
    },
    FadeInDown: mockReducedAnimation,
    FadeOut: mockReducedAnimation,
    ReduceMotion: { System: "system" },
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("react-native-paper", () => {
  const { Text } = require("react-native") as typeof import("react-native");

  return {
    ActivityIndicator: "PaperActivityIndicator",
    Switch: "Switch",
    Text,
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
}));

jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/GalleryAgent", () => ({ AgentGrid: "AgentGrid" }));
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/components/ui/GlassCard", () => "GlassCard");
jest.mock("~/components/ui/InfoPill", () => "InfoPill");
jest.mock("~/components/ui/ValorantButton", () => "ValorantButton");
jest.mock("~/components/BatteryOptimizationWarning", () => () => null);
jest.mock("~/components/popups/UpdatePopup", () => () => null);

jest.mock("~/hooks/useAsyncRefresh", () => ({
  useAsyncRefresh: (task: () => Promise<unknown>) => {
    const ReactRuntime = jest.requireActual<typeof import("react")>("react");
    const [refreshing, setRefreshing] = ReactRuntime.useState(false);
    const onRefresh = ReactRuntime.useCallback(async () => {
      setRefreshing(true);
      try {
        return await task();
      } finally {
        setRefreshing(false);
      }
    }, [task]);

    return { onRefresh, refreshing };
  },
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(
    (selector: (state: { resetUser: typeof mockResetUser; user: typeof mockUser }) => unknown) =>
      selector({ resetUser: mockResetUser, user: mockUser }),
    { getState: () => ({ resetUser: mockResetUser, user: mockUser }) },
  ),
}));
jest.mock("~/hooks/useCombatStore", () => ({
  useCombatStore: (
    selector: (state: {
      fetchSession: typeof mockFetchSession;
      loading: boolean;
      sessionKey: string;
      snapshot: typeof mockCombatSnapshot;
    }) => unknown,
  ) =>
    selector({
      fetchSession: mockFetchSession,
      loading: mockCombatStoreLoading,
      sessionKey: "ap|user-one",
      snapshot: mockCombatSnapshot,
    }),
}));
jest.mock("~/hooks/useAccountStore", () => ({
  useAccountStore: (selector: (state: {
    accounts: ReturnType<typeof mockCreateSavedAccounts>;
    removeAccount: typeof mockRemoveAccount;
  }) => unknown) =>
    selector({
      accounts: mockCreateSavedAccounts(),
      removeAccount: mockRemoveAccount,
    }),
}));
jest.mock("~/hooks/useFeatureStore", () => ({
  useFeatureStore: (selector: (state: {
    screenshotModeEnabled: boolean;
    toggleScreenshotMode: jest.Mock;
  }) => unknown) =>
    selector({ screenshotModeEnabled: false, toggleScreenshotMode: jest.fn() }),
}));
jest.mock("~/hooks/useWishlistStore", () => ({
  useWishlistStore: (selector: (state: {
    notificationEnabled: boolean;
    setNotificationEnabled: jest.Mock;
  }) => unknown) =>
    selector({ notificationEnabled: false, setNotificationEnabled: jest.fn() }),
}));
jest.mock("~/components/Combat", () => ({
  __esModule: true,
  default: () => mockCombatHookState,
}));

jest.mock("~/utils/chat-store", () => {
  const useChatStore = Object.assign(
    (selector: (state: typeof mockChatState) => unknown) =>
      selector(mockChatState),
    {
      getState: () => ({ ...mockChatState, ...mockChatActions }),
    },
  );

  return {
    EMPTY_CHAT_MESSAGES: [],
    useChatStore,
  };
});
jest.mock("~/utils/chat-service", () => ({
  initChatService: (...args: unknown[]) => mockInitChatService(...args),
  joinPartyXmppChat: (...args: unknown[]) => mockJoinPartyXmppChat(...args),
  refreshFriendsRoster: (...args: unknown[]) => mockRefreshFriendsRoster(...args),
  requestChatHistory: (...args: unknown[]) => mockRequestChatHistory(...args),
  sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
  sendPartyXmppMessage: jest.fn(),
  watchOwnPartyPresence: (...args: unknown[]) => mockWatchOwnPartyPresence(...args),
}));
jest.mock("~/utils/riot-local-chat", () => ({
  getChatHistory: jest.fn().mockResolvedValue([]),
  getPartyChatInfo: jest.fn().mockResolvedValue(null),
  sendPartyChatMessage: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/utils/valorant-assets", () => ({
  getAgent: () => ({ agents: [] }),
  getAssets: () => ({ competitiveTiers: [], maps: [] }),
}));
jest.mock("~/utils/valorant-api", () => ({
  disablePartyInviteCode: jest.fn(),
  generatePartyInviteCode: jest.fn(),
  getCompetitiveMMR: (...args: unknown[]) => mockMMR(...args),
  getContent: (...args: unknown[]) => mockContent(...args),
  joinPartyByCode: jest.fn(),
  matchDetails: (...args: unknown[]) => mockMatchDetails(...args),
  removeFromParty: jest.fn(),
}));
jest.mock("~/features/combat/session-insights", () => ({
  ...jest.requireActual("~/features/combat/session-insights"),
  fetchCompetitivePerformanceBatch: (...args: unknown[]) =>
    mockCompetitive(...args),
}));
jest.mock("~/utils/screen-orientation", () => ({
  lockScreenOrientation: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/utils/log-redaction", () => ({
  sanitizeErrorForLog: () => ({ message: "redacted" }),
}));
jest.mock("~/utils/app-sync", () => ({ fullBackgroundSync: jest.fn() }));
jest.mock("~/utils/wishlist", () => ({
  initBackgroundFetch: jest.fn(),
  stopBackgroundFetch: jest.fn(),
}));
jest.mock("~/utils/app-update", () => ({
  applyOtaUpdate: jest.fn(),
  checkForAppUpdate: jest.fn(),
}));
jest.mock("~/utils/auth-session", () => ({
  hasReusableAccessToken: () => true,
}));
jest.mock("~/services/accounts/session", () => ({
  prepareInteractiveAuthentication: jest.fn(),
  signOutRiotAccount: jest.fn(),
  switchSavedAccount: jest.fn(),
}));

function createUser() {
  return {
    TagLine: "NA1",
    accessToken: "access-token",
    balances: { fag: 0, kc: 0, rad: 0, vp: 0 },
    entitlementsToken: "entitlements-token",
    id: "user-one",
    idToken: "id-token",
    name: "Agent",
    ownedSkinIds: [],
    progress: { level: 1, xp: 0 },
    region: "ap",
    shops: {
      accessory: [],
      bundles: [],
      main: [],
      nightMarket: [],
      remainingSecs: { accessory: 0, bundles: [0], main: 0, nightMarket: 0 },
    },
  };
}

function mockCreateSavedAccounts() {
  return [
    {
      accessToken: "access-token",
      entitlementsToken: "entitlements-token",
      id: "user-one",
      idToken: "id-token",
      lastUsedAt: 1,
      name: "Agent",
      region: "ap",
      tagLine: "NA1",
    },
  ];
}

function createCombatSessionSnapshot() {
  return {
    currentGameMatch: null,
    matchId: null,
    namesBySubject: {},
    pregameMatch: null,
    state: "idle" as const,
  };
}

function createCombatHookState(isReady: boolean) {
  return {
    currentPartyMember: { IsReady: isReady },
    filteredAgents: [],
    filterByRole: jest.fn(),
    handleAgentPress: jest.fn(),
    handleAgentSelect: jest.fn(),
    handleCancel: jest.fn(),
    loadSessionSnapshot: mockLoadSessionSnapshot,
    locking: false,
    selectedAgent: null,
    selectedRole: "All",
    sessionLoading: false,
    sessionSnapshot: {
      currentGameMatch: null,
      party: {
        CustomGameData: null,
        InviteCode: null,
        MUCName: null,
        Members: [{ Subject: "user-one" }],
      },
      partyId: "party-one",
      pregameMatch: null,
      state: "idle" as const,
    },
    togglePartyReadyState: mockTogglePartyReadyState,
  };
}

function createChatState(show: string) {
  return {
    currentPartyId: null,
    friends: {
      "friend-1": {
        gameName: "Friend",
        id: "friend-1",
        jid: "friend-1@chat",
        show,
        status: "",
        tagLine: "NA1",
      },
    },
    messages: { "friend-1": [] },
    partyChatRoom: null,
    partyMessages: {},
    status: "authenticated",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function expectDecorativeIcon(
  control: TestRenderer.ReactTestInstance,
  name: string,
) {
  const matchingIcons = control
    .findAllByType(MockAppIcon)
    .filter((icon) => icon.props.name === name);
  expect(matchingIcons).toHaveLength(1);
  const icon = matchingIcons[0];
  expect(icon.props).toMatchObject({ decorative: true, name });
  expect(icon.props.label).toBeUndefined();
  return icon;
}

describe("Combat semantic icon motion", () => {
  beforeEach(() => {
    mockCombatStoreLoading = false;
    mockCombatSnapshot = createCombatSessionSnapshot();
    mockCombatHookState = createCombatHookState(false);
    mockFetchSession.mockReset().mockResolvedValue(mockCombatSnapshot);
    mockMatchDetails.mockReset().mockResolvedValue(null);
    mockCompetitive.mockReset().mockResolvedValue({});
    mockContent.mockReset().mockResolvedValue({ Seasons: [] });
    mockMMR.mockReset().mockResolvedValue(null);
    mockLoadSessionSnapshot.mockReset().mockResolvedValue(mockCombatHookState.sessionSnapshot);
    mockTogglePartyReadyState.mockReset();
    mockJoinPartyXmppChat.mockReset().mockResolvedValue(undefined);
    mockWatchOwnPartyPresence.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active" satisfies AppStateStatus,
      writable: true,
    });
  });

  it("keeps the Combat Session refresh icon mounted from refresh to loading", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CombatSessionScreen />);
      await Promise.resolve();
    });

    const refreshControl = () =>
      renderer.root.findByProps({
        accessibilityLabel: "combat_page.actions.refresh",
      });
    const initialControl = refreshControl();
    expect(initialControl.props).toMatchObject({
      accessibilityRole: "button",
      accessibilityState: { busy: false, disabled: false },
    });
    const initialIcon = expectDecorativeIcon(initialControl, "refresh");

    mockCombatStoreLoading = true;
    await act(async () => {
      renderer.update(<CombatSessionScreen />);
    });

    const loadingControl = refreshControl();
    const loadingIcon = expectDecorativeIcon(loadingControl, "loading");
    expect(loadingControl).toBe(initialControl);
    expect(loadingIcon).toBe(initialIcon);
    expect(loadingControl.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });

    act(() => renderer.unmount());
  });

  it("keeps the party-chat refresh icon mounted while a fixture refresh is pending", async () => {
    const pending = deferred<{ partyId: null; party: null }>();
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <PartyChatPanel
          accessToken="access-token"
          currentUser={{ id: "user-one", name: "Agent", TagLine: "NA1" }}
          entitlementsToken="entitlements-token"
          onRefreshSession={() => pending.promise}
          partyId={null}
          region="ap"
          roomName={null}
        />,
      );
      await Promise.resolve();
    });

    const refreshControl = () =>
      renderer.root.findByProps({
        accessibilityLabel: "combat_page.chat.refresh",
      });
    const initialControl = refreshControl();
    const initialIcon = expectDecorativeIcon(initialControl, "refresh");
    let refreshPromise!: Promise<unknown>;

    await act(async () => {
      refreshPromise = initialControl.props.onPress();
      await Promise.resolve();
    });

    const loadingControl = refreshControl();
    const loadingIcon = expectDecorativeIcon(loadingControl, "loading");
    expect(loadingControl).toBe(initialControl);
    expect(loadingIcon).toBe(initialIcon);
    expect(loadingControl.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });

    await act(async () => {
      pending.resolve({ party: null, partyId: null });
      await refreshPromise;
    });
    act(() => renderer.unmount());
  });

  it("changes party ready to cancelReady without invoking the party mutation", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CombatScreen />);
      await Promise.resolve();
    });

    const readyControl = renderer.root.findByProps({
      accessibilityLabel: "combat_page.actions.ready",
    });
    expect(readyControl.props).toMatchObject({
      accessibilityRole: "button",
      accessibilityState: { busy: false, disabled: false },
    });
    const readyIcon = expectDecorativeIcon(readyControl, "ready");

    mockCombatHookState = createCombatHookState(true);
    await act(async () => {
      renderer.update(<CombatScreen />);
    });

    const cancelControl = renderer.root.findByProps({
      accessibilityLabel: "combat_page.actions.unready",
    });
    const cancelIcon = expectDecorativeIcon(cancelControl, "cancelReady");
    expect(cancelControl).toBe(readyControl);
    expect(cancelIcon).toBe(readyIcon);
    expect(mockTogglePartyReadyState).not.toHaveBeenCalled();

    act(() => renderer.unmount());
  });
});

describe("Friends semantic icon motion", () => {
  beforeEach(() => {
    mockChatState = createChatState("chat");
    mockNavigationOptions = {};
    mockNavigation.setOptions.mockClear();
    mockRefreshFriendsRoster.mockReset().mockResolvedValue(undefined);
  });

  it("keeps the header icon mounted from friendSearch to close", async () => {
    let screenRenderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      screenRenderer = TestRenderer.create(<FriendsScreen />);
      await Promise.resolve();
    });
    const initialHeaderRight = mockNavigationOptions.headerRight;
    if (!initialHeaderRight) throw new Error("Friends headerRight was not registered");

    let headerRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      headerRenderer = TestRenderer.create(initialHeaderRight());
    });
    const searchControl = headerRenderer.root.findByProps({
      testID: "friends-search-toggle",
    });
    const searchIcon = expectDecorativeIcon(searchControl, "friendSearch");

    act(() => searchControl.props.onPress());
    const updatedHeaderRight = mockNavigationOptions.headerRight;
    if (!updatedHeaderRight) throw new Error("Friends headerRight was not updated");
    act(() => headerRenderer.update(updatedHeaderRight()));

    const closeControl = headerRenderer.root.findByProps({
      testID: "friends-search-toggle",
    });
    const closeIcon = expectDecorativeIcon(closeControl, "close");
    expect(closeControl).toBe(searchControl);
    expect(closeIcon).toBe(searchIcon);
    expect(closeControl.props).toMatchObject({
      accessibilityLabel: "friends_page.close_search",
      accessibilityRole: "button",
    });

    act(() => {
      headerRenderer.unmount();
      screenRenderer.unmount();
    });
  });

  it("keeps a friend state icon mounted from connected to disconnected", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<FriendsScreen />);
      await Promise.resolve();
    });

    const connectedRow = renderer.root.findByProps({
      accessibilityLabel: "Friend#NA1, friends_page.in_menu",
    });
    const connectedIcon = expectDecorativeIcon(connectedRow, "connected");

    mockChatState = createChatState("offline");
    await act(async () => {
      renderer.update(<FriendsScreen />);
    });

    const disconnectedRow = renderer.root.findByProps({
      accessibilityLabel: "Friend#NA1, friends_page.offline",
    });
    const disconnectedIcon = expectDecorativeIcon(
      disconnectedRow,
      "disconnected",
    );
    expect(disconnectedRow).toBe(connectedRow);
    expect(disconnectedIcon).toBe(connectedIcon);

    act(() => renderer.unmount());
  });
});

describe("static social and Settings icons", () => {
  beforeEach(() => {
    mockUser = createUser();
    mockChatState = createChatState("chat");
    mockInitChatService.mockReset().mockResolvedValue(undefined);
    mockRequestChatHistory.mockReset().mockResolvedValue(undefined);
    mockSendChatMessage.mockReset();
  });

  it("keeps chatSend static while text enables the labelled parent control", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<ChatScreen />);
      await Promise.resolve();
    });

    const sendControl = () =>
      renderer.root.findByProps({ accessibilityLabel: "chat_page.send" });
    const initialControl = sendControl();
    expect(initialControl.props).toMatchObject({
      accessibilityRole: "button",
      accessibilityState: { disabled: true },
    });
    const initialIcon = expectDecorativeIcon(initialControl, "chatSend");
    const input = renderer.root.findByType(TextInput);

    act(() => input.props.onChangeText("hello"));

    const enabledControl = sendControl();
    const enabledIcon = expectDecorativeIcon(enabledControl, "chatSend");
    expect(enabledControl).toBe(initialControl);
    expect(enabledIcon).toBe(initialIcon);
    expect(enabledControl.props.accessibilityState).toEqual({ disabled: false });
    expect(mockSendChatMessage).not.toHaveBeenCalled();

    act(() => renderer.unmount());
  });

  it("keeps Settings row icons static while parent labels stay authoritative", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<SettingsScreen />);
    });

    const findLabelledControl = (label: string) =>
      renderer.root.find(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === label,
      );
    const languageControl = findLabelledControl("language");
    const aboutControl = findLabelledControl("credits");
    const accountControl = findLabelledControl(
      "settings_page.accounts.switch_to",
    );
    const deleteAccountControl = findLabelledControl("delete_account");
    const logoutAllControl = findLabelledControl(
      "settings_page.accounts.logout_all",
    );
    const languageIcon = expectDecorativeIcon(
      languageControl,
      "settingsLanguage",
    );
    const aboutIcon = expectDecorativeIcon(aboutControl, "settingsAbout");
    const accountIcon = expectDecorativeIcon(
      accountControl,
      "settingsAccount",
    );
    const deleteAccountIcon = expectDecorativeIcon(
      deleteAccountControl,
      "settingsDeleteAccount",
    );
    const logoutAllIcon = expectDecorativeIcon(
      logoutAllControl,
      "settingsLogoutAll",
    );
    expect(languageControl.props.accessibilityRole).toBe("button");
    expect(aboutControl.props.accessibilityRole).toBe("button");
    expect(deleteAccountControl.props.accessibilityRole).toBe("button");
    expect(logoutAllControl.props.accessibilityRole).toBe("button");
    expect(deleteAccountControl.props.onPress).toEqual(expect.any(Function));
    expect(logoutAllControl.props.onPress).toEqual(expect.any(Function));
    expect(deleteAccountIcon.props.name).not.toBe(logoutAllIcon.props.name);

    act(() => renderer.update(<SettingsScreen />));

    const updatedLanguageControl = findLabelledControl("language");
    const updatedAboutControl = findLabelledControl("credits");
    const updatedAccountControl = findLabelledControl(
      "settings_page.accounts.switch_to",
    );
    const updatedDeleteAccountControl = findLabelledControl("delete_account");
    const updatedLogoutAllControl = findLabelledControl(
      "settings_page.accounts.logout_all",
    );
    expect(updatedLanguageControl).toBe(languageControl);
    expect(updatedAboutControl).toBe(aboutControl);
    const updatedLanguageIcon = expectDecorativeIcon(
      updatedLanguageControl,
      "settingsLanguage",
    );
    const updatedAboutIcon = expectDecorativeIcon(
      updatedAboutControl,
      "settingsAbout",
    );
    const updatedAccountIcon = expectDecorativeIcon(
      updatedAccountControl,
      "settingsAccount",
    );
    const updatedDeleteAccountIcon = expectDecorativeIcon(
      updatedDeleteAccountControl,
      "settingsDeleteAccount",
    );
    const updatedLogoutAllIcon = expectDecorativeIcon(
      updatedLogoutAllControl,
      "settingsLogoutAll",
    );
    expect(updatedLanguageIcon).toBe(languageIcon);
    expect(updatedAboutIcon).toBe(aboutIcon);
    expect(updatedAccountIcon).toBe(accountIcon);
    expect(updatedDeleteAccountIcon).toBe(deleteAccountIcon);
    expect(updatedLogoutAllIcon).toBe(logoutAllIcon);

    act(() => renderer.unmount());
  });
});
