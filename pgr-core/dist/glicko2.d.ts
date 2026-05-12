/**
 * Glicko-2 rating algorithm.
 *
 * Reference: Mark Glickman — "Example of the Glicko-2 system" (2012)
 * http://www.glicko.net/glicko/glicko2.pdf
 *
 * Notation (Glicko-2 internal scale):
 *   μ  = (r  - 1500) / 173.7178
 *   φ  = RD / 173.7178
 *   σ  = volatility (unchanged scale)
 */
import { ConfidenceStatus, OpponentResult, PlayerRating, RatingPeriodInput, RatingUpdate } from "./types.js";
/**
 * Calculate the updated rating for a player after one rating period.
 *
 * If results is empty, only RD increases (player was inactive).
 * Converts to/from Glicko-2 internal scale internally.
 */
export declare function calculateRatingUpdate(player: PlayerRating, results: OpponentResult[], tau?: number, epsilon?: number): RatingUpdate;
/**
 * Process a full rating period for multiple players at once.
 * Returns a Map from player index → RatingUpdate.
 */
export declare function calculateRatingPeriod(inputs: RatingPeriodInput[], tau?: number, epsilon?: number): RatingUpdate[];
/** Derive ConfidenceStatus from match count alone. */
export declare function getConfidenceStatus(matchCount: number): ConfidenceStatus;
/** Expected score for player A against player B. Pure Elo-style formula. */
export declare function expectedScore(ratingA: number, ratingB: number): number;
//# sourceMappingURL=glicko2.d.ts.map