import { Buffer } from "buffer";
import { parsePartyPresence, presenceShow } from "~/features/party/party-presence";
import { useChatStore } from "~/utils/chat-store";
import { XMPPClient } from "~/utils/xmpp-client";

jest.mock("react-native-tcp-socket", () => ({ connectTLS: jest.fn() }));

const raw = (value: unknown) => `<valorant><p>${Buffer.from(JSON.stringify(value)).toString("base64")}</p></valorant>`;
describe("safe party presence", () => {
  afterEach(() => useChatStore.getState().resetChatSession());
  it("retains only validated display fields, never the raw blob or tokens", () => {
    expect(parsePartyPresence(raw({ playerCardId: "card", accountLevel: 23, sessionLoopState: "MENUS", accessToken: "sensitive", nested: { token: "sensitive" } }))).toEqual({ playerCardId: "card", accountLevel: 23, sessionLoopState: "MENUS" });
  });
  it.each([true, false])("retains the observed Valorant root isIdle=%s as a strict current boolean", (isIdle) => {
    expect(parsePartyPresence(raw({ isIdle, playerPresenceData: { playerCardId: "card", accountLevel: 23 },
      matchPresenceData: { sessionLoopState: "MENUS" }, accessToken: "private-token" })))
      .toEqual({ playerCardId: "card", accountLevel: 23, sessionLoopState: "MENUS", isIdle });
  });
  it.each([null, 0, 1, "true", "false", {}, []])("does not coerce unvalidated isIdle (%#)", (isIdle) => {
    expect(parsePartyPresence(raw({ isIdle, playerPresenceData: { playerCardId: "card" } }))).toEqual({ playerCardId: "card" });
  });
  it("does not infer idle from nested aliases or another game's payload", () => {
    expect(parsePartyPresence(raw({ playerPresenceData: { playerCardId: "card", isIdle: true }, private: { isIdle: true } })))
      .toEqual({ playerCardId: "card" });
    expect(parsePartyPresence('<games><keystone><p>{"isIdle":true}</p></keystone><valorant><p>{"playerCardId":"card"}</p></valorant></games>'))
      .toEqual({ playerCardId: "card" });
  });
  it("keeps false and clears idle on new unavailable metadata, offline and reconnect while retaining static card identity", () => {
    const store = useChatStore.getState();
    store.setFriends([{ id: "friend", gameName: "Name", tagLine: "AP", status: "", show: "chat" }]);
    store.updateFriendPresence("friend", "", "chat", { playerCardId: "card", isIdle: true });
    expect(useChatStore.getState().friends.friend.presence?.isIdle).toBe(true);
    store.updateFriendPresence("friend", "", "chat", { isIdle: false });
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card", isIdle: false });
    store.updateFriendPresence("friend", "", "chat");
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
    store.updateFriendPresence("friend", "", "chat", { isIdle: true });
    store.updateFriendPresence("friend", "", "offline", { isIdle: true });
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
    store.updateFriendPresence("friend", "", "chat", { isIdle: true });
    store.setStatus("connecting");
    store.setStatus("authenticated");
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
  });
  it.each(["", "<valorant><p>!</p></valorant>", raw(null), raw([]), raw({ playerCardId: 1, accountLevel: -1, sessionLoopState: {} })])("rejects malformed or empty metadata", (xml) => {
    expect(parsePartyPresence(xml)).toBeUndefined();
  });
  it("recognizes self-closing and paired unavailable stanzas", () => {
    expect(presenceShow("<presence from='friend' type='unavailable'/>", "chat")).toBe("offline");
    expect(presenceShow('<presence type="unavailable"><show>chat</show></presence>', "chat")).toBe("offline");
    expect(presenceShow("<presence/>", "dnd")).toBe("dnd");
    expect(presenceShow("<presence type='error'/>", "chat")).toBe("offline");
  });
  it("preserves early card identity through roster loading and offline", () => {
    const store = useChatStore.getState();
    store.updateFriendPresence("Friend@host/resource", "", "chat", { playerCardId: "card" });
    store.setFriends([{ id: "friend", gameName: "Name", tagLine: "AP", show: "offline", status: "" }]);
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
    store.updateFriendPresence("friend", "", "offline");
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
  });
  it("delivers paired and self-closing presence in order while retaining fragmented input", () => {
    const client = new XMPPClient({ rsoToken: "test", pasToken: "test", entitlementsToken: "test", host: "jp1.chat.si.riotgames.com", xmppRegion: "ap" });
    const onPresence = jest.fn(); client.onPresence = onPresence;
    const parser = client as unknown as { buffer: string; processPresence: () => void };
    parser.buffer = '<presence from="friend@host"><show>dnd</show></presence><presence type="unavailable" from="friend@host"/><presence from="other@host"';
    parser.processPresence();
    expect(onPresence.mock.calls.map((args) => args.slice(0, 3))).toEqual([["friend@host", "", "dnd"], ["friend@host", "", "offline"]]);
    expect(parser.buffer).toBe('<presence from="other@host"');
    parser.buffer += '/>'; parser.processPresence();
    expect(onPresence).toHaveBeenLastCalledWith("other@host", "", "chat", "");
  });
  it("requires fresh presence after reconnect while retaining cached names and chat", () => {
    const store = useChatStore.getState();
    store.setFriends([{ id: "friend", gameName: "Name", tagLine: "AP", status: "", show: "chat" }]);
    store.updateFriendPresence("friend", "", "chat", { playerCardId: "card" });
    store.setStatus("connecting"); store.setStatus("authenticated");
    expect(useChatStore.getState().friends.friend).toMatchObject({ gameName: "Name", show: "offline" });
    expect(useChatStore.getState().friends.friend.presence).toEqual({ playerCardId: "card" });
  });
});

