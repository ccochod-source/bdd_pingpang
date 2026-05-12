/**
 * PGR public display logic.
 *
 * Separates the internal Glicko-2 rating (always computed, never capped)
 * from the public-facing presentation (masked until enough data exists).
 *
 * Rule: rating is shown only after PUBLIC_RATING_MIN_MATCHES confirmed matches.
 * Before that: "En évaluation" — no number shown.
 */
export type PublicConfidenceLabel = "En évaluation" | "Confiance faible" | "Confiance moyenne" | "Confiance forte";
/** Rating is hidden — player has fewer than PUBLIC_RATING_MIN_MATCHES matches. */
export interface HiddenRatingDisplay {
    visible: false;
    label: "En évaluation";
    matchCount: number;
}
/** Rating is visible — player has enough matches for a meaningful display. */
export interface VisibleRatingDisplay {
    visible: true;
    rating: number;
    label: "Confiance faible" | "Confiance moyenne" | "Confiance forte";
    confidenceStatus: "PROVISIONAL" | "CALIBRATING" | "STABLE";
    matchCount: number;
}
export type PublicRatingDisplay = HiddenRatingDisplay | VisibleRatingDisplay;
/**
 * Compute the public-facing display for a player's PGR.
 *
 * - If matchCount < PUBLIC_RATING_MIN_MATCHES → hidden ("En évaluation")
 * - Otherwise → rating rounded to integer + confidence label
 *
 * The internal Glicko-2 rating is always computed regardless of this function.
 * This is presentation only — it does not affect the algorithm.
 *
 * @param internalRating  The raw Glicko-2 rating (never modified)
 * @param matchCount      Confirmed matches played
 */
export declare function getPublicRatingDisplay(internalRating: number, matchCount: number): PublicRatingDisplay;
//# sourceMappingURL=display.d.ts.map