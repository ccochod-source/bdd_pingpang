/**
 * PGR public display logic.
 *
 * Separates the internal Glicko-2 rating (always computed, never capped)
 * from the public-facing presentation (masked until enough data exists).
 *
 * Rule: rating is shown only after PUBLIC_RATING_MIN_MATCHES confirmed matches.
 * Before that: "En évaluation" — no number shown.
 */

import { getConfidenceStatus } from "./glicko2.js";
import { PGR_CONFIG } from "./config.js";
import type { ConfidenceStatus } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type PublicConfidenceLabel =
  | "En évaluation"
  | "Confiance faible"
  | "Confiance moyenne"
  | "Confiance forte";

/** Rating is hidden — player has fewer than PUBLIC_RATING_MIN_MATCHES matches. */
export interface HiddenRatingDisplay {
  visible: false;
  label: "En évaluation";
  matchCount: number;
}

/** Rating is visible — player has enough matches for a meaningful display. */
export interface VisibleRatingDisplay {
  visible: true;
  rating: number;               // rounded to nearest integer
  label: "Confiance faible" | "Confiance moyenne" | "Confiance forte";
  confidenceStatus: "PROVISIONAL" | "CALIBRATING" | "STABLE";
  matchCount: number;
}

export type PublicRatingDisplay = HiddenRatingDisplay | VisibleRatingDisplay;

// ── Mapping ────────────────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<
  "PROVISIONAL" | "CALIBRATING" | "STABLE",
  "Confiance faible" | "Confiance moyenne" | "Confiance forte"
> = {
  PROVISIONAL: "Confiance faible",
  CALIBRATING: "Confiance moyenne",
  STABLE:      "Confiance forte",
};

// ── Public API ─────────────────────────────────────────────────────────────

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
export function getPublicRatingDisplay(
  internalRating: number,
  matchCount: number
): PublicRatingDisplay {
  if (matchCount < PGR_CONFIG.PUBLIC_RATING_MIN_MATCHES) {
    return {
      visible: false,
      label: "En évaluation",
      matchCount,
    };
  }

  const status = getConfidenceStatus(matchCount);

  // UNRATED cannot occur here (matchCount >= 3 >= 1)
  const visibleStatus = status as "PROVISIONAL" | "CALIBRATING" | "STABLE";

  return {
    visible: true,
    rating: Math.round(internalRating),
    label: CONFIDENCE_LABELS[visibleStatus],
    confidenceStatus: visibleStatus,
    matchCount,
  };
}
