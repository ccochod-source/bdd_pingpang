import { describe, it, expect } from "vitest";
import {
  initFromQuestionnaire,
  initFromFFTT,
  initFromWTT,
  initFromITTF,
  initFromTTR,
  initFromRank,
  initFromBestAvailableSource,
} from "../src/initializer.js";
import { PGR_CONFIG } from "../src/config.js";

// ── initFromQuestionnaire ─────────────────────────────────────────────────

describe("initFromQuestionnaire", () => {
  it("COMPLETE_BEGINNER returns lowest rating", () => {
    const r = initFromQuestionnaire("COMPLETE_BEGINNER");
    expect(r.rating).toBe(900);
    expect(r.initializationSource).toBe("QUESTIONNAIRE");
    expect(r.isProvisional).toBe(true);
  });

  it("LOCAL_COMPETITOR returns highest questionnaire rating", () => {
    const r = initFromQuestionnaire("LOCAL_COMPETITOR");
    expect(r.rating).toBe(1500);
  });

  it("ratings increase with level", () => {
    const beginner = initFromQuestionnaire("COMPLETE_BEGINNER").rating;
    const recreational = initFromQuestionnaire("RECREATIONAL").rating;
    const clubBeginner = initFromQuestionnaire("CLUB_BEGINNER").rating;
    const competitor = initFromQuestionnaire("LOCAL_COMPETITOR").rating;
    expect(beginner).toBeLessThan(recreational);
    expect(recreational).toBeLessThan(clubBeginner);
    expect(clubBeginner).toBeLessThan(competitor);
  });

  it("RD decreases as level increases (less uncertainty for established players)", () => {
    const beginner = initFromQuestionnaire("COMPLETE_BEGINNER").ratingDeviation;
    const competitor = initFromQuestionnaire("LOCAL_COMPETITOR").ratingDeviation;
    expect(beginner).toBeGreaterThan(competitor);
  });

  it("all questionnaire ratings are provisional", () => {
    const levels = ["COMPLETE_BEGINNER", "RECREATIONAL", "CLUB_BEGINNER", "LOCAL_COMPETITOR"] as const;
    levels.forEach((level) => {
      expect(initFromQuestionnaire(level).isProvisional).toBe(true);
    });
  });
});

// ── initFromFFTT ──────────────────────────────────────────────────────────

