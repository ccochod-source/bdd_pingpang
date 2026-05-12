/**
 * PGR algorithm configuration.
 * Centralise all thresholds and defaults so they are never scattered across files.
 */

export const PGR_CONFIG = {
  // ── Glicko-2 defaults ────────────────────────────────────────────────────
  DEFAULT_RATING: 1500,
  DEFAULT_RD: 350,       // rating deviation (high = uncertain)
  DEFAULT_VOLATILITY: 0.06,

  // System constant τ — controls how much volatility can change per period.
  // Glickman recommends 0.3–1.2. Lower = more stable.
  TAU: 0.5,

  // Convergence tolerance for the Illinois algorithm
  CONVERGENCE_EPSILON: 0.000001,

  // Maximum RD cap (a player who never plays can't exceed this)
  MAX_RD: 350,

  // ── Rating period ─────────────────────────────────────────────────────────
  // How many days constitute one rating period (default: weekly)
  RATING_PERIOD_DAYS: 7,

  // ── Confidence status thresholds ─────────────────────────────────────────
  // UNRATED      : no rating yet (0 matches)
  // PROVISIONAL  : 1 – PROVISIONAL_THRESHOLD-1 matches  → "Confiance faible"
  // CALIBRATING  : PROVISIONAL_THRESHOLD – STABLE_THRESHOLD-1 matches → "Confiance moyenne"
  // STABLE       : >= STABLE_THRESHOLD matches            → "Confiance forte"
  PROVISIONAL_THRESHOLD: 15,
  STABLE_THRESHOLD: 50,

  // RD below which a STABLE player is considered well-calibrated
  STABLE_RD_TARGET: 100,

  // ── Public display ────────────────────────────────────────────────────────
  // Rating is hidden ("En évaluation") until the player has played this many
  // confirmed matches. Internal Glicko-2 is always computed regardless.
  PUBLIC_RATING_MIN_MATCHES: 3,

  // ── Algorithm versioning ─────────────────────────────────────────────────
  ALGORITHM_VERSION: "glicko2-v1",

  // ── Questionnaire initial ratings ────────────────────────────────────────
  QUESTIONNAIRE_RATINGS: {
    COMPLETE_BEGINNER: { rating: 900, rd: 400 },
    RECREATIONAL: { rating: 1100, rd: 350 },
    CLUB_BEGINNER: { rating: 1300, rd: 300 },
    LOCAL_COMPETITOR: { rating: 1500, rd: 250 },
  },

  // ── Source confidence (used to set initial RD when converting) ────────────
  // Lower RD = more confident we know the player's level from this source
  SOURCE_INITIAL_RD: {
    WTT: 100,
    ITTF: 100,
    TTR: 120,
    FFTT: 150,
    RANKEDIN: 170,
    RFETM: 170,
    FITET: 180,
    CTTA: 180,
    JTTA: 180,
    KTTF: 180,
    PING_PANG: 200,
    MANUAL: 250,
    QUESTIONNAIRE: 300,
  },
} as const;

export type PgrConfig = typeof PGR_CONFIG;
