import { create } from "zustand";
import {
  CurrentGameMatchResponse,
  getCurrentGameMatch,
  getCurrentGamePlayer,
  getParty,
  getPartyPlayer,
  getPreGameMatch,
  getPreGamePlayer,
  PartyResponse,
  getPlayerNames,
  defaultUser,
} from "~/utils/valorant-api";

type CombatUser = Pick<
  typeof defaultUser,
  "accessToken" | "entitlementsToken" | "id" | "region"
>;

type PreGameMatchResponse = NonNullable<
  Awaited<ReturnType<typeof getPreGameMatch>>
>;

// --- Kiểu dữ liệu cho snapshot trạng thái chiến đấu hiện tại ---
// state: trạng thái phiên (idle: không có gì, pregame: đang chờ, live: đang đánh)
// matchId: ID của trận đấu (nếu có)
// partyId: ID của party (nếu có)
// pregameMatch: dữ liệu trận pregame (LockCharacterResponse)
// currentGameMatch: dữ liệu trận đang live
// party: dữ liệu party hiện tại
// namesBySubject: map từ subject -> tên hiển thị (GameName#TagLine)
export type CombatSessionSnapshot = {
  state: "idle" | "pregame" | "live";
  matchId: string | null;
  partyId: string | null;
  pregameMatch: PreGameMatchResponse | null;
  currentGameMatch: CurrentGameMatchResponse | null;
  party: PartyResponse | null;
  namesBySubject: Record<string, string>;
};

// Giá trị mặc định rỗng cho snapshot — dùng khi chưa có phiên chiến đấu hoặc có lỗi
const EMPTY_SESSION: CombatSessionSnapshot = {
  state: "idle",
  matchId: null,
  partyId: null,
  pregameMatch: null,
  currentGameMatch: null,
  party: null,
  namesBySubject: {},
};

// --- Định nghĩa store quản lý trạng thái chiến đấu (Combat) ---
// snapshot: dữ liệu snapshot phiên hiện tại
// loading: đang tải dữ liệu hay không
// lastUpdated: thời gian (ms) cập nhật cuối cùng
// fetchSession(user): async action — lấy dữ liệu party/pregame/live + tên người chơi
interface CombatState {
  snapshot: CombatSessionSnapshot;
  loading: boolean;
  lastUpdated: number;
  sessionKey: string | null;
  fetchSession: (user: CombatUser) => Promise<CombatSessionSnapshot>;
}

let latestCombatRequestId = 0;
const combatRequests = new Map<string, Promise<CombatSessionSnapshot>>();

const getCombatSessionKey = (user: CombatUser) =>
  `${user.region.toLowerCase()}|${user.id.toLowerCase()}`;

