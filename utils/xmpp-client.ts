// Import thư viện TCP socket cho React Native (kết nối TLS đến server XMPP)
import TcpSocket from "react-native-tcp-socket";
// Import NativeModules để kiểm tra module native TcpSockets có khả dụng không, Platform để kiểm tra OS
import { NativeModules, Platform } from "react-native";
import { trimXmppBuffer } from "./xmpp-buffer";

// Kiểu trạng thái kết nối XMPP: disconnected (ngắt kết nối) | connecting (đang kết nối) | authenticated (đã xác thực) | error (lỗi)
type ConnectionState = "disconnected" | "connecting" | "authenticated" | "error";

// Hằng số bật/tắt logging chi tiết XMPP: chỉ bật khi DEV mode và biến môi trường EXPO_PUBLIC_XMPP_VERBOSE_LOGGING = "true"
const XMPP_VERBOSE_LOGGING =
  __DEV__ && process.env.EXPO_PUBLIC_XMPP_VERBOSE_LOGGING === "true";

// Kiểu dữ liệu cho một người bạn trong danh sách roster (danh bạ XMPP)
type RosterFriend = {
  jid: string;     // JID (Jabber ID) của người dùng
  name: string;    // Tên hiển thị
};

// Export kiểu dữ liệu cho tin nhắn trực tiếp (chat 1-1) qua XMPP
export type XmppDirectMessage = {
  id: string;               // ID duy nhất của tin nhắn
  from: string;             // JID người gửi
  to: string;               // JID người nhận
  body: string;             // Nội dung tin nhắn
  timestamp: number;        // Thời gian gửi (milliseconds)
};

// Kiểu dữ liệu cho một yêu cầu tham gia phòng chat đang chờ xử lý
type PendingRoomJoin = {
  roomJid: string;     // JID của phòng chat
  token: string;       // Token xác thực để vào phòng
  nickname: string;    // Biệt danh trong phòng
};

// Kiểu dữ liệu cho các tùy chọn khởi tạo XMPPClient
type XMPPClientOptions = {
  rsoToken: string;           // Token RSO (Riot Single Sign-On)
  pasToken: string;           // Token PAS (Platform Authentication Service) cho chat
  entitlementsToken: string;  // Token entitlements (quyền truy cập)
  host: string;               // Hostname server XMPP (chat-oc01.%region%.pvp.net)
  xmppRegion: string;         // Region của XMPP (vd: na, eu, ap, ...)
};

// Export class XMPPClient - Client XMPP dùng giao thức chat của Riot Games
// Kết nối qua TCP TLS tới server XMPP, xác thực bằng RSO+PAS token, hỗ trợ chat 1-1 và phòng nhóm
export class XMPPClient {
  // Socket TCP kết nối đến server XMPP
  private client: any = null;
  // Token RSO cho xác thực
  private rsoToken: string;
  // Token PAS cho xác thực chat
  private pasToken: string;
  // Token entitlements (quyền) của Riot
  private entitlementsToken: string;
  // Host server XMPP (ví dụ: chat-oc01.na.pvp.net)
  private host: string;
  // Domain XMPP (region + .pvp.net, ví dụ: na.pvp.net)
  private xmppDomain: string;
  // Trạng thái kết nối hiện tại
  private state: ConnectionState = "disconnected";
  // Buffer tạm lưu dữ liệu XML nhận được từ socket
  private buffer = "";
  // Flag: đã xác thực SASL thành công chưa
  private saslAuthenticated = false;
  // Flag: đã bắt đầu session chưa (sau bind resource)
  private sessionStarted = false;
  // Flag: người dùng chủ động ngắt kết nối (true) hay bị mất kết nối (false)
  private intentionallyDisconnected = false;
  // Danh sách các yêu cầu join phòng đang chờ (xử lý sau khi xác thực)
  private pendingRoomJoins: PendingRoomJoin[] = [];
  // Set các phòng đã join (dùng để tránh join lại phòng đã join)
  private joinedRooms = new Set<string>();
  // Timer keep-alive: gửi khoảng trắng mỗi 120 giây để giữ kết nối
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  // Bộ đếm yêu cầu (dùng cho requestMessageHistory)
  private requestCounter = 0;
  // Timestamp của tin nhắn cuối cùng (đảm bảo timestamp luôn tăng dần)
  private lastMessageTimestamp = 0;

