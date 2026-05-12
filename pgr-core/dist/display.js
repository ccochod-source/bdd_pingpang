"use strict";
/**
 * PGR public display logic.
 *
 * Separates the internal Glicko-2 rating (always computed, never capped)
 * from the public-facing presentation (masked until enough data exists).
 *
 * Rule: rating is shown only after PUBLIC_RATING_MIN_MATCHES confirmed matches.
 * Before that: "En évaluation" — no number shown.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicRatingDisplay = getPublicRatingDisplay;
const glicko2_js_1 = require("./glicko2.js");
const config_js_1 = require("./config.js");
// ── Mapping ────────────────────────────────────────────────────────────────
const CONFIDENCE_LABELS = {
    PROVISIONAL: "Confiance faible",
    CALIBRATING: "Confiance moyenne",
    STABLE: "Confiance forte",
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
function getPublicRatingDisplay(internalRating, matchCount) {
    if (matchCount < config_js_1.PGR_CONFIG.PUBLIC_RATING_MIN_MATCHES) {
        return {
            visible: false,
            label: "En évaluation",
            matchCount,
        };
    }
    const status = (0, glicko2_js_1.getConfidenceStatus)(matchCount);
    // UNRATED cannot occur here (matchCount >= 3 >= 1)
    const visibleStatus = status;
    return {
        visible: true,
        rating: Math.round(internalRating),
        label: CONFIDENCE_LABELS[visibleStatus],
        confidenceStatus: visibleStatus,
        matchCount,
    };
}
//# sourceMappingURL=display.js.map