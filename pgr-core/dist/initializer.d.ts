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
import { BeginnerLevel, DataSource, FfttInitInput, PlayerRating, RankInitInput, TtrInitInput, WttInitInput } from "./types.js";
/**
 * Initialize rating from the beginner self-assessment questionnaire.
 *
 * Levels map:
 *   COMPLETE_BEGINNER  → 900  PGR, RD 400
 *   RECREATIONAL       → 1100 PGR, RD 350
 *   CLUB_BEGINNER      → 1300 PGR, RD 300
 *   LOCAL_COMPETITOR   → 1500 PGR, RD 250
 */
export declare function initFromQuestionnaire(level: BeginnerLevel): PlayerRating;
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
export declare function initFromFFTT({ points }: FfttInitInput): PlayerRating;
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
export declare function initFromWTT({ rank, points }: WttInitInput): PlayerRating;
/** Alias — ITTF and WTT use the same ranking system. */
export declare function initFromITTF(input: WttInitInput): PlayerRating;
/**
 * Initialize from TTR (Tischtennis-Rating), Germany's Elo-like rating.
 *
 * TTR is already close to an Elo scale. We apply a slight compression
 * toward 1500 to account for population differences.
 * Formula: PGR = 1500 + (ttr - 1500) * 0.9
 */
export declare function initFromTTR({ ttr }: TtrInitInput): PlayerRating;
/**
 * Initialize from a national rank when no points/rating is available.
 * Uses a percentile-based logarithmic mapping.
 *
 * If totalPlayers is known, uses percentile.
 * Otherwise falls back to the WTT-style logarithmic formula at lower scale.
 */
export declare function initFromRank({ rank, totalPlayers, source }: RankInitInput): PlayerRating;
export interface ExternalRankingInput {
    source: DataSource;
    rankingValue?: number | null;
    rank?: number | null;
}
/**
 * Given a list of available external rankings, pick the best one and
 * return an initial PlayerRating.
 */
export declare function initFromBestAvailableSource(rankings: ExternalRankingInput[]): PlayerRating | null;
//# sourceMappingURL=initializer.d.ts.map