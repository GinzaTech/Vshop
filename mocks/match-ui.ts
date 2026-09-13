// ===== match-ui.ts (mocks) – Dữ liệu mẫu cho màn hình trận & lịch sử =====
// Dùng cho Storybook/preview/dev harness. Ảnh agent/vũ khí lấy trực tiếp
// từ CDN media.valorant-api.com nên hiển thị y như dữ liệu thật.

import type {
  MatchDetailViewModel,
  MatchHistoryRecord,
  MatchPlayerRef,
  PlayerMatchPerformance,
  RoundDetail,
  ScoreboardPlayer,
  WeaponPerformance,
} from "~/types/match-ui";

/** MOCK_MATCH_ID – ID của trận mock đầu tiên (khớp mockMatchDetail.match.id). */
export const MOCK_MATCH_ID = "mock-match-001";

// 10 agent thật (uuid từ valorant-api.com) — 5 cho team A, 5 cho team B.
const AGENTS = [
  ["601dbbe7-43ce-be57-2a40-4abd24953621", "KAY/O"],
  ["add6443a-41bd-e414-f6ad-e58d267f4e95", "Jett"],
  ["569fdd95-4d10-43ab-ca70-79becc718b46", "Sage"],
  ["320b2a48-4d9b-a075-30f1-1f93a9b638fa", "Sova"],
  ["a3bfb853-43b2-7238-a4f1-ad90e9e46bcc", "Reyna"],
  ["eb93336a-449b-9c1b-0a54-a891f7921d69", "Phoenix"],
  ["8e253930-4c05-31dd-1b6c-968525494517", "Omen"],
  ["f94c3b30-42be-e959-889c-5aa313dba261", "Raze"],
  ["117ed9e3-49f3-6512-3ccf-0cada7e3823b", "Cypher"],
  ["5f8d3a7f-467b-97f3-062c-13acf203c006", "Breach"],
] as const;

// Tên người chơi mẫu; phần tử đầu tiên là "chính mình" (isCurrentUser).
const PLAYER_NAMES = [
  "KONA#004",
  "Sry my bad#SEA",
  "Amigo#777",
  "Hoc Tai Thi Xiu#VN2",
  "JusthmeXX#0001",
  "Snow#A01",
  "Mochi#0505",
  "No Signal#404",
  "Coffee First#ACE",
  "Quiet Aim#GG",
] as const;

// UUID vũ khí thật để sinh ảnh displayicon (Phantom, Vandal, Operator).
const PHANTOM_ID = "63e6c2b6-4a8e-869c-4371-06c05d3d7bc4";
const VANDAL_ID = "9c82e19d-4575-0200-1a81-3eacf00cf872";
const OPERATOR_ID = "a03b24d3-4319-996d-0f8c-94bbfba1dfc7";

/** agentImage – URL ảnh agent theo kind (displayicon | fullportrait). */
const agentImage = (agentId: string, kind: "displayicon" | "fullportrait") =>
  `https://media.valorant-api.com/agents/${agentId}/${kind}.png`;

/** weaponImage – URL ảnh displayicon của vũ khí theo uuid. */
const weaponImage = (weaponId: string) =>
  `https://media.valorant-api.com/weapons/${weaponId}/displayicon.png`;

/**
 * mockPlayers – 10 scoreboard player sinh theo quy luật: chỉ số giảm dần
 * theo index (kill/acs/adr...), index < 5 thuộc team A, index 0 là người dùng.
 */
const mockPlayers: ScoreboardPlayer[] = AGENTS.map(([agentId, agentName], index) => {
  const kills = Math.max(5, 24 - index * 2);
  const deaths = 10 + index;
  const assists = 3 + (index % 6);
  const acs = 296 - index * 18;
  return {
    playerId: index === 0 ? "mock-kona" : `mock-player-${index + 1}`,
    playerName: PLAYER_NAMES[index],
    team: index < 5 ? "A" : "B",
    agent: {
      name: agentName,
      iconUrl: agentImage(agentId, "displayicon"),
    },
    rank: {
      name: index < 4 ? "Diamond 1" : "Platinum 2",
    },
    trs: 473 - index * 22,
    acs,
    kills,
    deaths,
    assists,
    plusMinus: kills - deaths,
    kd: kills / deaths,
    adr: 184 - index * 9.3,
    dda: 47 - index * 13,
    kast: 82 - index * 3.1,
    headshotPercent: 31 - index * 1.8,
    firstKills: Math.max(0, 5 - Math.floor(index / 2)),
    firstDeaths: Math.floor(index / 2),
    multiKills: Math.max(0, 8 - index),
    economyRating: 88 - index * 5,
    isCurrentUser: index === 0,
  };
});

