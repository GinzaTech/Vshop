import { riotApiClient as axios } from "~/services/riot/client";
import { buildRiotApiUrl } from "~/services/riot/endpoints";
import type { CurrentGameMatchResponse, PartyResponse } from "~/services/riot/api-types";
import { API_DEBUG_LOGGING, extraHeaders } from "~/services/riot/request-context";

// Export hàm lấy MatchID của trận đấu pregame (trước khi vào game)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực và người dùng
// Returns: Promise<string> UUID của trận đấu
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

// Export hàm lock (chọn) agent trong pregame lobby
// Parameters:
//   - accesstoken, entitlementsToken, userId, region: thông tin xác thực
//   - agentId: UUID của agent muốn chọn
// Returns: Promise<LockCharacterResponse>
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

// Export hàm thoát pregame lobby
// Parameters:
//   - accesstoken, entitlementsToken, region, userId: thông tin xác thực
// Returns: response payload or null
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
// Export hàm lấy thông tin người chơi trong pregame
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ Subject, MatchID, Version } | null>
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

// Export hàm lấy thông tin trận đấu pregame
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<LockCharacterResponse | null>
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

// Export hàm chọn agent (khóa) trong pregame
// Parameters:
//   - accessToken, entitlementsToken, userId, region: thông tin xác thực
//   - agentId: UUID agent muốn chọn
// Returns: response payload or null
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
// Export hàm lấy thông tin người chơi trong trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ Subject, MatchID, Version } | null>
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

// Export hàm lấy thông tin trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<CurrentGameMatchResponse | null>
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
// Export hàm lấy thông tin party của người chơi (gồm CurrentPartyID)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ CurrentPartyID, ... } | null>
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

// Export hàm lấy thông tin chi tiết party theo ID
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
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

// Export hàm lấy MUC token cho party chat (XMPP)
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyChatTokenResponse | null>
// Throw error nếu không lấy được token
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

// Export hàm set trạng thái ready/unready trong party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId, userId: thông tin xác thực
//   - ready: true = ready, false = unready
// Returns: Promise<PartyResponse | null>
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

// Export hàm tạo mã mời party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId: thông tin xác thực
// Returns: Promise<PartyResponse | null>
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

// Export hàm xóa mã mời party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId: thông tin xác thực
// Returns: Promise<PartyResponse | null>
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

// Export hàm tham gia party bằng mã mời
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - inviteCode: mã mời
// Returns: Promise<{ CurrentPartyID?, ... } | null>
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
// Export hàm lấy loadouts của người chơi trong pregame
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<PregameLoadoutsResponse | null>
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
// Export hàm lấy loadouts của người chơi trong trận đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<CurrentGameLoadoutsResponse | null>
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
// Export hàm thoát khỏi trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: response payload or null
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
// Export hàm xóa người chơi khỏi party
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<void>
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
// Export hàm tham gia hàng chờ matchmaking
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
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
// Export hàm rời khỏi hàng chờ matchmaking
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
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
