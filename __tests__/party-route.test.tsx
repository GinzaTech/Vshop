import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Combat from "~/app/(authenticated)/combat";
import type { PartyActions, PartyViewModel } from "~/features/party/party-types";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockCloseAgents = jest.fn();
const mockLock = jest.fn();
const mockSession = { id: "self", region: "ap", accessToken: "access", entitlementsToken: "ent" };
const mockUser = { ...mockSession, name: "Self", TagLine: "004", shops: { bundles: [] } };
const mockSnapshot = { state: "idle", matchId: null, partyId: "party", party: { ID: "party", Members: [] }, currentGameMatch: null, pregameMatch: null, namesBySubject: {} };
const mockModel: PartyViewModel = {
  partyId: "party", queueId: "unrated", queueLabel: "Unrated", queueOptions: [], privacy: "CLOSED", code: null,
  partyState: "DEFAULT", members: [], friends: [], friendConnectionStatus: "authenticated", isLeader: true,
  isQueueing: false, canStartQueue: false, canManage: true, canReady: true, canJoinParty: true,
};
const mockActions = {
  onRefresh: jest.fn(), onStartQueue: jest.fn(), onCancelQueue: jest.fn(), onLeave: jest.fn(), onReady: jest.fn(),
  onQueueChange: jest.fn(), onPrivacyChange: jest.fn(), onGenerateCode: jest.fn(), onCopyCode: jest.fn(), onInvite: jest.fn(),
  onShareCode: jest.fn().mockResolvedValue(undefined), onJoinCode: jest.fn(), onInviteByName: jest.fn(),
} satisfies Omit<PartyActions, "onClose" | "onAllFriends">;
const mockController = jest.fn((..._args: unknown[]) => ({ model: mockModel, refreshing: false, busyAction: null, errorMessage: null, actions: mockActions }));
const mockFlow = jest.fn((_input: { onEnterMatch: () => void }) => ({
  visible: true, selectedAgentId: "agent", locking: false, errorMessage: null,
  onSelect: jest.fn(), onLock: mockLock, onClose: mockCloseAgents, onOpen: jest.fn(),
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, push: mockPush }), useFocusEffect: () => undefined }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: <T,>(selector: (state: { user: typeof mockUser }) => T) => selector({ user: mockUser }) }));
jest.mock("~/hooks/useRiotScreenSession", () => ({ useRiotScreenSession: () => mockSession }));
jest.mock("~/features/combat/useCombatSnapshot", () => ({ useCombatSnapshot: () => mockSnapshot }));
jest.mock("~/features/combat/useCombatScreenActivity", () => ({ useCombatScreenActivity: () => ({ isActive: true, isActiveNow: () => true }) }));
jest.mock("~/features/party/usePartyController", () => ({ usePartyController: (...args: unknown[]) => mockController(...args) }));
jest.mock("~/features/party/usePregameAgentFlow", () => ({ usePregameAgentFlow: (input: { onEnterMatch: () => void }) => mockFlow(input) }));
jest.mock("~/features/party/PartyScreen", () => ({ __esModule: true, default: "PartyScreen" }));
jest.mock("~/features/party/AgentSelectModal", () => ({ __esModule: true, default: "AgentSelectModal" }));
jest.mock("~/features/party/PartyChatPanel", () => ({ PartyChatPanel: "PartyChatPanel" }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ maps: [] }), getAgent: () => ({ agents: [{ uuid: "agent", displayName: "Agent" }] }) }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("~/components/ui/GlassCard", () => ({ __esModule: true, default: "GlassCard" }));
jest.mock("~/components/ui/InfoPill", () => ({ __esModule: true, default: "InfoPill" }));
jest.mock("~/components/ui/ValorantButton", () => ({ __esModule: true, default: "ValorantButton" }));
jest.mock("react-native-reanimated", () => {
  const animation = { duration: () => animation, reduceMotion: () => animation };
  return { __esModule: true, default: { View: "AnimatedView" }, FadeInDown: animation, FadeOut: animation, ReduceMotion: { System: "system" } };
});
jest.mock("~/components/GalleryAgent", () => ({ AgentGrid: "OldAgentGrid" }));
jest.mock("~/components/Combat", () => ({ __esModule: true, default: () => ({
  filterByRole: jest.fn(), handleAgentPress: jest.fn(), handleAgentSelect: jest.fn(), handleCancel: jest.fn(),
  filteredAgents: [], selectedRole: null, selectedAgent: null, sessionSnapshot: mockSnapshot, sessionLoading: false,
  locking: false, currentPartyMember: null, togglePartyReadyState: jest.fn(), loadSessionSnapshot: jest.fn(),
}) }));
jest.mock("~/utils/valorant-api", () => ({ disablePartyInviteCode: jest.fn(), generatePartyInviteCode: jest.fn(), joinPartyByCode: jest.fn(), removeFromParty: jest.fn() }));
jest.mock("~/utils/chat-service", () => ({ joinPartyXmppChat: jest.fn(), sendPartyXmppMessage: jest.fn(), watchOwnPartyPresence: jest.fn(() => () => undefined) }));
jest.mock("~/utils/riot-local-chat", () => ({ getChatHistory: jest.fn(), getPartyChatInfo: jest.fn(), sendPartyChatMessage: jest.fn() }));

describe("Party route composition", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => act(() => renderer?.unmount()));
  function mount() { act(() => { renderer = TestRenderer.create(<Combat />); }); }

  it("shows the Party model and delegates agents exclusively to the popup", () => {
    mount();
    expect(renderer.root.find((node) => String(node.type) === "PartyScreen").props.model).toBe(mockModel);
    expect(renderer.root.findAll((node) => String(node.type) === "OldAgentGrid")).toHaveLength(0);
    expect(renderer.root.find((node) => String(node.type) === "AgentSelectModal").props.selectedAgentId).toBe("agent");
  });

  it("closes the popup locally and closes Party through navigation", () => {
    mount();
    act(() => renderer.root.find((node) => String(node.type) === "AgentSelectModal").props.onClose());
    expect(mockCloseAgents).toHaveBeenCalledTimes(1);
    expect(mockActions.onLeave).not.toHaveBeenCalled();
    act(() => renderer.root.find((node) => String(node.type) === "PartyScreen").props.actions.onClose());
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("opens the match tracker only through the match-flow callback", () => {
    mount();
    expect(mockPush).not.toHaveBeenCalled();
    act(() => mockFlow.mock.calls[0][0].onEnterMatch());
    expect(mockPush).toHaveBeenCalledWith("/combat_session");
  });
});
