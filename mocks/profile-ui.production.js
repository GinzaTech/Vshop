/* eslint-disable */
// Production keeps the Profile demo API callable without shipping fixture
// payloads. Every value is immutable and unauthenticated so the boundary fails
// closed if a production-only guard ever regresses.
const EMPTY_LIST = Object.freeze([]);
const EMPTY_RECORD = Object.freeze({});
const EMPTY_PROFILE_DEMO_DATA = Object.freeze({
  currentMatches: EMPTY_LIST,
  currentStats: null,
  seasonStatsById: EMPTY_RECORD,
  seasonMatchesById: EMPTY_RECORD,
  seasonOptions: EMPTY_LIST,
});

const getProfileDemoSeasonData = () => EMPTY_PROFILE_DEMO_DATA;

module.exports = Object.freeze({
  PROFILE_DEMO_USER: null,
  PROFILE_DEMO_RANK: null,
  getProfileDemoSeasonData,
});
