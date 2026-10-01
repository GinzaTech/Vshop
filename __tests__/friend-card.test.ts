import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import FriendsScreen from "~/app/(authenticated)/friends";
import PartyFriendRail from "~/features/party/PartyFriendRail";
import { buildPartyViewModel } from "~/features/party/party-model";
import { parsePartyPresence } from "~/features/party/party-presence";
import { CachedImage } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import { getFriendCardArt } from "~/utils/friend-card";
import { useChatStore, type ChatFriend } from "~/utils/chat-store";
import { isOnlineFriend } from "~/utils/friend-presence";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn(), useNavigation: () => ({ setOptions: jest.fn() }) }));
jest.mock("react-native-paper", () => ({ ActivityIndicator: () => null }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: {} }) } }));
jest.mock("~/utils/chat-service", () => ({ refreshFriendsRoster: jest.fn() }));
jest.mock("~/components/ui/GlassCard", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("~/components/ui/AppRefreshControl", () => ({ __esModule: true, default: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: () => null }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ cards: [
  { uuid: "card-a", smallArt: "https://example.com/a-small.png" },
  { uuid: "card-b", smallArt: "https://example.com/b-small.png" },
] }) }));

const friend = (id = "friend", playerCardId = "card-a"): ChatFriend => ({
  id, gameName: "Real friend", tagLine: "AP", status: "", show: "dnd",
  presence: { playerCardId, accountLevel: 42, sessionLoopState: "INGAME" },
});
const cards = [
  { uuid: "card-a", smallArt: "https://example.com/a-small.png", wideArt: "https://example.com/a-wide.png", largeArt: "https://example.com/a-large.png" },
  { uuid: "card-b", smallArt: "https://example.com/b-small.png" },
];

describe("friend playercard art", () => {
  it("links the actual friend card ID to the public catalog, case insensitively", () => {
    expect(getFriendCardArt(friend("friend", " CARD-A "), cards)).toBe(cards[0].smallArt);
  });
  it("returns an honest placeholder for absent metadata, unloaded catalogs and unknown cards", () => {
    expect(getFriendCardArt({ ...friend(), presence: undefined }, cards)).toBeUndefined();
    expect(getFriendCardArt(friend(), [])).toBeUndefined();
    expect(getFriendCardArt(friend("friend", "unknown"), cards)).toBeUndefined();
    expect(getFriendCardArt(friend("friend", ""), [{ uuid: "", smallArt: cards[0].smallArt }])).toBeUndefined();
  });
  it("uses only available art from the matching card", () => {
    expect(getFriendCardArt(friend(), [{ uuid: "card-a", smallArt: "", displayIcon: cards[0].smallArt }])).toBe(cards[0].smallArt);
    expect(getFriendCardArt(friend(), [{ uuid: "card-a", wideArt: cards[0].wideArt }])).toBe(cards[0].wideArt);
    expect(getFriendCardArt(friend(), [{ uuid: "card-a", largeArt: cards[0].largeArt }])).toBe(cards[0].largeArt);
    expect(getFriendCardArt(friend(), [{ uuid: "card-a" }, cards[1]])).toBeUndefined();
  });
  it("does not retain stale art after the friend changes card or a catalog loads", () => {
    expect(getFriendCardArt(friend(), [])).toBeUndefined();
    expect(getFriendCardArt(friend(), cards)).toBe(cards[0].smallArt);
    expect(getFriendCardArt(friend("friend", "card-b"), cards)).toBe(cards[1].smallArt);
    expect(getFriendCardArt(friend("friend", "unknown"), cards)).toBeUndefined();
    expect(getFriendCardArt(friend(), [{ ...cards[0], smallArt: cards[1].smallArt }])).toBe(cards[1].smallArt);
  });
});

