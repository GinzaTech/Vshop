import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { useCombatPlayerIntel } from "~/features/combat/useCombatPlayerIntel";
import { useCombatMatchPerformance } from "~/features/combat/useCombatMatchPerformance";
import { useRiotScreenSession } from "~/hooks/useRiotScreenSession";

const account = (id: string) => ({ id, region: "ap", accessToken: `access-${id}`, entitlementsToken: `ent-${id}` });
let mockUser = account("one");
let mockActive = true;
const isActiveNow = () => mockActive;
const mockContent = jest.fn();
const mockMMR = jest.fn();
const mockCompetitive = jest.fn();
const mockDetails = jest.fn();
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockUser }) } }));
jest.mock("~/utils/valorant-api", () => ({
  getContent: (...args: unknown[]) => mockContent(...args),
  getCompetitiveMMR: (...args: unknown[]) => mockMMR(...args),
  matchDetails: (...args: unknown[]) => mockDetails(...args),
}));
jest.mock("~/features/combat/session-insights", () => ({
  ...jest.requireActual("~/features/combat/session-insights"),
  fetchCompetitivePerformanceBatch: (...args: unknown[]) => mockCompetitive(...args),
}));
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));
const readyPerformance = { status: "ready", kd: 2, matches: 5, recentResults: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function Probe({ subjects = "one", matchId = "match", match = false }: { subjects?: string; matchId?: string; match?: boolean }) {
  const session = useRiotScreenSession(mockUser);
  const activity = { isActive: mockActive, isActiveNow };
  const intel = useCombatPlayerIntel(session, subjects, matchId, activity);
  const performance = useCombatMatchPerformance(session, subjects, matchId, match, activity);
  return <Text>{JSON.stringify({ ...intel, performance })}</Text>;
}

describe("combat data hook results", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const value = (): { playerIntel: Record<string, { status: string; currentRr: number | null }>; competitivePerformance: Record<string, { status: string; kd: number | null }>; performance: Record<string, { status: string }> } => JSON.parse(renderer.root.findByType(Text).props.children);
  const mount = async (props: React.ComponentProps<typeof Probe> = {}) => { await act(async () => { renderer = TestRenderer.create(<Probe {...props} />); }); };
  const update = async (props: React.ComponentProps<typeof Probe> = {}) => { await act(async () => { renderer.update(<Probe {...props} />); }); };
  beforeEach(() => {
    jest.useFakeTimers();
    mockUser = account("one");
    mockActive = true;
    mockContent.mockReset().mockResolvedValue({ Seasons: [] });
    mockMMR.mockReset().mockResolvedValue({ LatestCompetitiveUpdate: { TierAfterUpdate: 15, RankedRatingAfterUpdate: 55 } });
    mockCompetitive.mockReset().mockResolvedValue({ one: readyPerformance });
    mockDetails.mockReset().mockResolvedValue(null);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

  it("retains ready rank and competitive values when a resumed fetch fails", async () => {
    await mount();
    expect(value().playerIntel.one.currentRr).toBe(55);
    mockActive = false;
    await update();
    mockMMR.mockRejectedValue(new Error("temporary"));
    mockCompetitive.mockRejectedValue(new Error("temporary"));
    mockActive = true;
    await update();
    expect(value().playerIntel.one.currentRr).toBe(55);
    expect(value().competitivePerformance.one.kd).toBe(2);
  });

  it("ends initial match loading on request failure", async () => {
    mockDetails.mockRejectedValue(new Error("network"));
    await mount({ match: true });
    expect(value().performance.one.status).toBe("unavailable");
  });

  it("isolates individual rank errors and still fetches ranks if season content fails", async () => {
    mockContent.mockRejectedValue(new Error("network"));
    mockMMR.mockRejectedValueOnce(new Error("private")).mockResolvedValueOnce({ LatestCompetitiveUpdate: { TierAfterUpdate: 15, RankedRatingAfterUpdate: 55 } });
    mockCompetitive.mockRejectedValue(new Error("network"));
    await mount({ subjects: "one|two" });
    expect(value().playerIntel.one.status).toBe("private");
    expect(value().playerIntel.two.currentRr).toBe(55);
    expect(value().competitivePerformance.one.status).toBe("private");
  });

  it("does not apply old rank or competitive results after a token change", async () => {
    const oldRank = deferred<{ LatestCompetitiveUpdate: { TierAfterUpdate: number; RankedRatingAfterUpdate: number } }>();
    const oldComp = deferred<{ one: typeof readyPerformance }>();
    mockMMR.mockReturnValueOnce(oldRank.promise);
    mockCompetitive.mockReturnValueOnce(oldComp.promise);
    await mount();
    mockUser = { ...mockUser, entitlementsToken: "rotated" };
    mockMMR.mockResolvedValue({ LatestCompetitiveUpdate: { TierAfterUpdate: 15, RankedRatingAfterUpdate: 88 } });
    await update();
    await act(async () => {
      oldRank.resolve({ LatestCompetitiveUpdate: { TierAfterUpdate: 15, RankedRatingAfterUpdate: 99 } });
      oldComp.resolve({ one: { ...readyPerformance, kd: 99 } });
    });
    expect(value().playerIntel.one.currentRr).toBe(88);
    expect(value().competitivePerformance.one.kd).toBe(2);
  });

  it("ignores an old competitive failure after account change", async () => {
    const old = deferred<never>();
    mockCompetitive.mockReturnValueOnce(old.promise);
    await mount();
    mockUser = account("two");
    await update();
    await act(async () => { old.reject(new Error("old failure")); });
    expect(value().competitivePerformance.one.kd).toBe(2);
  });

  it("drops removed players and clears all results without credentials", async () => {
    await mount({ subjects: "one|two" });
    await update({ subjects: "two" });
    expect(value().playerIntel.one).toBeUndefined();
    await update({ subjects: "" });
    expect(value().playerIntel).toEqual({});
    mockUser = { ...mockUser, accessToken: "" };
    await update();
    expect(value().playerIntel).toEqual({});
    expect(value().competitivePerformance).toEqual({});
    expect(value().performance.one.status).toBe("unavailable");
  });

  it("does not overlap rank or competitive batches during a quick blur/refocus", async () => {
    const oldRank = deferred<{ LatestCompetitiveUpdate: { TierAfterUpdate: number; RankedRatingAfterUpdate: number } }>();
    const oldComp = deferred<{ one: typeof readyPerformance }>();
    mockMMR.mockReturnValueOnce(oldRank.promise);
    mockCompetitive.mockReturnValueOnce(oldComp.promise);
    await mount();
    mockActive = false;
    await update();
    mockActive = true;
    await update();
    expect(mockMMR).toHaveBeenCalledTimes(1);
    expect(mockCompetitive).toHaveBeenCalledTimes(1);
    await act(async () => {
      oldRank.resolve({ LatestCompetitiveUpdate: { TierAfterUpdate: 15, RankedRatingAfterUpdate: 99 } });
      oldComp.resolve({ one: { ...readyPerformance, kd: 99 } });
    });
    expect(mockMMR).toHaveBeenCalledTimes(2);
    expect(mockCompetitive).toHaveBeenCalledTimes(2);
    expect(value().playerIntel.one.currentRr).toBe(55);
    expect(value().competitivePerformance.one.kd).toBe(2);
  });

  it.each(["private", "empty"])("retains ready data for resolved service error fallbacks: %s", async (fallback) => {
    await mount();
    mockActive = false;
    await update();
    mockMMR.mockResolvedValue({});
    mockCompetitive.mockResolvedValue(fallback === "empty" ? {} : { one: { ...readyPerformance, status: "private", kd: null } });
    mockActive = true;
    await update();
    expect(value().playerIntel.one.currentRr).toBe(55);
    expect(value().competitivePerformance.one.kd).toBe(2);
    mockUser = account("two");
    await update();
    expect(value().playerIntel.one.currentRr).toBeNull();
    expect(value().competitivePerformance.one.kd).toBeNull();
  });
});
