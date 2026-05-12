"use strict";
/**
 * PGR initialization functions.
 *
 * Each function converts an external source signal into an initial PlayerRating.
 * The resulting ratings are ALWAYS provisional with a high RD.
 * Glicko-2 will calibrate them progressively through real matches.
 *
 * Conversion formulas are deliberately approximate — they must be recalibrated
 * with real cross-source match data once enough bridge matches exist.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFromQuestionnaire = initFromQuestionnaire;
exports.initFromFFTT = initFromFFTT;
exports.initFromWTT = initFromWTT;
exports.initFromITTF = initFromITTF;
exports.initFromTTR = initFromTTR;
exports.initFromRank = initFromRank;
exports.initFromBestAvailableSource = initFromBestAvailableSource;
const config_js_1 = require("./config.js");
// ── Internal builder ───────────────────────────────────────────────────────
function makeRating(rating, rd, source, matchCount = 0) {
    const clamped = Math.max(500, Math.min(rating, 3500));
    const clampedRD = Math.max(50, Math.min(rd, config_js_1.PGR_CONFIG.MAX_RD));
    const matchCountSafe = Math.max(0, matchCount);
    return {
        rating: Math.round(clamped),
        ratingDeviation: Math.round(clampedRD),
        volatility: config_js_1.PGR_CONFIG.DEFAULT_VOLATILITY,
        matchCount: matchCountSafe,
        confidenceStatus: matchCountSafe === 0 ? "PROVISIONAL" : "PROVISIONAL",
        isProvisional: true,
        initializationSource: source,
        algorithmVersion: config_js_1.PGR_CONFIG.ALGORITHM_VERSION,
    };
}
// ── Questionnaire ──────────────────────────────────────────────────────────
/**
 * Initialize rating from the beginner self-assessment questionnaire.
 *
 * Levels map:
 *   COMPLETE_BEGINNER  → 900  PGR, RD 400
 *   RECREATIONAL       → 1100 PGR, RD 350
 *   CLUB_BEGINNER      → 1300 PGR, RD 300
 *   LOCAL_COMPETITOR   → 1500 PGR, RD 250
 */
function initFromQuestionnaire(level) {
    const { rating, rd } = config_js_1.PGR_CONFIG.QUESTIONNAIRE_RATINGS[level];
    return makeRating(rating, rd, "QUESTIONNAIRE");
}
// ── FFTT (France) ──────────────────────────────────────────────────────────
/**
 * Initialize from FFTT Smartping points.
 *
 * FFTT scale: ~500 (beginner) to 3500+ (national elite)
 * Approximate mapping (to be recalibrated with cross-source data):
 *   FFTT 500  → PGR ~1100
 *   FFTT 1000 → PGR ~1300
 *   FFTT 1500 → PGR ~1500
 *   FFTT 2000 → PGR ~1700
 *   FFTT 2500 → PGR ~1900
 *   FFTT 3000 → PGR ~2100
 *
 * Formula: PGR = 600 + points * 0.6  (capped)
 */
function initFromFFTT({ points }) {
    const pgr = 600 + points * 0.6;
    const rd = config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD.FFTT;
    return makeRating(pgr, rd, "FFTT");
}
// ── WTT / ITTF ────────────────────────────────────────────────────────────
/**
 * Initialize from WTT/ITTF world ranking.
 *
 * Uses rank as the primary signal (logarithmic) combined with a points bonus.
 * Formula: PGR = 3000 - 350 * log10(rank + 1)  [+ optional points bonus]
 *
 * Approximate mapping:
 *   Rank 1    → ~2895 PGR
 *   Rank 10   → ~2615 PGR
 *   Rank 100  → ~2300 PGR
 *   Rank 500  → ~2055 PGR
 *   Rank 1000 → ~1902 PGR
 */
