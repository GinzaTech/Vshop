import TcpSocket from "react-native-tcp-socket";
import { NativeModules, Platform } from "react-native";

type ConnectionState = "disconnected" | "connecting" | "authenticated" | "error";

type RosterFriend = {
  jid: string;
  name: string;
};

type PendingRoomJoin = {
  roomJid: string;
  token: string;
  nickname: string;
};

type XMPPClientOptions = {
  rsoToken: string;
  pasToken: string;
  entitlementsToken: string;
  host: string;
  xmppRegion: string;
};

export class XMPPClient {
  private client: any = null;
  private rsoToken: string;
  private pasToken: string;
  private entitlementsToken: string;
  private host: string;
  private xmppDomain: string;
  private state: ConnectionState = "disconnected";
  private buffer = "";
  private saslAuthenticated = false;
  private sessionStarted = false;
  private intentionallyDisconnected = false;
  private pendingRoomJoins: PendingRoomJoin[] = [];
  private joinedRooms = new Set<string>();

  public onStateChange?: (state: ConnectionState) => void;
  public onMessage?: (from: string, body: string) => void;
  public onGroupMessage?: (room: string, from: string, body: string) => void;
  public onPresence?: (from: string, status: string, show: string, raw: string) => void;
  public onRoster?: (friends: RosterFriend[]) => void;

  constructor(options: XMPPClientOptions) {
    this.rsoToken = options.rsoToken;
    this.pasToken = options.pasToken;
    this.entitlementsToken = options.entitlementsToken;
    this.host = options.host;
    this.xmppDomain = `${options.xmppRegion}.pvp.net`;
  }

  public connect() {
    this.setState("connecting");

    if (!NativeModules.TcpSockets || !TcpSocket?.connectTLS) {
      throw new Error(
        `react-native-tcp-socket native module is unavailable on ${Platform.OS}. Rebuild the native app/dev client after installing the package; Expo Go and web cannot open Riot XMPP TCP sockets.`
      );
    }

    this.client = TcpSocket.connectTLS(
      {
        host: this.host,
        port: 5223,
        rejectUnauthorized: false,
      } as any,
      () => {
        if (__DEV__) {
          console.log("[XMPP] Connected to", this.host, "as", this.xmppDomain);
        }
        this.sendInitialStream();
      }
    );

    if (!this.client) {
      throw new Error("react-native-tcp-socket returned an empty socket");
    }

    this.client.on("data", (data: any) => {
      const text = data.toString();
      if (__DEV__) {
        console.log("[XMPP] RX", this.redact(text));
      }
      this.buffer += text;
      this.processBuffer();
    });

    this.client.on("error", (error: any) => {
      console.error("[XMPP] Error", error);
      this.setState("error");
    });

    this.client.on("close", () => {
      if (__DEV__) console.log("[XMPP] Connection closed");
      this.setState(this.intentionallyDisconnected ? "disconnected" : "error");
    });
  }

  public disconnect() {
    this.intentionallyDisconnected = true;
    if (this.client) {
      this.client.write("</stream:stream>");
      this.client.destroy();
      this.client = null;
    }
  }

  public sendMessage(to: string, message: string) {
    if (this.state !== "authenticated") return;
    const jid = to.includes("@") ? to : `${to}@pvp.net`;
    this.write(
      `<message to="${this.escapeXml(jid)}" type="chat"><body>${this.escapeXml(
        message
      )}</body></message>`
    );
  }

  public joinRoom(roomJid: string, token: string, nickname: string) {
    if (!roomJid || !token || !nickname) return;
    const join = { roomJid, token, nickname };

    if (this.state !== "authenticated") {
      this.pendingRoomJoins = [
        ...this.pendingRoomJoins.filter((item) => item.roomJid !== roomJid),
        join,
      ];
      return;
    }

    this.sendRoomJoin(join);
  }

  public sendGroupMessage(roomJid: string, message: string) {
    if (this.state !== "authenticated" || !roomJid) return;
    this.write(
      `<message to="${this.escapeXml(roomJid)}" type="groupchat"><body>${this.escapeXml(
        message
      )}</body></message>`
    );
  }

  private sendInitialStream() {
    this.write(
      `<?xml version="1.0" encoding="UTF-8"?><stream:stream to="${this.xmppDomain}" xml:lang="en" version="1.0" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams">`
    );
  }

  private authenticate() {
    this.write(
      `<auth mechanism="X-Riot-RSO-PAS" xmlns="urn:ietf:params:xml:ns:xmpp-sasl"><rso_token>${this.escapeXml(
        this.rsoToken
      )}</rso_token><pas_token>${this.escapeXml(this.pasToken)}</pas_token></auth>`
    );
  }

  private bindResource() {
    this.write(
      `<iq id="_xmpp_bind1" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/></iq>`
    );
  }

  private startSession() {
    this.write(
      `<iq id="_xmpp_session1" type="set"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>`
    );
  }

  private bootstrapSession() {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    this.setState("authenticated");
    this.write(
      `<iq id="xmpp_entitlements_0" type="set"><entitlements xmlns="urn:riotgames:entitlements"><token xmlns="">${this.escapeXml(
        this.entitlementsToken
      )}</token></entitlements></iq>`
    );
    this.write("<presence/>");
    this.write(
      `<iq type="get" id="roster_1"><query xmlns="jabber:iq:riotgames:roster" last_state="true"/></iq>`
    );
    this.flushRoomJoins();
  }

