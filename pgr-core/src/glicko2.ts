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

import {
  ConfidenceStatus,
  OpponentResult,
  PlayerRating,
  RatingPeriodInput,
  RatingUpdate,
} from "./types.js";
import { PGR_CONFIG } from "./config.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SCALE = 173.7178;

// ── Internal helpers ───────────────────────────────────────────────────────

/** g(φ) — weight function that down-weights opponents with high RD */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** E(μ, μj, φj) — expected score for player μ against opponent (μj, φj) */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * f(x) used in the Illinois algorithm for volatility update.
 *
 * @param x   — current iterate (= ln(σ'^2))
 * @param delta — estimated improvement in rating
 * @param phi  — current player φ (Glicko-2 scale)
 * @param v    — estimated variance
 * @param a    — ln(σ²)
 * @param tau  — system constant
 */
function volatilityF(
  x: number,
  delta: number,
  phi: number,
  v: number,
  a: number,
  tau: number
): number {
  const ex = Math.exp(x);
  const phi2 = phi * phi;
  const denom = 2 * Math.pow(phi2 + v + ex, 2);
  return (ex * (delta * delta - phi2 - v - ex)) / denom - (x - a) / (tau * tau);
}

/**
 * Illinois algorithm — finds σ' such that f(ln(σ'^2)) = 0.
 * This is Step 5 of the Glicko-2 procedure.
 */
function updateVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number,
  tau: number,
  epsilon: number
): number {
  const a = Math.log(sigma * sigma);

  let A = a;
  let B: number;

  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (volatilityF(a - k * tau, delta, phi, v, a, tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  let fA = volatilityF(A, delta, phi, v, a, tau);
  let fB = volatilityF(B, delta, phi, v, a, tau);

  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = volatilityF(C, delta, phi, v, a, tau);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate the updated rating for a player after one rating period.
 *
 * If results is empty, only RD increases (player was inactive).
 * Converts to/from Glicko-2 internal scale internally.
 */
export function calculateRatingUpdate(
  player: PlayerRating,
  results: OpponentResult[],
  tau: number = PGR_CONFIG.TAU,
  epsilon: number = PGR_CONFIG.CONVERGENCE_EPSILON
): RatingUpdate {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.ratingDeviation / SCALE;
  const sigma = player.volatility;

  if (results.length === 0) {
    // Step 6 only: RD increases when player is inactive
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    const newRD = Math.min(phiStar * SCALE, PGR_CONFIG.MAX_RD);
    const newMatchCount = player.matchCount;
    return {
      rating: player.rating,
      ratingDeviation: newRD,
      volatility: sigma,
      matchCount: newMatchCount,
      confidenceStatus: getConfidenceStatus(newMatchCount),
      isProvisional: newMatchCount < PGR_CONFIG.PROVISIONAL_THRESHOLD,
    };
  }

  // Step 3: estimated variance v and improvement delta
  let vInverse = 0;
  let deltaWeighted = 0;

  for (const r of results) {
    const muJ = (r.opponentRating - 1500) / SCALE;
    const phiJ = r.opponentRD / SCALE;
    const gPhiJ = g(phiJ);
    const eVal = E(mu, muJ, phiJ);
    vInverse += gPhiJ * gPhiJ * eVal * (1 - eVal);
    deltaWeighted += gPhiJ * (r.outcome - eVal);
  }

  const v = 1 / vInverse;
  const delta = v * deltaWeighted;

  // Step 5: update volatility
  const sigmaPrime = updateVolatility(sigma, phi, v, delta, tau, epsilon);

  // Step 6: pre-period RD
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

  // Step 7: new RD and rating
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaWeighted;

  const newRating = SCALE * muPrime + 1500;
  const newRD = SCALE * phiPrime;
  const newMatchCount = player.matchCount + results.length;

  return {
    rating: newRating,
    ratingDeviation: Math.min(newRD, PGR_CONFIG.MAX_RD),
    volatility: sigmaPrime,
    matchCount: newMatchCount,
    confidenceStatus: getConfidenceStatus(newMatchCount),
    isProvisional: newMatchCount < PGR_CONFIG.PROVISIONAL_THRESHOLD,
  };
}

/**
 * Process a full rating period for multiple players at once.
 * Returns a Map from player index → RatingUpdate.
 */
export function calculateRatingPeriod(
  inputs: RatingPeriodInput[],
  tau?: number,
  epsilon?: number
): RatingUpdate[] {
  return inputs.map((input) =>
    calculateRatingUpdate(input.player, input.results, tau, epsilon)
  );
}

// ── Confidence helpers ─────────────────────────────────────────────────────

/** Derive ConfidenceStatus from match count alone. */
export function getConfidenceStatus(matchCount: number): ConfidenceStatus {
  if (matchCount === 0) return "UNRATED";
  if (matchCount < PGR_CONFIG.PROVISIONAL_THRESHOLD) return "PROVISIONAL";
  if (matchCount < PGR_CONFIG.STABLE_THRESHOLD) return "CALIBRATING";
  return "STABLE";
}

/** Expected score for player A against player B. Pure Elo-style formula. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
