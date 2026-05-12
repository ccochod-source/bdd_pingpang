/**
 * Core PGR type definitions — shared between pgr-core and pgr-service.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type ConfidenceStatus =
  | "UNRATED"
  | "PROVISIONAL"
  | "CALIBRATING"
  | "STABLE";

export type DataSource =
  | "FFTT"
  | "WTT"
  | "ITTF"
  | "TTR"
  | "RANKEDIN"
  | "RFETM"
  | "FITET"
  | "CTTA"
  | "JTTA"
  | "KTTF"
  | "PING_PANG"
  | "QUESTIONNAIRE"
  | "MANUAL";

export type BeginnerLevel =
  | "COMPLETE_BEGINNER"
  | "RECREATIONAL"
  | "CLUB_BEGINNER"
  | "LOCAL_COMPETITOR";

export type MatchOutcome = 1 | 0.5 | 0; // win / draw / loss from player's perspective

// ── Core rating types ──────────────────────────────────────────────────────

/** The full Glicko-2 state of a player at a given point in time. */
export interface PlayerRating {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchCount: number;
  confidenceStatus: ConfidenceStatus;
  isProvisional: boolean;
  initializationSource: DataSource;
  algorithmVersion: string;
}

/** A single match result as seen from one player's perspective. */
export interface OpponentResult {
  opponentRating: number;
  opponentRD: number;
  outcome: MatchOutcome; // 1 = this player won, 0 = lost
}

/** Input to a rating period calculation. */
export interface RatingPeriodInput {
  player: PlayerRating;
  results: OpponentResult[];
}

/** The Glicko-2 fields updated after a rating period. */
export interface RatingUpdate {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchCount: number;
  confidenceStatus: ConfidenceStatus;
  isProvisional: boolean;
}

// ── Set score ──────────────────────────────────────────────────────────────

/** [player_a_score, player_b_score] for one set, e.g. [11, 8] */
export type SetScore = [number, number];

// ── Initializer input types ───────────────────────────────────────────────

export interface WttInitInput {
  rank: number;
  points?: number;
}

export interface FfttInitInput {
  points: number;
}

export interface TtrInitInput {
  ttr: number;
}

export interface RankInitInput {
  rank: number;
  totalPlayers?: number;
  source: DataSource;
}