function initFromWTT({ rank, points }) {
    const rankSignal = 3000 - 350 * Math.log10(rank + 1);
    // Points act as a secondary adjustment (log-compressed, max ±100)
    const pointsBonus = points
        ? Math.min(100, Math.log(points + 1) * 6) - 50
        : 0;
    const pgr = rankSignal + pointsBonus * 0.3;
    const rd = config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD.WTT;
    return makeRating(pgr, rd, "WTT");
}
/** Alias — ITTF and WTT use the same ranking system. */
function initFromITTF(input) {
    const r = initFromWTT(input);
    return { ...r, initializationSource: "ITTF" };
}
// ── TTR (Germany / Click-TT) ───────────────────────────────────────────────
/**
 * Initialize from TTR (Tischtennis-Rating), Germany's Elo-like rating.
 *
 * TTR is already close to an Elo scale. We apply a slight compression
 * toward 1500 to account for population differences.
 * Formula: PGR = 1500 + (ttr - 1500) * 0.9
 */
function initFromTTR({ ttr }) {
    const pgr = 1500 + (ttr - 1500) * 0.9;
    const rd = config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD.TTR;
    return makeRating(pgr, rd, "TTR");
}
// ── Generic rank-based initialization ────────────────────────────────────
/**
 * Initialize from a national rank when no points/rating is available.
 * Uses a percentile-based logarithmic mapping.
 *
 * If totalPlayers is known, uses percentile.
 * Otherwise falls back to the WTT-style logarithmic formula at lower scale.
 */
function initFromRank({ rank, totalPlayers, source }) {
    let pgr;
    if (totalPlayers && totalPlayers > 0) {
        const percentile = 1 - rank / totalPlayers;
        // Map [0, 1] percentile to [1000, 2500] PGR
        pgr = 1000 + percentile * 1500;
    }
    else {
        // Fallback: treat like a national-level scaled WTT formula
        pgr = 2500 - 300 * Math.log10(rank + 1);
    }
    const sourceKey = source;
    const rd = sourceKey in config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD
        ? config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD[sourceKey]
        : config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD.MANUAL;
    return makeRating(pgr, rd, source);
}
/**
 * Priority order when a player has multiple external rankings.
 * Higher index = higher priority.
 */
const SOURCE_PRIORITY = [
    "MANUAL",
    "QUESTIONNAIRE",
    "PING_PANG",
    "RANKEDIN",
    "RFETM",
    "FITET",
    "CTTA",
    "JTTA",
    "KTTF",
    "FFTT",
    "TTR",
    "ITTF",
    "WTT",
];
/**
 * Given a list of available external rankings, pick the best one and
 * return an initial PlayerRating.
 */
function initFromBestAvailableSource(rankings) {
    if (rankings.length === 0)
        return null;
    const sorted = [...rankings].sort((a, b) => SOURCE_PRIORITY.indexOf(b.source) - SOURCE_PRIORITY.indexOf(a.source));
    const best = sorted[0];
    switch (best.source) {
        case "WTT":
        case "ITTF":
            if (best.rank)
                return initFromWTT({ rank: best.rank, points: best.rankingValue ?? undefined });
            break;
        case "TTR":
            if (best.rankingValue)
                return initFromTTR({ ttr: best.rankingValue });
            break;
        case "FFTT":
            if (best.rankingValue)
                return initFromFFTT({ points: best.rankingValue });
            break;
        default:
            if (best.rank)
                return initFromRank({ rank: best.rank, source: best.source });
            if (best.rankingValue) {
                // Treat as Elo-like and scale toward 1500
                const pgr = 1500 + (best.rankingValue - 1500) * 0.8;
                const sourceKey = best.source;
                const rd = sourceKey in config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD
                    ? config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD[sourceKey]
                    : config_js_1.PGR_CONFIG.SOURCE_INITIAL_RD.MANUAL;
                return makeRating(pgr, rd, best.source);
            }
    }
    return null;
}
//# sourceMappingURL=initializer.js.map