  // Callback khi trạng thái kết nối thay đổi
  public onStateChange?: (state: ConnectionState) => void;
  // Callback khi nhận được tin nhắn trực tiếp (1-1)
  public onMessage?: (message: XmppDirectMessage) => void;
  // Callback khi nhận được tin nhắn nhóm (group chat)
  public onGroupMessage?: (room: string, from: string, body: string) => void;
  // Callback khi nhận được presence (trạng thái) từ người dùng khác
  public onPresence?: (from: string, status: string, show: string, raw: string) => void;
  // Callback khi nhận được danh sách bạn bè (roster)
  public onRoster?: (friends: RosterFriend[]) => void;

  // Constructor: khởi tạo client XMPP với các token và thông tin server
  // Parameters:
  //   - options: XMPPClientOptions chứa các token, host, region
  constructor(options: XMPPClientOptions) {
    this.rsoToken = options.rsoToken;
    this.pasToken = options.pasToken;
    this.entitlementsToken = options.entitlementsToken;
    const normalizedHost = options.host.trim().toLowerCase().replace(/\.$/, "");
    if (
      !normalizedHost.endsWith(".riotgames.com") &&
      !normalizedHost.endsWith(".pvp.net")
    ) {
      throw new Error("Refusing to connect to an untrusted Riot chat host");
    }
    this.host = normalizedHost;
    this.xmppDomain = `${options.xmppRegion}.pvp.net`;   // Domain = region + ".pvp.net"
  }

  // Phương thức public: kết nối đến server XMPP qua TCP TLS
  // Thiết lập socket, gửi stream khởi tạo, xử lý dữ liệu đến, lỗi và đóng kết nối
  // Không nhận tham số, không trả về giá trị
  public connect() {
    this.setState("connecting");

    // Kiểm tra module native TcpSockets có khả dụng không (không hoạt động trên Expo Go/Web)
    if (!NativeModules.TcpSockets || !TcpSocket?.connectTLS) {
      throw new Error(
        `react-native-tcp-socket native module is unavailable on ${Platform.OS}. Rebuild the native app/dev client after installing the package; Expo Go and web cannot open Riot XMPP TCP sockets.`
      );
    }

    // Kết nối TLS đến server XMPP cổng 5223
    this.client = TcpSocket.connectTLS(
      {
        host: this.host,
        port: 5223,                // Cổng XMPP chuẩn (có TLS)
        // Always validate Riot's certificate chain. Disabling this turns the
        // bearer-token XMPP connection into a trivial network MITM target.
        rejectUnauthorized: true,
      } as any,
      () => {
        // Callback khi kết nối thành công
        if (__DEV__) {
          console.log("[XMPP] Connected to", this.host, "as", this.xmppDomain);
        }
        this.sendInitialStream();   // Gửi stream XMPP khởi tạo
      }
    );

    if (!this.client) {
      throw new Error("react-native-tcp-socket returned an empty socket");
    }

    // Xử lý dữ liệu đến: gộp vào buffer và xử lý
    const socket = this.client;

    socket.on("data", (data: any) => {
      const text = data.toString();
      if (XMPP_VERBOSE_LOGGING) {
        console.log("[XMPP] RX", this.redact(text));   // Log dữ liệu nhận được (đã che token)
      }
      this.buffer += text;
      this.processBuffer();                              // Xử lý buffer XML
    });

    // Xử lý lỗi socket
    socket.on("error", (error: any) => {
      this.markSocketFailed(socket, error);
    });

    // Xử lý khi kết nối đóng
    socket.on("close", () => {
      if (__DEV__) console.log("[XMPP] Connection closed");
      if (this.client === socket) {
        this.client = null;
      }
      this.stopKeepAlive();
      this.setState(this.intentionallyDisconnected ? "disconnected" : "error");
    });
  }