describe("account-scoped static friend card identity", () => {
  afterEach(() => useChatStore.getState().resetChatSession());

  it("retains only static card identity across reconnect and requires fresh online/activity state", () => {
    const store = useChatStore.getState();
    store.setFriends([{ ...friend(), status: "Playing" }]);
    store.setStatus("connecting");
    store.setStatus("authenticated");
    const cached = useChatStore.getState().friends.friend;
    expect(cached).toMatchObject({ status: "", show: "offline", presence: { playerCardId: "card-a", accountLevel: 42 } });
    expect(cached.presence?.sessionLoopState).toBeUndefined();
    expect(isOnlineFriend(cached, "authenticated")).toBe(false);
    store.updateFriendPresence("friend", "", "chat");
    expect(getFriendCardArt(useChatStore.getState().friends.friend, cards)).toBe(cards[0].smallArt);
    expect(useChatStore.getState().friends.friend.presence?.sessionLoopState).toBeUndefined();
  });

  it("keeps card identity when offline, but replaces it after a real card change", () => {
    const store = useChatStore.getState();
    store.setFriends([friend()]);
    store.updateFriendPresence("friend", "", "offline");
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card-a", accountLevel: 42 });
    store.updateFriendPresence("friend", "", "chat", { playerCardId: "card-b", sessionLoopState: "MENUS" });
    expect(getFriendCardArt(useChatStore.getState().friends.friend, cards)).toBe(cards[1].smallArt);
    expect(useChatStore.getState().friends.friend.presence?.sessionLoopState).toBe("MENUS");
  });

  it("retains early card identity through an offline stanza and late roster load", () => {
    const store = useChatStore.getState();
    store.updateFriendPresence("Friend@host/pc", "", "dnd", friend().presence);
    store.updateFriendPresence("friend", "", "offline");
    store.setFriends([{ ...friend(), presence: undefined }]);
    expect(useChatStore.getState().friends.friend).toMatchObject({ show: "offline", presence: { playerCardId: "card-a", accountLevel: 42 } });
    expect(useChatStore.getState().friends.friend.presence?.sessionLoopState).toBeUndefined();
  });

  it("does not borrow another friend's identity or leak it after an account reset", () => {
    const store = useChatStore.getState();
    store.setFriends([friend(), { ...friend("other"), presence: undefined }]);
    expect(getFriendCardArt(useChatStore.getState().friends.other, cards)).toBeUndefined();
    store.resetChatSession();
    store.setFriends([{ ...friend(), presence: undefined }]);
    expect(getFriendCardArt(useChatStore.getState().friends.friend, cards)).toBeUndefined();
    expect(useChatStore.getState().pendingPresence).toEqual({});
  });
});
describe("friend card rendering", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  afterEach(() => {
    act(() => renderer?.unmount());
    useChatStore.getState().resetChatSession();
  });

  it("shows the real online friend's card, preserves its accessible label/status icon, and updates after a card change", () => {
    const store = useChatStore.getState();
    store.setStatus("authenticated");
    store.setFriends([friend(), { ...friend("offline", "card-b"), show: "offline" }]);
    act(() => { renderer = TestRenderer.create(React.createElement(FriendsScreen)); });
    expect(renderer.root.findAllByType(CachedImage)).toHaveLength(1);
    expect(renderer.root.findByType(CachedImage).props).toMatchObject({ source: { uri: cards[0].smallArt }, accessible: false, contentFit: "cover" });
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === "Real friend#AP, friends_page.dnd").length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(AppIcon).some((node) => node.props.name === "connected" && node.props.decorative)).toBe(true);
    act(() => store.updateFriendPresence("friend", "", "dnd", { playerCardId: "card-b" }));
    expect(renderer.root.findByType(CachedImage).props.source.uri).toBe(cards[1].smallArt);
    act(() => store.setStatus("connecting"));
    expect(renderer.root.findAllByType(CachedImage)).toHaveLength(0);
  });

  it("uses an initial placeholder when metadata is missing, then shows art when presence arrives", () => {
    const store = useChatStore.getState();
    store.setStatus("authenticated");
    store.setFriends([{ ...friend(), presence: undefined }]);
    act(() => { renderer = TestRenderer.create(React.createElement(FriendsScreen)); });
    expect(renderer.root.findAllByType(CachedImage)).toHaveLength(0);
    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === "R")).toBe(true);
    act(() => store.updateFriendPresence("friend", "", "dnd", { playerCardId: "card-a" }));
    expect(renderer.root.findByType(CachedImage).props.source.uri).toBe(cards[0].smallArt);
  });

  it("passes the same derived card art to the Party rail without changing invite permissions", () => {
    const onInvite = jest.fn();
    const store = useChatStore.getState();
    store.setStatus("authenticated");
    store.setFriends([{ ...friend(), presence: undefined }]);
    store.updateFriendPresence("friend", "", "dnd", parsePartyPresence('<games><keystone><p>{"playerCardId":"wrong"}</p></keystone><valorant><p>{"playerCardId":"card-a","sessionLoopState":"INGAME"}</p></valorant></games>'));
    const chat = useChatStore.getState();
    const model = buildPartyViewModel({
      session: { id: "self", region: "ap", accessToken: "test", entitlementsToken: "test" },
      snapshot: { state: "idle", partyId: null, party: null, matchId: null, pregameMatch: null, currentGameMatch: null, namesBySubject: {} },
      friends: chat.friends, friendConnectionStatus: chat.status, assets: { cards, competitiveTiers: [] },
    });
    expect(model.friends[0]).toMatchObject({ avatarUrl: cards[0].smallArt, activityLabel: "INGAME", canInvite: false });
    act(() => { renderer = TestRenderer.create(React.createElement(PartyFriendRail, {
      friends: model.friends,
      connectionStatus: "authenticated", disabled: false, inviting: false, onInvite, onAllFriends: jest.fn(),
    })); });
    expect(renderer.root.findByType(CachedImage).props).toMatchObject({ source: { uri: cards[0].smallArt }, accessible: false });
    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === "INGAME")).toBe(true);
    const invite = renderer.root.findAll((node) => node.props.accessibilityHint === "Sends a party invitation")[0];
    expect(invite?.props.disabled).toBe(true);
    act(() => invite?.props.onPress());
    expect(onInvite).not.toHaveBeenCalled();
  });
});