// --- Tạo Zustand store cho Combat ---
// Khởi tạo: snapshot rỗng, loading = false, lastUpdated = 0
// fetchSession: gọi API lấy party, pregame, currentGame, gộp tên người chơi,
//              xác định trạng thái (idle/pregame/live) và cập nhật snapshot
export const useCombatStore = create<CombatState>((set, get) => ({
  /** Trạng thái snapshot phiên chiến đấu hiện tại */
  snapshot: EMPTY_SESSION,
  /** Đang loading dữ liệu từ API */
  loading: false,
  /** Timestamp cập nhật gần nhất */
  lastUpdated: 0,
  /** Phiên sở hữu snapshot hiện tại; ngăn dữ liệu tài khoản cũ bị giữ lại. */
  sessionKey: null,

  /** Lấy dữ liệu phiên chiến đấu từ Riot API
   * @param user - đối tượng user chứa token, region, id
   * @returns Promise<CombatSessionSnapshot> snapshot sau khi fetch
   */
  fetchSession: async (user) => {
    // Nếu thiếu token hoặc thông tin user -> reset về rỗng và thoát
    if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
      latestCombatRequestId += 1;
      set({ snapshot: EMPTY_SESSION, loading: false, sessionKey: null });
      return EMPTY_SESSION;
    }

    const sessionKey = getCombatSessionKey(user);
    const pendingRequest = combatRequests.get(sessionKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const requestId = ++latestCombatRequestId;
    const currentState = get();
    set({
      loading: true,
      sessionKey,
      snapshot:
        currentState.sessionKey && currentState.sessionKey !== sessionKey
          ? EMPTY_SESSION
          : currentState.snapshot,
    });

    let request!: Promise<CombatSessionSnapshot>;
    request = (async () => {
      try {
      // Gọi song song 3 API để lấy thông tin cơ bản của user trong party/pregame/live
      const [partyPlayer, pregamePlayer, currentGamePlayer] = await Promise.all([
        getPartyPlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
        getPreGamePlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
        getCurrentGamePlayer(user.accessToken, user.entitlementsToken, user.region, user.id),
      ]);

      // Từ kết quả trên, gọi song song chi tiết party, pregame match, current game match
      const partyId = partyPlayer?.CurrentPartyID || null;
      const [party, pregameMatch, currentGameMatch] = await Promise.all([
        partyId
          ? getParty(user.accessToken, user.entitlementsToken, user.region, partyId)
          : Promise.resolve(null),
        pregamePlayer?.MatchID
          ? getPreGameMatch(user.accessToken, user.entitlementsToken, user.region, pregamePlayer.MatchID)
          : Promise.resolve(null),
        currentGamePlayer?.MatchID
          ? getCurrentGameMatch(user.accessToken, user.entitlementsToken, user.region, currentGamePlayer.MatchID)
          : Promise.resolve(null),
      ]);
      // Party ID thực tế (có thể null nếu không có party)
      const effectivePartyId = party?.ID || null;

      // Log debug trong môi trường dev
      if (__DEV__) {
        console.log("[useCombatStore] session party snapshot", {
          partyPlayerId: partyId,
          partyId: effectivePartyId,
          hasParty: Boolean(party),
          mucName: party?.MUCName,
          state: party?.State,
          members: party?.Members?.length || 0,
        });
      }

      // Gom tất cả subject (định danh người chơi) từ party, pregame, live match thành Set duy nhất
      const subjects = Array.from(
        new Set(
          [
            ...(party?.Members || []).map((member) => member.Subject),
            ...(pregameMatch?.AllyTeam?.Players || []).map((player) => player.Subject),
            ...(pregameMatch?.EnemyTeam?.Players || []).map((player) => player.Subject),
            ...(currentGameMatch?.Players || []).map((player) => player.Subject),
          ]
            .filter((subject): subject is string => Boolean(subject))
            .map((s) => s.toLowerCase())
        )
      );

      // Nếu có subject, gọi API lấy tên hiển thị (GameName#TagLine)
      const names = subjects.length
        ? await getPlayerNames(user.accessToken, user.entitlementsToken, subjects, user.region)
        : [];

      // Convert danh sách tên thành map subject -> "GameName#TagLine" để tra cứu nhanh
      const namesBySubject = Object.fromEntries(
        names.map((entry) => [
          entry.Subject.toLowerCase(),
          entry.TagLine ? `${entry.GameName}#${entry.TagLine}` : entry.GameName,
        ])
      );

      // Xác định snapshot dựa trên ưu tiên: pregame > live > idle (chỉ có party)
      // - Nếu có pregameMatch -> state = "pregame"
      // - Nếu có currentGameMatch -> state = "live"
      // - Nếu không có gì -> state = "idle", giữ lại party & names nếu có
      const nextSnapshot: CombatSessionSnapshot = pregameMatch
        ? {
            state: "pregame",
            matchId: pregamePlayer?.MatchID || pregameMatch.ID || null,
            partyId: effectivePartyId,
            pregameMatch,
            currentGameMatch: null,
            party,
            namesBySubject,
          }
        : currentGameMatch
          ? {
              state: "live",
              matchId: currentGamePlayer?.MatchID || currentGameMatch.MatchID || null,
              partyId: effectivePartyId,
              pregameMatch: null,
              currentGameMatch,
              party,
              namesBySubject,
            }
            : {
              ...EMPTY_SESSION,
              partyId: effectivePartyId,
              party,
              namesBySubject,
            };

      // Cập nhật store và trả về snapshot
      if (requestId === latestCombatRequestId) {
        set({
          snapshot: nextSnapshot,
          loading: false,
          lastUpdated: Date.now(),
          sessionKey,
        });
      }
      return nextSnapshot;
      } catch (error) {
        // Lỗi mạng tạm thời không được xóa snapshot tốt đang hiển thị.
        if (__DEV__) console.warn("[useCombatStore] Failed to fetch session", error);
        if (requestId === latestCombatRequestId) {
          set({ loading: false });
          return get().snapshot;
        }
        return EMPTY_SESSION;
      } finally {
        if (combatRequests.get(sessionKey) === request) {
          combatRequests.delete(sessionKey);
        }
      }
    })();

    combatRequests.set(sessionKey, request);
    return request;
  },
}));