  // Phương thức public: ngắt kết nối XMPP chủ động
  // Gửi </stream:stream>, hủy socket, dừng keep-alive
  public disconnect() {
    this.intentionallyDisconnected = true;
    this.stopKeepAlive();
    const socket = this.client;
    this.client = null;
    if (!socket) return;

    try {
      if (!socket.destroyed) {
        socket.write("</stream:stream>");  // Gửi thông báo đóng stream
      }
    } catch (error) {
      if (__DEV__) {
        console.log("[XMPP] Could not close stream cleanly", error);
      }
    }

    try {
      if (!socket.destroyed) {
        socket.destroy();                    // Hủy socket
      }
    } catch (error) {
      if (__DEV__) {
        console.log("[XMPP] Could not destroy socket cleanly", error);
      }
    }
  }

  // Phương thức public: gửi tin nhắn trực tiếp (1-1) đến một người dùng
  // Parameters:
  //   - to: JID người nhận
  //   - message: nội dung tin nhắn
  // Returns: object { id, timestamp, jid } nếu gửi thành công, false nếu thất bại
  public sendMessage(to: string, message: string) {
    if (this.state !== "authenticated" || !this.client || !message.trim()) {
      return false;
    }

    const jid = this.toBareJid(to);
    // Đảm bảo timestamp luôn tăng (tránh trùng timestamp)
    const timestamp = Math.max(Date.now(), this.lastMessageTimestamp + 1);
    this.lastMessageTimestamp = timestamp;
    const id = `${timestamp}:1`;

    const written = this.write(
      `<message id="${id}" to="${this.escapeXml(jid)}" type="chat"><body>${this.escapeXml(
        message
      )}</body></message>`
    );
    return written ? { id, timestamp, jid } : false;
  }

  // Phương thức public: yêu cầu lịch sử tin nhắn với một người dùng
  // Sử dụng IQ get với namespace riotgames:archive
  // Parameters:
  //   - to: JID người dùng cần lấy lịch sử
  // Returns: true nếu gửi yêu cầu thành công, false nếu thất bại
  public requestMessageHistory(to: string) {
    if (this.state !== "authenticated" || !this.client) {
      return false;
    }

    const jid = this.toBareJid(to);
    const requestId = `get_archive_${++this.requestCounter}`;
    return this.write(
      `<iq type="get" id="${requestId}"><query xmlns="jabber:iq:riotgames:archive"><with>${this.escapeXml(
        jid
      )}</with></query></iq>`
    );
  }

  // Yêu cầu Riot gửi lại roster hiện tại. Mỗi request dùng ID riêng để màn
  // Bạn bè có thể chủ động refresh mà không cần phá socket đang hoạt động.
  public requestRoster() {
    if (this.state !== "authenticated" || !this.client) {
      return false;
    }

    const requestId = `roster_${++this.requestCounter}`;
    return this.write(
      `<iq type="get" id="${requestId}"><query xmlns="jabber:iq:riotgames:roster" last_state="true"/></iq>`
    );
  }

  // Phương thức public: tham gia phòng chat nhóm (MUC - Multi-User Chat)
  // Nếu chưa xác thực, lưu vào hàng đợi để join sau
  // Parameters:
  //   - roomJid: JID của phòng
  //   - token: token xác thực để vào phòng
  //   - nickname: biệt danh trong phòng
  public joinRoom(roomJid: string, token: string, nickname: string) {
    if (!roomJid || !token || !nickname) return;
    const join = { roomJid, token, nickname };

    if (this.state !== "authenticated") {
      // Chưa xác thực: lưu vào danh sách chờ (loại bỏ join cũ cùng phòng nếu có)
      this.pendingRoomJoins = [
        ...this.pendingRoomJoins.filter((item) => item.roomJid !== roomJid),
        join,
      ];
      return;
    }

    this.sendRoomJoin(join);  // Đã xác thực: gửi presence join ngay
  }

