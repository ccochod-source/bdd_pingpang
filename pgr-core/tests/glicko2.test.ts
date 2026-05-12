import { describe, it, expect } from "vitest";
import {
  calculateRatingUpdate,
  calculateRatingPeriod,
  getConfidenceStatus,
  expectedScore,
} from "../src/glicko2.js";
import { PGR_CONFIG } from "../src/config.js";
import type { PlayerRating, OpponentResult } from "../src/types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(
  rating = 1500,
  rd = 200,
  volatility = 0.06,
  matchCount = 20
): PlayerRating {
  return {
    rating,
    ratingDeviation: rd,
    volatility,
    matchCount,
    confidenceStatus: "CALIBRATING",
    isProvisional: false,
    initializationSource: "PING_PANG",
    algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
  };
}

// ── getConfidenceStatus ────────────────────────────────────────────────────

describe("getConfidenceStatus", () => {
  it("returns UNRATED for 0 matches", () => {
    expect(getConfidenceStatus(0)).toBe("UNRATED");
  });

  it("returns PROVISIONAL below threshold (1–14)", () => {
    expect(getConfidenceStatus(1)).toBe("PROVISIONAL");
    expect(getConfidenceStatus(9)).toBe("PROVISIONAL");
    expect(getConfidenceStatus(14)).toBe("PROVISIONAL");
  });

  it("returns CALIBRATING in middle range (15–49)", () => {
    expect(getConfidenceStatus(15)).toBe("CALIBRATING");
    expect(getConfidenceStatus(29)).toBe("CALIBRATING");
    expect(getConfidenceStatus(49)).toBe("CALIBRATING");
  });

  it("returns STABLE at or above threshold (50+)", () => {
    expect(getConfidenceStatus(50)).toBe("STABLE");
    expect(getConfidenceStatus(100)).toBe("STABLE");
  });
});

// ── expectedScore ──────────────────────────────────────────────────────────

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it("higher-rated player has expected score > 0.5", () => {
    expect(expectedScore(1600, 1500)).toBeGreaterThan(0.5);
  });

  it("is symmetric: E(A,B) + E(B,A) = 1", () => {
    const a = expectedScore(1700, 1400);
    const b = expectedScore(1400, 1700);
    expect(a + b).toBeCloseTo(1, 5);
  });
});

// ── calculateRatingUpdate — no matches ────────────────────────────────────

describe("calculateRatingUpdate — inactive player", () => {
  it("keeps the same rating when no matches are played", () => {
    const player = makePlayer(1500, 200);
    const update = calculateRatingUpdate(player, []);
    expect(update.rating).toBe(1500);
  });

  it("increases RD when no matches are played", () => {
    const player = makePlayer(1500, 200);
    const update = calculateRatingUpdate(player, []);
    expect(update.ratingDeviation).toBeGreaterThan(200);
  });

  it("RD never exceeds MAX_RD", () => {
    const player = makePlayer(1500, PGR_CONFIG.MAX_RD - 1);
    const update = calculateRatingUpdate(player, []);
    expect(update.ratingDeviation).toBeLessThanOrEqual(PGR_CONFIG.MAX_RD);
  });
});

// ── calculateRatingUpdate — with matches ──────────────────────────────────

describe("calculateRatingUpdate — with matches", () => {
  it("rating increases after winning against a stronger opponent", () => {
    const player = makePlayer(1500, 200);
    const results: OpponentResult[] = [
      { opponentRating: 1700, opponentRD: 150, outcome: 1 },
    ];
    const update = calculateRatingUpdate(player, results);
    expect(update.rating).toBeGreaterThan(1500);
  });

  it("rating decreases after losing against a weaker opponent", () => {
    const player = makePlayer(1500, 200);
    const results: OpponentResult[] = [
      { opponentRating: 1300, opponentRD: 150, outcome: 0 },
    ];
    const update = calculateRatingUpdate(player, results);
    expect(update.rating).toBeLessThan(1500);
  });

  it("rating barely changes when losing against much stronger opponent", () => {
    const player = makePlayer(1500, 200);
    const results: OpponentResult[] = [
      { opponentRating: 2400, opponentRD: 100, outcome: 0 },
    ];
    const update = calculateRatingUpdate(player, results);
    // Expected: small decrease since losing to a much stronger player was expected
    expect(update.rating).toBeGreaterThan(1400);
    expect(update.rating).toBeLessThan(1500);
  });

  it("RD decreases after playing matches", () => {
    const player = makePlayer(1500, 200);
    const results: OpponentResult[] = [
      { opponentRating: 1500, opponentRD: 150, outcome: 1 },
      { opponentRating: 1400, opponentRD: 150, outcome: 0 },
      { opponentRating: 1600, opponentRD: 150, outcome: 1 },
    ];
    const update = calculateRatingUpdate(player, results);
    expect(update.ratingDeviation).toBeLessThan(200);
  });

  it("match count is incremented correctly", () => {
    const player = makePlayer(1500, 200, 0.06, 5);
    const results: OpponentResult[] = [
      { opponentRating: 1500, opponentRD: 150, outcome: 1 },
      { opponentRating: 1500, opponentRD: 150, outcome: 1 },
    ];
    const update = calculateRatingUpdate(player, results);
    expect(update.matchCount).toBe(7);
  });

  it("isProvisional becomes false after PROVISIONAL_THRESHOLD matches", () => {
    const player = makePlayer(1500, 300, 0.06, 14); // 1 away from threshold (15)
    const results: OpponentResult[] = [
      { opponentRating: 1500, opponentRD: 200, outcome: 1 },
    ];
    const update = calculateRatingUpdate(player, results);
    expect(update.matchCount).toBe(15);
    expect(update.isProvisional).toBe(false);
    expect(update.confidenceStatus).toBe("CALIBRATING");
  });
});

// ── calculateRatingPeriod ─────────────────────────────────────────────────

describe("calculateRatingPeriod", () => {
  it("processes multiple players in one call", () => {
    const players = [makePlayer(1500, 200), makePlayer(1600, 150)];
    const inputs = players.map((p) => ({ player: p, results: [] }));
    const updates = calculateRatingPeriod(inputs);
    expect(updates).toHaveLength(2);
  });

  it("returns stable ratings when all players are inactive", () => {
    const players = [makePlayer(1500, 200), makePlayer(1700, 120)];
    const inputs = players.map((p) => ({ player: p, results: [] }));
    const updates = calculateRatingPeriod(inputs);
    expect(updates[0].rating).toBe(1500);
    expect(updates[1].rating).toBe(1700);
  });

  it("Glickman example: player at 1500/200 wins all 3, loses 2", () => {
    // Loosely based on Glickman's worked example (section 3).
    // Exact values not reproduced — just checking directionality.
    const player = makePlayer(1500, 200, 0.06, 0);
    const results: OpponentResult[] = [
      { opponentRating: 1400, opponentRD: 30, outcome: 1 },
      { opponentRating: 1550, opponentRD: 100, outcome: 0 },
      { opponentRating: 1700, opponentRD: 300, outcome: 0 },
    ];
    const update = calculateRatingUpdate(player, results);
    // Player lost 2 of 3; rating should decrease
    expect(update.rating).toBeLessThan(1500);
    expect(update.ratingDeviation).toBeLessThan(200);
    expect(update.volatility).toBeGreaterThan(0);
    expect(update.volatility).toBeLessThan(1);
  });
});