/** mockPlayerRefs – Danh sách tham chiếu gọn từ mockPlayers (cho UI phụ). */
const mockPlayerRefs: MatchPlayerRef[] = mockPlayers.map((player) => ({
  playerId: player.playerId,
  playerName: player.playerName,
  team: player.team,
  agentName: player.agent.name,
  agentIconUrl: player.agent.iconUrl,
  isCurrentUser: Boolean(player.isCurrentUser),
}));

/**
 * mockRounds – 25 round sinh theo chu kỳ: đội thắng, side attack/defense,
 * kết thức round và 2 sự kiện (1 kill + round_end) xoay quanh "mock-kona".
 */
const mockRounds: RoundDetail[] = Array.from({ length: 25 }, (_, index) => {
  const winningTeam = index % 5 === 2 || index % 7 === 0 ? "B" : "A";
  const teamAKills = index % 3 === 0 ? 2 : 1;
  return {
    roundNumber: index + 1,
    winningTeam,
    sideForTeamA:
      index < 12 || (index >= 24 && index % 2 === 0) ? "defense" : "attack",
    outcome:
      index % 6 === 0
        ? "spike_defused"
        : index % 4 === 0
          ? "spike_detonated"
          : "elimination",
    durationSeconds: 72 + (index % 5) * 9,
    teamAEconomy: 12_000 + ((index * 2_900) % 17_000),
    teamBEconomy: 10_500 + ((index * 3_700) % 18_000),
    events: [
      {
        id: `mock-round-${index + 1}-kill-1`,
        timestampSeconds: 28,
        type: "kill",
        actorPlayerId: teamAKills > 0 ? "mock-kona" : "mock-player-6",
        targetPlayerId: winningTeam === "A" ? "mock-player-6" : "mock-kona",
        weaponId: PHANTOM_ID,
        headshot: index % 2 === 0,
      },
      {
        id: `mock-round-${index + 1}-end`,
        timestampSeconds: 72 + (index % 5) * 9,
        type: "round_end",
      },
    ],
  };
});

/** mockWeapons – Hiệu suất 3 vũ khí chính (Phantom/Vandal/Operator). */
const mockWeapons: WeaponPerformance[] = [
  {
    weaponId: PHANTOM_ID,
    weaponName: "Phantom",
    weaponImageUrl: weaponImage(PHANTOM_ID),
    kills: 13,
    damage: 2_146,
  },
  {
    weaponId: VANDAL_ID,
    weaponName: "Vandal",
    weaponImageUrl: weaponImage(VANDAL_ID),
    kills: 7,
    damage: 1_188,
  },
  {
    weaponId: OPERATOR_ID,
    weaponName: "Operator",
    weaponImageUrl: weaponImage(OPERATOR_ID),
    kills: 4,
    damage: 602,
  },
];

/**
 * buildMockPerformance – Dựng PlayerMatchPerformance cho một player:
 * summary từ scoreboard, sideStats chia defense/attack theo tỉ lệ cố định,
 * danh sách đối đầu với team kia và bảng vũ khí dùng chung.
 */
const buildMockPerformance = (
  player: ScoreboardPlayer,
  index: number
): PlayerMatchPerformance => {
  const agent = AGENTS[index];
  const opponents = mockPlayers
    .filter((candidate) => candidate.team !== player.team)
    .map((opponent, opponentIndex) => ({
      opponentPlayerId: opponent.playerId,
      opponentAgentName: opponent.agent.name,
      opponentAgentIconUrl: opponent.agent.iconUrl,
      killsAgainst: Math.max(0, 4 - opponentIndex),
      deathsAgainst: 1 + opponentIndex,
      damageDealt: 580 - opponentIndex * 71,
      damageTaken: 240 + opponentIndex * 96,
    }));

  return {
    summary: {
      playerId: player.playerId,
      playerName: player.playerName,
      agentName: player.agent.name,
      agentFullImageUrl: agent
        ? agentImage(agent[0], "fullportrait")
        : undefined,
      rankName: player.rank?.name || "Unrated",
      rankIconUrl: player.rank?.iconUrl,
      averageScore: player.acs,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      kd: player.kd,
      adr: player.adr,
    },
    sideStats: {
      defense: {
        kills: Math.ceil(player.kills * 0.58),
        deaths: Math.ceil(player.deaths * 0.52),
        assists: Math.ceil(player.assists * 0.55),
        kd: player.kd + 0.12,
      },
      attack: {
        kills: Math.floor(player.kills * 0.42),
        deaths: Math.floor(player.deaths * 0.48),
        assists: Math.floor(player.assists * 0.45),
        kd: Math.max(0, player.kd - 0.16),
      },
    },
    opponents,
    weapons: mockWeapons,
  };
};