  // Phương thức public: gửi tin nhắn nhóm (group chat)
  // Parameters:
  //   - roomJid: JID của phòng
  //   - message: nội dung tin nhắn
  // Returns: true nếu gửi thành công, false nếu thất bại
  public sendGroupMessage(roomJid: string, message: string) {
    const body = message.trim();
    if (this.state !== "authenticated" || !roomJid || !body) return false;

    return this.write(
      `<message to="${this.escapeXml(roomJid)}" type="groupchat"><body>${this.escapeXml(
        body
      )}</body></message>`
    );
  }

  // Phương thức private: gửi stream XMPP khởi tạo (mở đầu kết nối)
  private sendInitialStream() {
    this.write(
      `<?xml version="1.0" encoding="UTF-8"?><stream:stream to="${this.xmppDomain}" xml:lang="en" version="1.0" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams">`
    );
  }

  // Phương thức private: gửi yêu cầu xác thực SASL với cơ chế X-Riot-RSO-PAS
  // Gửi rso_token và pas_token để xác thực với server Riot
  private authenticate() {
    this.write(
      `<auth mechanism="X-Riot-RSO-PAS" xmlns="urn:ietf:params:xml:ns:xmpp-sasl"><rso_token>${this.escapeXml(
        this.rsoToken
      )}</rso_token><pas_token>${this.escapeXml(this.pasToken)}</pas_token></auth>`
    );
  }

  // Phương thức private: gửi IQ bind resource (ràng buộc tài nguyên cho session XMPP)
  private bindResource() {
    this.write(
      `<iq id="_xmpp_bind1" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/></iq>`
    );
  }

  // Phương thức private: gửi IQ start session (khởi tạo session XMPP)
  private startSession() {
    this.write(
      `<iq id="_xmpp_session1" type="set"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>`
    );
  }

  // Phương thức private: khởi tạo session sau khi xác thực thành công
  // Gửi entitlements token, yêu cầu roster, gửi presence, flush các room join đang chờ, bắt đầu keep-alive
  private bootstrapSession() {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    this.setState("authenticated");
    // Gửi token entitlements
    this.write(
      `<iq id="xmpp_entitlements_0" type="set"><entitlements xmlns="urn:riotgames:entitlements"><token xmlns="">${this.escapeXml(
        this.entitlementsToken
      )}</token></entitlements></iq>`
    );
    // Yêu cầu danh sách bạn bè (roster)
    this.requestRoster();
    // Gửi presence: thông báo trạng thái online
    this.write("<presence/>");
    // Thực hiện các yêu cầu join phòng đang chờ
    this.flushRoomJoins();
    // Bắt đầu timer keep-alive
    this.startKeepAlive();
  }