  private processBuffer() {
    if (!this.saslAuthenticated && this.buffer.includes("<stream:features")) {
      this.dropThrough("</stream:features>");
      this.authenticate();
    }

    if (this.hasSaslSuccess()) {
      if (__DEV__) {
        console.log("[XMPP] SASL authenticated, restarting stream");
      }
      this.saslAuthenticated = true;
      this.buffer = this.buffer.replace(
        /<success\s+xmlns=['"]urn:ietf:params:xml:ns:xmpp-sasl['"][\s\S]*?(?:\/>|<\/success>)/,
        ""
      );
      this.sendInitialStream();
      return;
    }

    if (this.saslAuthenticated && this.buffer.includes("<stream:features")) {
      this.dropThrough("</stream:features>");
      this.bindResource();
    }

    if (this.hasIq("_xmpp_bind1")) {
      this.consumeIq("_xmpp_bind1");
      this.startSession();
    }

    if (this.hasIq("_xmpp_session1")) {
      this.consumeIq("_xmpp_session1");
      this.bootstrapSession();
    }

    this.processRoster();
    this.processMessages();
    this.processPresence();

    if (this.buffer.length > 50000) {
      this.buffer = this.buffer.slice(-10000);
    }
  }

  private hasSaslSuccess() {
    return /<success\s+xmlns=['"]urn:ietf:params:xml:ns:xmpp-sasl['"][\s\S]*?(?:\/>|<\/success>)/.test(
      this.buffer
    );
  }

  private consumeIq(id: string) {
    const regex = new RegExp(
      `<iq[^>]*id=['"]${id}['"][\\s\\S]*?<\\/iq>|<iq[^>]*id=['"]${id}['"][^>]*\\/>`
    );
    const match = regex.exec(this.buffer);
    if (match) {
      this.buffer = this.buffer.replace(match[0], "");
    }
  }

  private hasIq(id: string) {
    return new RegExp(`<iq[^>]*id=['"]${id}['"]`).test(this.buffer);
  }

  private processRoster() {
    const rosterRegex =
      /<iq[^>]*id=['"]roster_1['"][\s\S]*?<query[^>]*>([\s\S]*?)<\/query>[\s\S]*?<\/iq>/;
    const rosterMatch = rosterRegex.exec(this.buffer);
    if (!rosterMatch) return;

    const itemRegex = /<item\s+([^>]+?)\/?>/g;
    const friends: RosterFriend[] = [];
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(rosterMatch[1])) !== null) {
      const attrs = this.parseAttributes(itemMatch[1]);
      if (attrs.jid) {
        friends.push({
          jid: attrs.jid,
          name: attrs.name || attrs.jid.split("@")[0],
        });
      }
    }

    if (friends.length > 0) {
      this.onRoster?.(friends);
    }
    this.buffer = this.buffer.replace(rosterMatch[0], "");
  }

  private processMessages() {
    const msgRegex = /<message\s+([^>]*from=['"][^'"]+['"][^>]*)>([\s\S]*?)<\/message>/g;
    this.consumeMatches(msgRegex, (match) => {
      const attrs = this.parseAttributes(match[1]);
      const bodyMatch = /<body>([\s\S]*?)<\/body>/.exec(match[2]);
      if (!bodyMatch || !attrs.from) return;

      const body = this.unescapeXml(bodyMatch[1]);
      if (attrs.type === "groupchat") {
        const [room, sender = attrs.from] = attrs.from.split("/");
        this.onGroupMessage?.(room, sender, body);
      } else {
        this.onMessage?.(attrs.from, body);
      }
    });
  }

  private processPresence() {
    const presRegex = /<presence[^>]*from=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/presence>/g;
    this.consumeMatches(presRegex, (match) => {
      const showMatch = /<show>(.*?)<\/show>/.exec(match[2]);
      const statusMatch = /<status>(.*?)<\/status>/.exec(match[2]);

      this.onPresence?.(
        match[1],
        statusMatch ? this.unescapeXml(statusMatch[1]) : "",
        showMatch?.[1] || "chat",
        match[2]
      );
    });
  }

  private consumeMatches(
    regex: RegExp,
    onMatch: (match: RegExpExecArray) => void
  ) {
    const consumed: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(this.buffer)) !== null) {
      consumed.push(match[0]);
      onMatch(match);
    }

    for (const value of consumed) {
      this.buffer = this.buffer.replace(value, "");
    }
  }

  private dropThrough(token: string) {
    const index = this.buffer.indexOf(token);
    if (index >= 0) {
      this.buffer = this.buffer.slice(index + token.length);
    }
  }

  private flushRoomJoins() {
    const joins = this.pendingRoomJoins;
    this.pendingRoomJoins = [];

    for (const join of joins) {
      this.sendRoomJoin(join);
    }
  }

  private sendRoomJoin({ roomJid, token, nickname }: PendingRoomJoin) {
    if (this.joinedRooms.has(roomJid)) return;
    this.write(
      `<presence to="${this.escapeXml(roomJid)}/${this.escapeXml(
        nickname
      )}"><x xmlns="http://jabber.org/protocol/muc"><password>${this.escapeXml(
        token
      )}</password></x></presence>`
    );
    this.joinedRooms.add(roomJid);
  }

  private parseAttributes(raw: string) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=['"]([^'"]*)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(raw)) !== null) {
      attrs[match[1]] = this.unescapeXml(match[2]);
    }

    return attrs;
  }

  private write(xml: string) {
    if (__DEV__) {
      console.log("[XMPP] TX", this.redact(xml));
    }
    this.client?.write(xml);
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  private redact(value: string) {
    return value
      .replace(/<rso_token>[\s\S]*?<\/rso_token>/g, "<rso_token>[redacted]</rso_token>")
      .replace(/<pas_token>[\s\S]*?<\/pas_token>/g, "<pas_token>[redacted]</pas_token>")
      .replace(/<token xmlns="">[\s\S]*?<\/token>/g, '<token xmlns="">[redacted]</token>');
  }

  private escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
        default:
          return c;
      }
    });
  }

  private unescapeXml(value: string) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }
}