/**
 * mockMatchDetail – ViewModel chi tiết trận mock hoàn chỉnh:
 * 13–11 trên Breeze, 25 round, kinh tế theo round và performance 10 người.
 */
export const mockMatchDetail: MatchDetailViewModel = {
  match: {
    id: MOCK_MATCH_ID,
    mode: "Competitive",
    mapName: "Breeze",
    startedAt: "2026-07-23T08:37:00+07:00",
    durationSeconds: 2_642,
    teamAScore: 14,
    teamBScore: 11,
    winningTeam: "A",
  },
  players: mockPlayers,
  playerRefs: mockPlayerRefs,
  currentPlayerId: "mock-kona",
  economy: mockRounds.map((round, index) => ({
    roundNumber: round.roundNumber,
    teamAEconomy: round.teamAEconomy,
    teamBEconomy: round.teamBEconomy,
    teamASpent: 4_000 + ((index * 1_700) % 13_000),
    teamBSpent: 3_400 + ((index * 2_100) % 14_000),
    difference: round.teamAEconomy - round.teamBEconomy,
    winningTeam: round.winningTeam,
    outcome: round.outcome,
  })),
  rounds: mockRounds,
  playerPerformance: Object.fromEntries(
    mockPlayers.map((player, index) => [
      player.playerId,
      buildMockPerformance(player, index),
    ])
  ),
};

// Mốc thời gian trận mock đầu tiên; các trận sau cách nhau 4.5 giờ.
const MOCK_START = new Date("2026-07-23T08:37:00+07:00").getTime();

/**
 * mockMatchHistory – 8 bản ghi lịch sử ranked mock: xen kẽ thắng/thua,
 * chỉ số giảm dần theo index, xoay vòng agent/map; bản ghi đầu trùng MOCK_MATCH_ID.
 */
export const mockMatchHistory: MatchHistoryRecord[] = Array.from(
  { length: 8 },
  (_, index) => {
    const won = index % 3 !== 1;
    const kills = 21 - index;
    const deaths = 12 + index;
    const assists = 4 + (index % 5);
    const roundsWon = won ? 13 : 8 + (index % 4);
    const roundsLost = won ? 7 + (index % 5) : 13;
    const [agentId, agentName] = AGENTS[index % AGENTS.length];

    return {
      MatchID: index === 0 ? MOCK_MATCH_ID : `mock-match-${index + 1}`,
      GameStartTime: MOCK_START - index * 4.5 * 60 * 60 * 1000,
      QueueID: "competitive",
      stats: {
        kda: `${kills}/${deaths}/${assists}`,
        kills,
        deaths,
        assists,
        score: (248 - index * 11) * (roundsWon + roundsLost),
        acs: 248 - index * 11,
        adr: 171 - index * 7,
        kd: kills / deaths,
        kdRatio: (kills / deaths).toFixed(2),
        headshotPercent: 29 - index,
        headshotPct: `${29 - index}%`,
        placement: 1 + index,
        roundsPlayed: roundsWon + roundsLost,
        won,
        roundsWon,
        roundsLost,
        agentIcon: agentImage(agentId, "displayicon"),
        agentId,
        agentName,
        agentPortrait: agentImage(agentId, "fullportrait"),
        mapId: `mock-map-${index}`,
        mapName: ["Breeze", "Ascent", "Haven", "Lotus"][index % 4],
        mapImage: null,
        gameMode: "Competitive",
        rankTier: 18,
        rankName: "Diamond 1",
        rankIcon: null,
        rrEarned: won ? 18 : -16,
        rrAfter: 62,
        rrBefore: won ? 44 : 78,
        rrPerformanceBonus: won ? 3 : null,
        rrAfkPenalty: null,
        competitiveMovement: null,
      },
    };
  }
);