describe("initFromFFTT", () => {
  it("maps FFTT 1500 to PGR ~1500", () => {
    const r = initFromFFTT({ points: 1500 });
    expect(r.rating).toBeCloseTo(1500, -1); // within ±10
  });

  it("higher FFTT points → higher PGR", () => {
    const low = initFromFFTT({ points: 800 }).rating;
    const mid = initFromFFTT({ points: 1500 }).rating;
    const high = initFromFFTT({ points: 2500 }).rating;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("source is FFTT", () => {
    expect(initFromFFTT({ points: 1000 }).initializationSource).toBe("FFTT");
  });

  it("RD is lower than questionnaire (FFTT is a recognized source)", () => {
    const fftt = initFromFFTT({ points: 1000 }).ratingDeviation;
    const questionnaire = initFromQuestionnaire("LOCAL_COMPETITOR").ratingDeviation;
    expect(fftt).toBeLessThan(questionnaire);
  });
});

// ── initFromWTT ───────────────────────────────────────────────────────────

describe("initFromWTT", () => {
  it("rank 1 returns near 2900", () => {
    const r = initFromWTT({ rank: 1 });
    expect(r.rating).toBeGreaterThan(2800);
    expect(r.rating).toBeLessThanOrEqual(3100);
  });

  it("lower rank → higher PGR", () => {
    const top1 = initFromWTT({ rank: 1 }).rating;
    const top100 = initFromWTT({ rank: 100 }).rating;
    const top500 = initFromWTT({ rank: 500 }).rating;
    expect(top1).toBeGreaterThan(top100);
    expect(top100).toBeGreaterThan(top500);
  });

  it("source is WTT", () => {
    expect(initFromWTT({ rank: 10 }).initializationSource).toBe("WTT");
  });

  it("WTT has lowest RD (highest confidence)", () => {
    const wtt = initFromWTT({ rank: 10 }).ratingDeviation;
    const fftt = initFromFFTT({ points: 2000 }).ratingDeviation;
    expect(wtt).toBeLessThan(fftt);
  });
});

// ── initFromITTF ──────────────────────────────────────────────────────────

describe("initFromITTF", () => {
  it("source is ITTF", () => {
    expect(initFromITTF({ rank: 5 }).initializationSource).toBe("ITTF");
  });

  it("produces similar ratings to WTT for same rank", () => {
    const ittf = initFromITTF({ rank: 10 }).rating;
    const wtt = initFromWTT({ rank: 10 }).rating;
    expect(Math.abs(ittf - wtt)).toBeLessThan(50);
  });
});

// ── initFromTTR ───────────────────────────────────────────────────────────

describe("initFromTTR", () => {
  it("TTR 1500 → PGR 1500", () => {
    const r = initFromTTR({ ttr: 1500 });
    expect(r.rating).toBe(1500);
  });

  it("higher TTR → higher PGR", () => {
    const low = initFromTTR({ ttr: 1000 }).rating;
    const high = initFromTTR({ ttr: 2000 }).rating;
    expect(high).toBeGreaterThan(low);
  });

  it("source is TTR", () => {
    expect(initFromTTR({ ttr: 1800 }).initializationSource).toBe("TTR");
  });
});

// ── initFromRank ──────────────────────────────────────────────────────────

describe("initFromRank", () => {
  it("lower rank → higher PGR", () => {
    const rank1 = initFromRank({ rank: 1, totalPlayers: 1000, source: "RANKEDIN" }).rating;
    const rank500 = initFromRank({ rank: 500, totalPlayers: 1000, source: "RANKEDIN" }).rating;
    expect(rank1).toBeGreaterThan(rank500);
  });

  it("works without totalPlayers", () => {
    const r = initFromRank({ rank: 10, source: "RFETM" });
    expect(r.rating).toBeGreaterThan(0);
    expect(r.rating).toBeLessThan(3500);
  });
});

// ── initFromBestAvailableSource ───────────────────────────────────────────

describe("initFromBestAvailableSource", () => {
  it("returns null when no rankings provided", () => {
    expect(initFromBestAvailableSource([])).toBeNull();
  });

  it("prefers WTT over FFTT", () => {
    const result = initFromBestAvailableSource([
      { source: "FFTT", rankingValue: 2000, rank: null },
      { source: "WTT", rankingValue: 5000, rank: 50 },
    ]);
    expect(result?.initializationSource).toBe("WTT");
  });

  it("prefers TTR over FFTT", () => {
    const result = initFromBestAvailableSource([
      { source: "FFTT", rankingValue: 2000, rank: null },
      { source: "TTR", rankingValue: 2100, rank: null },
    ]);
    expect(result?.initializationSource).toBe("TTR");
  });

  it("falls back to single source when only one available", () => {
    const result = initFromBestAvailableSource([
      { source: "FFTT", rankingValue: 1800, rank: null },
    ]);
    expect(result?.initializationSource).toBe("FFTT");
  });

  it("ITTF source preserves ITTF as initializationSource (not WTT)", () => {
    const result = initFromBestAvailableSource([
      { source: "ITTF", rankingValue: 12152, rank: 1 },
    ]);
    expect(result?.initializationSource).toBe("ITTF");
  });

  it("prefers WTT over ITTF when both are present (WTT has higher priority)", () => {
    const result = initFromBestAvailableSource([
      { source: "WTT", rankingValue: 5000, rank: 50 },
      { source: "ITTF", rankingValue: 12152, rank: 1 },
    ]);
    expect(result?.initializationSource).toBe("WTT");
  });

  it("ITTF and WTT produce same rating but different initializationSource", () => {
    const ittf = initFromBestAvailableSource([{ source: "ITTF", rankingValue: 6750, rank: 2 }]);
    const wtt = initFromBestAvailableSource([{ source: "WTT", rankingValue: 6750, rank: 2 }]);
    expect(ittf?.rating).toBe(wtt?.rating);
    expect(ittf?.initializationSource).toBe("ITTF");
    expect(wtt?.initializationSource).toBe("WTT");
  });
});