  // Phương thức private: xử lý buffer XML nhận được từ socket
  // Xử lý theo thứ tự: stream features -> SASL auth -> bind -> session -> roster/messages/presence
  private processBuffer() {
    // Bước 1: Nếu chưa SASL auth và nhận được stream:features -> gửi authenticate
    if (
      !this.saslAuthenticated &&
      this.buffer.includes("<stream:features") &&
      this.dropThrough("</stream:features>")
    ) {
      this.authenticate();
    }

    // Bước 2: Nếu nhận được success SASL -> đánh dấu đã auth, restart stream
    if (this.hasSaslSuccess()) {
      if (__DEV__) {
        console.log("[XMPP] SASL authenticated, restarting stream");
      }
      this.saslAuthenticated = true;
      this.buffer = this.buffer.replace(
        /<success\s+xmlns=['"]urn:ietf:params:xml:ns:xmpp-sasl['"][\s\S]*?(?:\/>|<\/success>)/,
        ""
      );
      this.sendInitialStream();   // Gửi lại stream sau auth
      return;
    }

    // Bước 3: Nếu đã SASL auth và có stream:features -> bind resource
    if (
      this.saslAuthenticated &&
      this.buffer.includes("<stream:features") &&
      this.dropThrough("</stream:features>")
    ) {
      this.bindResource();
    }

    // Bước 4: Nếu có IQ _xmpp_bind1 response -> start session
    if (this.hasIq("_xmpp_bind1")) {
      this.consumeIq("_xmpp_bind1");
      this.startSession();
    }

    // Bước 5: Nếu có IQ _xmpp_session1 response -> bootstrap session
    if (this.hasIq("_xmpp_session1")) {
      this.consumeIq("_xmpp_session1");
      this.bootstrapSession();
    }

    // Xử lý roster, messages, presence
    this.processRoster();
    this.processMessages();
    this.processPresence();

    // Giới hạn buffer nhưng không cắt một roster lớn đang được nhận dở.
    this.buffer = trimXmppBuffer(this.buffer);
  }

  // Phương thức private: kiểm tra buffer có chứa success SASL không
  // Returns: true nếu có success SASL
  private hasSaslSuccess() {
    return /<success\s+xmlns=['"]urn:ietf:params:xml:ns:xmpp-sasl['"][\s\S]*?(?:\/>|<\/success>)/.test(
      this.buffer
    );
  }

  // Phương thức private: loại bỏ IQ response khỏi buffer
  // Parameters:
  //   - id: ID của IQ cần loại bỏ
  private consumeIq(id: string) {
    const regex = new RegExp(
      `<iq[^>]*id=['"]${id}['"][\\s\\S]*?<\\/iq>|<iq[^>]*id=['"]${id}['"][^>]*\\/>`
    );
    const match = regex.exec(this.buffer);
    if (match) {
      this.buffer = this.buffer.replace(match[0], "");
    }
  }

  // Phương thức private: kiểm tra buffer có chứa IQ với ID cụ thể không
  // Parameters:
  //   - id: ID cần tìm
  // Returns: true nếu tìm thấy
  private hasIq(id: string) {
    return new RegExp(`<iq[^>]*id=['"]${id}['"]`).test(this.buffer);
  }

  // Phương thức private: xử lý danh sách bạn bè (roster) từ buffer
  // Parse <item> trong mọi IQ roster, gọi callback onRoster
  private processRoster() {
    const rosterRegex =
      /<iq\b[^>]*>(?:(?!<\/iq>)[\s\S])*?<query\b(?=[^>]*xmlns=['"]jabber:iq:riotgames:roster['"])[^>]*(?:\/>|>([\s\S]*?)<\/query>)(?:(?!<\/iq>)[\s\S])*?<\/iq>/;
    let rosterMatch = rosterRegex.exec(this.buffer);

    while (rosterMatch) {
      const itemRegex = /<item\s+([^>]+?)\/?>/g;
      const friends: RosterFriend[] = [];
      let itemMatch: RegExpExecArray | null;
      const rosterBody = rosterMatch[1] || "";

      // Duyệt từng item trong roster
      while ((itemMatch = itemRegex.exec(rosterBody)) !== null) {
        const attrs = this.parseAttributes(itemMatch[1]);
        if (attrs.jid) {
          friends.push({
            jid: attrs.jid,
            name: attrs.name || "Unknown",
          });
        }
      }

      this.onRoster?.(friends);
      this.buffer = this.buffer.replace(rosterMatch[0], "");
      rosterMatch = rosterRegex.exec(this.buffer);
    }
  }

  // Phương thức private: xử lý tin nhắn từ buffer
  // Parse <message>, phân biệt chat 1-1 và groupchat, gọi callback tương ứng
  private processMessages() {
    const msgRegex = /<message\b([^>]*)>([\s\S]*?)<\/message>/g;
    this.consumeMatches(msgRegex, (match) => {
      const attrs = this.parseAttributes(match[1]);
      const bodyMatch = /<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/.exec(match[2]);
      if (!bodyMatch || !attrs.from) return;

      const body = this.unescapeXml(bodyMatch[1]);
      const timestamp = this.getMessageTimestamp(attrs, match[2]);
      if (attrs.type === "groupchat") {
        // Tin nhắn nhóm: tách room/sender từ from (format: room/sender)
        const [room, sender = attrs.from] = attrs.from.split("/");
        this.onGroupMessage?.(room, sender, body);
      } else {
        // Tin nhắn 1-1
        this.onMessage?.({
          id:
            attrs.id ||
            `${attrs.from}:${timestamp}:${body}`,
          from: attrs.from,
          to: attrs.to || "",
          body,
          timestamp,
        });
      }
    });
  }

  // Phương thức private: xử lý presence (trạng thái) từ buffer
  // Parse <presence>, gọi callback onPresence
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

  // Phương thức private: consume (xử lý và xóa) các match khỏi buffer
  // Parameters:
  //   - regex: biểu thức chính quy để tìm match
  //   - onMatch: callback xử lý mỗi match
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

    // Xóa tất cả các match đã xử lý khỏi buffer
    for (const value of consumed) {
      this.buffer = this.buffer.replace(value, "");
    }
  }

  // Phương thức private: cắt bỏ phần buffer cho đến token chỉ định
  // Parameters:
  //   - token: chuỗi token để cắt đến
  private dropThrough(token: string) {
    const index = this.buffer.indexOf(token);
    if (index < 0) return false;

    this.buffer = this.buffer.slice(index + token.length);
    return true;
  }

  // Phương thức private: thực hiện tất cả các yêu cầu join phòng đang chờ
  private flushRoomJoins() {
    const joins = this.pendingRoomJoins;
    this.pendingRoomJoins = [];

    for (const join of joins) {
      this.sendRoomJoin(join);
    }
  }

  // Phương thức private: bắt đầu timer keep-alive (gửi dấu cách mỗi 120 giây)
  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.state === "authenticated") {
        this.write(" ");   // Gửi khoảng trắng để giữ kết nối
      }
    }, 120_000);            // 120 giây
  }

  // Phương thức private: dừng timer keep-alive
  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // Phương thức private: gửi presence join phòng chat (MUC)
  // Parameters:
  //   - roomJid, token, nickname: thông tin phòng và người dùng
  private sendRoomJoin({ roomJid, token, nickname }: PendingRoomJoin) {
    if (this.joinedRooms.has(roomJid)) return;   // Đã join phòng này rồi
    this.write(
      `<presence to="${this.escapeXml(roomJid)}/${this.escapeXml(
        nickname
      )}"><x xmlns="http://jabber.org/protocol/muc"><password>${this.escapeXml(
        token
      )}</password></x></presence>`
    );
    this.joinedRooms.add(roomJid);
  }

  // Phương thức private: parse thuộc tính XML từ chuỗi raw
  // Parameters:
  //   - raw: chuỗi thuộc tính (vd: 'jid="user@domain" name="User"')
  // Returns: object { key: value } các thuộc tính
  private parseAttributes(raw: string) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=['"]([^'"]*)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(raw)) !== null) {
      attrs[match[1]] = this.unescapeXml(match[2]);
    }

    return attrs;
  }

  // Phương thức private: ghi dữ liệu XML vào socket
  // Parameters:
  //   - xml: chuỗi XML cần gửi
  // Returns: true nếu gửi thành công, false nếu client null
  private write(xml: string) {
    if (XMPP_VERBOSE_LOGGING) {
      console.log("[XMPP] TX", this.redact(xml));   // Log dữ liệu gửi đi (đã che token)
    }
    const socket = this.client;
    if (!socket || socket.destroyed) return false;

    try {
      socket.write(xml, "utf8", (error?: Error) => {
        if (error) {
          this.markSocketFailed(socket, error);
        }
      });
      return true;
    } catch (error) {
      this.markSocketFailed(socket, error);
      return false;
    }
  }

  private markSocketFailed(socket: any, error: unknown) {
    if (this.client !== socket) return;

    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[XMPP] Socket closed; reconnecting", message);
    }
    this.client = null;
    this.stopKeepAlive();

    try {
      if (!socket.destroyed) {
        socket.destroy();
      }
    } catch {
      // Socket đã đóng; reconnect vẫn phải tiếp tục.
    }

    this.setState("error");
  }

  // Phương thức private: cập nhật trạng thái kết nối và gọi callback
  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChange?.(newState);
  }

  // Phương thức private: che giấu thông tin nhạy cảm (token) trong log
  // Parameters:
  //   - value: chuỗi XML cần che token
  // Returns: chuỗi đã được che rso_token, pas_token, token
  private redact(value: string) {
    return value
      .replace(/<rso_token>[\s\S]*?<\/rso_token>/g, "<rso_token>[redacted]</rso_token>")
      .replace(/<pas_token>[\s\S]*?<\/pas_token>/g, "<pas_token>[redacted]</pas_token>")
      .replace(/<token xmlns="">[\s\S]*?<\/token>/g, '<token xmlns="">[redacted]</token>');
  }

  // Phương thức private: chuyển đổi JID thành dạng bare (không resource)
  // Parameters:
  //   - value: JID đầy đủ (user@domain/resource hoặc user@domain hoặc user)
  // Returns: JID dạng user@domain
  private toBareJid(value: string) {
    const bareValue = value.split("/")[0];               // Bỏ phần resource sau dấu /
    return bareValue.includes("@")
      ? bareValue
      : `${bareValue}@${this.xmppDomain}`;               // Thêm domain nếu thiếu
  }

  // Phương thức private: lấy timestamp từ tin nhắn
  // Ưu tiên: delay timestamp > numeric ID > Date.now()
  // Parameters:
  //   - attrs: thuộc tính XML của message
  //   - content: nội dung XML của message
  // Returns: timestamp (milliseconds)
  private getMessageTimestamp(
    attrs: Record<string, string>,
    content: string
  ) {
    // Thử lấy timestamp từ delay/x element (lịch sử tin nhắn)
    const delayMatch = /<(?:delay|x)\b[^>]*stamp=['"]([^'"]+)['"][^>]*\/?>(?:<\/(?:delay|x)>)?/.exec(
      content
    );
    if (delayMatch) {
      const parsedDelay = Date.parse(delayMatch[1]);
      if (Number.isFinite(parsedDelay)) return parsedDelay;
    }

    // Fallback: lấy timestamp từ numeric ID (format: timestamp:counter)
    const numericId = attrs.id?.split(":")[0];
    if (numericId && /^\d+$/.test(numericId)) {
      const parsedId = Number(numericId);
      return parsedId < 10_000_000_000 ? parsedId * 1000 : parsedId;
    }

    // Fallback cuối: thời gian hiện tại
    return Date.now();
  }

  // Phương thức private: escape ký tự đặc biệt XML
  // Parameters:
  //   - unsafe: chuỗi cần escape
  // Returns: chuỗi đã escape (<> & '" -> &lt; &gt; &amp; &apos; &quot;)
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

  // Phương thức private: unescape ký tự XML (ngược với escapeXml)
  // Parameters:
  //   - value: chuỗi đã escape XML
  // Returns: chuỗi đã được unescape
  private unescapeXml(value: string) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }
}
