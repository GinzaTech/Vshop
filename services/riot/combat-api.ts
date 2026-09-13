import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { CurrentGameMatchResponse, PartyResponse } from "~/services/riot/api-types";
import { API_DEBUG_LOGGING, extraHeaders } from "~/services/riot/request-context";

/** Lấy MatchID trận pregame hiện tại (GET pregame/v1/players/:userId).
 *  Được lockAgent/selectAgent/quit tái dùng để biết trận đang chờ.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @returns UUID trận pregame. Throw khi HTTP lỗi (axios mặc định). */
export async function getMatchID(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const res = await axios.request<PreGamePlayerResponse>({
    url: buildRiotApiUrl({ name: "matchID", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.data.MatchID;
}

/** Lock (khóa vĩnh viễn) agent trong pregame — POST pregame/.../lock/:agentId.
 *  LƯU Ý: hành động THAY ĐỔI tài khoản — chỉ gọi từ nút UI rõ ràng.
 *  Lấy MatchID mới nhất qua getMatchID trước khi gọi.
 *  @param agentId - UUID agent muốn khóa.
 *  @returns LockCharacterResponse từ Riot. */
export async function lockAgent(
  accesstoken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);

  const res = await axios.request<LockCharacterResponse>({
    url: buildRiotApiUrl({ name: "lock", region: region, matchId: matchId, agentId: agentId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

/** Thoát pregame lobby — POST pregame/v1/matches/:matchId/quit.
 *  Hành động thay đổi tài khoản; MatchID được tra mới qua getMatchID.
 *  @returns Payload của Riot (thường rỗng). Throw khi HTTP lỗi. */
export async function quitPreGameLobby(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: buildRiotApiUrl({ name: "quit", region: region, matchId: matchId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

// ---------------------------------------------------------------------------
// Pre-game (trước trận đấu)
// ---------------------------------------------------------------------------
/** Lấy thông tin người chơi trong pregame (MatchID trận đang chờ chọn agent).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @returns { Subject, MatchID, Version } khi HTTP 200; null khi không
 *  ở trong pregame hoặc lỗi (validateStatus nên không throw). */
export async function getPreGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<PreGamePlayerResponse>({
    url: buildRiotApiUrl({ name: "pregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

/** Lấy chi tiết trận pregame (đội, agent đồng đội đã chọn...).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param matchId - UUID trận pregame.
 *  @returns LockCharacterResponse khi HTTP 200; null khi lỗi/không có trận. */
export async function getPreGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<LockCharacterResponse | null> {
  const res = await axios.request<LockCharacterResponse>({
    url: buildRiotApiUrl({ name: "pregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

/** Chọn (chưa khóa) agent trong pregame — POST .../select/:agentId.
 *  Hành động thay đổi tài khoản: chỉ gọi từ tương tác UI của người dùng.
 *  @param agentId - UUID agent muốn chọn.
 *  @returns Payload khi HTTP 200; null khi lỗi (không throw). */
export async function selectAgent(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string
): Promise<unknown> {
  const matchId = await getMatchID(accessToken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: buildRiotApiUrl({ name: "select-agent", region, matchId, agentId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Core-game (trận đấu đang diễn ra)
// ---------------------------------------------------------------------------
/** Lấy thông tin người chơi trong trận đang diễn ra (core-game player).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @returns { Subject, MatchID, Version } khi HTTP 200; null khi không
 *  trong trận (validateStatus nên không throw). */
export async function getCurrentGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<{ Subject: string; MatchID: string; Version: number }>({
    url: buildRiotApiUrl({ name: "coregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

/** Lấy chi tiết trận đang diễn ra (players, loadout, character selectors...).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param matchId - UUID trận core-game.
 *  @returns CurrentGameMatchResponse khi HTTP 200; null khi lỗi. */
export async function getCurrentGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameMatchResponse | null> {
  const res = await axios.request<CurrentGameMatchResponse>({
    url: buildRiotApiUrl({ name: "coregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party (nhóm chơi)
// ---------------------------------------------------------------------------
/** Lấy thông tin party của người chơi (chứa CurrentPartyID hiện tại).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @returns Payload kèm CurrentPartyID khi HTTP 200; null khi không
 *  có party/lỗi (validateStatus nên không throw). */
export async function getPartyPlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<({ CurrentPartyID: string } & Record<string, unknown>) | null> {
  const url = buildRiotApiUrl({ name: "party-player", region, userId });
  const res = await axios.request<
    { CurrentPartyID: string } & Record<string, unknown>
  >({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (API_DEBUG_LOGGING) {
    console.log("[party-player] response", {
      status: res.status,
      url,
      userId,
      currentPartyId: res.data?.CurrentPartyID || null,
      data: res.status === 200 ? undefined : res.data,
    });
  }
  return res.status === 200 ? res.data : null;
}

/** Lấy chi tiết party theo ID (members, MUCName, State...).
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param partyId - UUID party (đi vào slot matchId của endpoints).
 *  @returns PartyResponse khi HTTP 200; null khi lỗi/không có party. */
export async function getParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const url = buildRiotApiUrl({ name: "party", region, matchId: partyId });  // tái sử dụng matchId slot để truyền partyId
  const res = await axios.request<PartyResponse>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (API_DEBUG_LOGGING) {
    console.log("[party] response", {
      status: res.status,
      url,
      partyId,
      hasParty: res.status === 200,
      mucName: res.status === 200 ? res.data?.MUCName : undefined,
      members: res.status === 200 ? res.data?.Members?.length || 0 : 0,
    });
  }
  return res.status === 200 ? res.data : null;
}

/** Lấy MUC token cho party chat XMPP. Throw Error khi HTTP ≠ 200
 *  (kèm message/errorCode từ Riot) — khác các hàm trả null cùng file.
 *  @param partyId - UUID party cần token chat.
 *  @returns PartyChatTokenResponse (Token không được log — đã redact). */
export async function getPartyMucToken(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyChatTokenResponse | null> {
  const url = buildRiotApiUrl({ name: "party-muc-token", region, matchId: partyId });
  const res = await axios.request<PartyChatTokenResponse>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const responseData: PartyChatTokenResponse | { message?: string; errorCode?: string } =
    res.data;
  // Che token trong log
  const logData =
    responseData && typeof responseData === "object"
      ? {
          ...responseData,
          Token:
            "Token" in responseData && responseData.Token
              ? "[redacted]"
              : undefined,
        }
      : responseData;
  if (API_DEBUG_LOGGING) console.log("[party-muc-token] response", {
    status: res.status,
    url,
    partyId,
    data: logData,
  });
  if (res.status !== 200) {
    const message =
      ("message" in responseData ? responseData.message : undefined) ||
      ("errorCode" in responseData ? responseData.errorCode : undefined) ||
      `HTTP ${res.status}`;
    throw new Error(`Could not get party chat token (${res.status}: ${message})`);
  }
  return res.data;
}

/** Bật/tắt trạng thái sẵn sàng trong party — POST .../setReady.
 *  @param ready - true = ready, false = unready.
 *  @returns PartyResponse khi HTTP 200; null khi lỗi (không throw). */
export async function setPartyReady(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string,
  userId: string,
  ready: boolean
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: buildRiotApiUrl({ name: "party-ready", region, matchId: partyId, userId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: { ready },
  });
  return res.status === 200 ? res.data : null;
}

/** Tạo (bật) mã mời party — POST parties/v1/parties/:id/invitecode.
 *  @param partyId - UUID party của host.
 *  @returns PartyResponse khi HTTP 200; null khi lỗi (không throw). */
export async function generatePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: buildRiotApiUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

/** Xóa (tắt) mã mời party — DELETE cùng endpoint invitecode.
 *  @param partyId - UUID party của host.
 *  @returns PartyResponse khi HTTP 200; null khi lỗi (không throw). */
export async function disablePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: buildRiotApiUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

/** Tham gia party bằng mã mời — POST parties/v1/players/joinbycode/:code.
 *  @param inviteCode - Mã mời (được encodeURIComponent khi build URL).
 *  @returns Payload kèm CurrentPartyID (nếu join OK) khi HTTP 200;
 *  null khi mã sai/hết hạn/lỗi khác (không throw). */
export async function joinPartyByCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  inviteCode: string
): Promise<({ CurrentPartyID?: string } & Record<string, unknown>) | null> {
  const res = await axios.request<
    { CurrentPartyID?: string } & Record<string, unknown>
  >({
    url: buildRiotApiUrl({
      name: "party-join-by-code",
      region,
      code: encodeURIComponent(inviteCode),
    }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Pre-Game Loadouts (trang bị trong pregame)
// ---------------------------------------------------------------------------
/** Lấy loadout (skin) của TẤT CẢ người chơi trong trận pregame.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param matchId - UUID trận pregame.
 *  @returns PregameLoadoutsResponse khi HTTP 200; null khi lỗi. */
export async function getPregameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<PregameLoadoutsResponse | null> {
  const res = await axios.request<PregameLoadoutsResponse>({
    url: buildRiotApiUrl({ name: "pregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Current Game Loadouts (trang bị trong trận đang diễn ra)
// ---------------------------------------------------------------------------
/** Lấy loadout (skin) của TẤT CẢ người chơi trong trận đang diễn ra.
 *  @param accessToken - Bearer token. @param entitlementsToken - JWT quyền.
 *  @param matchId - UUID trận core-game.
 *  @returns CurrentGameLoadoutsResponse khi HTTP 200; null khi lỗi. */
export async function getCurrentGameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameLoadoutsResponse | null> {
  const res = await axios.request<CurrentGameLoadoutsResponse>({
    url: buildRiotApiUrl({ name: "coregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Quit Current Game (thoát trận đang diễn ra)
// ---------------------------------------------------------------------------
/** Thoát trận đang diễn ra — POST core-game/v1/matches/:matchId/quit.
 *  Hành động thay đổi tài khoản: chỉ gọi từ UI có xác nhận của user.
 *  @param matchId - UUID trận core-game.
 *  @returns Payload khi HTTP 200; null khi lỗi (không throw). */
export async function quitCurrentGame(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<unknown> {
  const res = await axios.request({
    url: buildRiotApiUrl({ name: "coregame-quit", region, matchId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Remove Player (xóa người chơi khỏi party)
// ---------------------------------------------------------------------------
/** Rời khỏi party hiện tại — DELETE parties/v1/players/:userId.
 *  Khác các hàm trả null: throw Error khi status ngoài 2xx — caller cần
 *  biết rõ rời party thất bại để rollback UI.
 *  @param userId - PUUID của người rời party (chính mình).
 *  @returns void khi thành công. */
export async function removeFromParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<void> {
  const res = await axios.request({
    url: buildRiotApiUrl({ name: "party-remove", region, userId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Could not leave party (HTTP ${res.status})`);
  }
}

// ---------------------------------------------------------------------------
// Party: Enter Matchmaking Queue (vào hàng chờ)
// ---------------------------------------------------------------------------
/** Vào hàng chờ matchmaking cho party — POST .../matchmaking/join.
 *  Hành động thay đổi tài khoản (bắt đầu tìm trận).
 *  @param partyId - UUID party (host thực hiện).
 *  @returns PartyResponse khi HTTP 200; null khi lỗi (không throw). */
export async function enterMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: buildRiotApiUrl({ name: "party-join-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Leave Matchmaking Queue (rời hàng chờ)
// ---------------------------------------------------------------------------
/** Rời hàng chờ matchmaking — POST .../matchmaking/leave.
 *  Hành động thay đổi tài khoản (hủy tìm trận).
 *  @param partyId - UUID party.
 *  @returns PartyResponse khi HTTP 200; null khi lỗi (không throw). */
export async function leaveMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: buildRiotApiUrl({ name: "party-leave-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}