describe("Valorant product payload selection", () => {
  const card = "a1b2c3d4-1234-4321-abcd-123456789abc";
  const metadata = { playerCardId: card, accountLevel: 42, sessionLoopState: "INGAME" };
  const json = JSON.stringify({ ...metadata, partyId: "private-party", accessToken: "private-token" });
  const encoded = Buffer.from(json).toString("base64");

  it("reads only the three confirmed nested Valorant p display fields", () => {
    expect(parsePartyPresence(raw({
      playerPresenceData: { playerCardId: card, accountLevel: 42, competitiveTier: 20, playerTitleId: "private-title" },
      matchPresenceData: { sessionLoopState: "INGAME", matchMap: "private-map", queueId: "private-queue" },
      partyId: "private-party",
    }))).toEqual(metadata);
  });

  it("prefers valid confirmed nested p fields while preserving flat legacy fallback", () => {
    expect(parsePartyPresence(raw({ playerCardId: "legacy", accountLevel: 21, sessionLoopState: "MENUS", playerPresenceData: { playerCardId: card, accountLevel: 42 }, matchPresenceData: { sessionLoopState: "INGAME" } }))).toEqual(metadata);
    expect(parsePartyPresence(raw({ ...metadata, playerPresenceData: { playerCardId: "../unsafe", accountLevel: -1 }, matchPresenceData: { sessionLoopState: "in game" } }))).toEqual(metadata);
  });

  it.each([null, [], "encoded", 42, { nested: { playerCardId: card, accountLevel: 42, sessionLoopState: "INGAME" } }])("rejects malformed or deeper nested metadata (%#)", (nested) => {
    expect(parsePartyPresence(raw({ playerPresenceData: nested, matchPresenceData: nested }))).toBeUndefined();
  });

  it("keeps confirmed nested mapping within Valorant p and never guesses pd profile fields", () => {
    const nested = JSON.stringify({ playerPresenceData: { playerCardId: card, accountLevel: 42 }, matchPresenceData: { sessionLoopState: "INGAME" } });
    expect(parsePartyPresence(`<keystone><p>${nested}</p></keystone><valorant/>`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><pd>${nested}</pd></valorant>`)).toBeUndefined();
    expect(parsePartyPresence(raw({ player: { profileBanner: card, profileIcon: card, state: "INGAME" }, activity: { sessionLoopState: "INGAME" } }))).toBeUndefined();
    expect(parsePartyPresence(`<valorant><p>${nested}</p>`)).toBeUndefined();
  });

  it("reads the live Valorant pd field, without borrowing other products' pd data", () => {
    expect(parsePartyPresence(`<games><keystone><pd>${encoded}</pd></keystone><valorant><p>1</p><pd>${encoded}</pd></valorant></games>`)).toEqual(metadata);
    expect(parsePartyPresence(`<valorant/><riot_client><pd>${encoded}</pd></riot_client>`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><pd><nested>${encoded}</nested></pd></valorant>`)).toBeUndefined();
  });

  it("merges validated display fields across p and pd within the same Valorant product", () => {
    expect(parsePartyPresence(`<valorant><p>{"accountLevel":21}</p><pd>${encoded}</pd></valorant>`)).toEqual(metadata);
    expect(parsePartyPresence(`<valorant><p>{"playerCardId":"card"}</p><pd>{"sessionLoopState":"MENUS","token":"secret"}</pd></valorant>`)).toEqual({ playerCardId: "card", sessionLoopState: "MENUS" });
    expect(parsePartyPresence(`<valorant><pd>invalid</pd><p>${encoded}</p></valorant>`)).toEqual(metadata);
  });

  it.each([
    `<games><league_of_legends><p>{"playerCardId":"wrong"}</p></league_of_legends><valorant><p>${json}</p></valorant></games>`,
    `<games><keystone><p>${encoded}</p></keystone><valorant><p xmlns="">\n${encoded}\n</p></valorant></games>`,
    `<games><v:valorant xmlns:v="urn:riotgames:valorant"><v:p>${encoded}</v:p></v:valorant></games>`,
    `<products><product name="league_of_legends"><p>${encoded}</p></product><product name="valorant"><p>${json}</p></product></products>`,
    `<products><product id='valorant'><p>${encoded}</p></product></products>`,
    `<valorant><p>${json.replace(/"/g, "&quot;")}</p></valorant>`,
    `<valorant><p><![CDATA[${json}]]></p></valorant>`,
    `<valorant><p/><p>${encoded}</p></valorant>`,
    `<valorant/><valorant><p>${json}</p></valorant>`,
  ])("reads only whitelisted fields from the Valorant product (%#)", (xml) => {
    expect(parsePartyPresence(xml)).toEqual(metadata);
  });

  it.each([
    `<valorant/><league_of_legends><p>${encoded}</p></league_of_legends>`,
    `<valorant><p/></valorant><keystone><p>${encoded}</p></keystone>`,
    `<valorant></valorant><p>${encoded}</p>`,
    `<product name="league_of_legends"><p>${json}</p></product>`,
    `<league_of_legends><valorant><p>${encoded}</p></valorant></league_of_legends>`,
    `<valorant><keystone><p>${encoded}</p></keystone></valorant>`,
    `<valorant><p><keystone>${json}</keystone></p></valorant>`,
    `<valorant><p>${encoded}</p></keystone>`,
    `<valorant><p>${encoded}</p>`,
    `<p>${json}</p>`, json,
  ])("never borrows a payload from another product or incomplete XML (%#)", (xml) => {
    expect(parsePartyPresence(xml)).toBeUndefined();
  });

  it("skips invalid Valorant payloads without falling through to League", () => {
    expect(parsePartyPresence(`<valorant><p>invalid</p></valorant><league_of_legends><p>${encoded}</p></league_of_legends>`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><p>invalid</p><p>${encoded}</p></valorant>`)).toEqual(metadata);
  });

  it.each([
    'data-name="valorant"', 'product-id="valorant"', 'x:name="valorant"',
    'data-name="valorant" name="league"', 'name="league" data-name="valorant"',
    'name="valorant" name="league"', 'id="league" id="valorant"',
    'name="valorant" id="league"', `data=' name="valorant" '`,
  ])("rejects deceptive or conflicting product attributes: %s", (attributes) => {
    expect(parsePartyPresence(`<product ${attributes}><p>${encoded}</p></product>`)).toBeUndefined();
  });

  it.each([" ", "https://private.invalid/card", "card/../id", "card token", "x".repeat(129)])("rejects unsafe card identifiers (%#)", (playerCardId) => {
    expect(parsePartyPresence(raw({ playerCardId }))).toBeUndefined();
  });

  it("rejects oversized and corrupted payloads", () => {
    expect(parsePartyPresence(`<valorant><p>${"A".repeat(32_769)}</p></valorant>`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><p>${encoded}!</p></valorant>`)).toBeUndefined();
    expect(parsePartyPresence(raw({ accountLevel: Number.MAX_SAFE_INTEGER + 1, sessionLoopState: "in game" }))).toBeUndefined();
  });

  it("decodes XML numeric entities exactly once and ignores XML comments", () => {
    const decimal = json.replace(/"/g, "&#34;");
    const hex = json.replace(/"/g, "&#x22;");
    expect(parsePartyPresence(`<valorant><!--ignored--><p>${decimal}</p></valorant>`)).toEqual(metadata);
    expect(parsePartyPresence(`<valorant><p>${hex}</p></valorant>`)).toEqual(metadata);
    expect(parsePartyPresence('<valorant><p>{&quot;playerCardId&quot;:&quot;card&amp;token&lt;bad&gt;&apos;&quot;}</p></valorant>')).toBeUndefined();
    expect(parsePartyPresence('<valorant><p>{&amp;quot;playerCardId&amp;quot;:&amp;quot;card&amp;quot;}</p></valorant>')).toBeUndefined();
    expect(parsePartyPresence('<valorant><p>{"playerCardId":"&#x110000;&#0;&#xD800;"}</p></valorant>')).toBeUndefined();
  });

  it("bounds stanza size/nesting and rejects malformed tag boundaries", () => {
    expect(parsePartyPresence(`<valorant><p>${json}</p></valorant>${" ".repeat(262_144)}`)).toBeUndefined();
    expect(parsePartyPresence(`${"<games>".repeat(33)}<valorant><p>${json}</p></valorant>${"</games>".repeat(33)}`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><p>${json}</p></valorant><`)).toBeUndefined();
    expect(parsePartyPresence(`<valorant><p>${json}</p></valorant></unknown>`)).toBeUndefined();
    expect(parsePartyPresence(`<product><p>${json}</p></product>`)).toBeUndefined();
  });

  it("delivers a raw JSON multi-product stanza through the existing XMPP callback", () => {
    const client = new XMPPClient({ rsoToken: "test", pasToken: "test", entitlementsToken: "test", host: "jp1.chat.si.riotgames.com", xmppRegion: "ap" });
    const observations: unknown[] = [];
    client.onPresence = (_from, _status, show, body) => observations.push({ show, metadata: parsePartyPresence(body) });
    const parser = client as unknown as { buffer: string; processPresence: () => void };
    parser.buffer = `<presence from="fixture@host"><show>dnd</show><games><keystone/><valorant><p>${json}</p></valorant></games></presence><presence from="fixture@host" type="unavailable"/>`;
    parser.processPresence();
    expect(observations).toEqual([{ show: "dnd", metadata }, { show: "offline", metadata: undefined }]);
  });
});
