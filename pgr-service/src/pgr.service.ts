/**
 * PgrService — main orchestrator.
 *
 * Bridges pgr-core (pure calculation) with pgr-service (Prisma + DB).
 *
 * Responsibilities:
 *   - Initialize a player's first PGR snapshot from external rankings
 *   - Process a rating period: collect confirmed matches, recalculate, persist
 *   - Recalculate a single player's rating on demand
 */

import { PrismaClient, PgrSnapshotTrigger, PgrDataSource } from "@prisma/client";
import {
  calculateRatingUpdate,
  calculateRatingPeriod,
  initFromBestAvailableSource,
  initFromQuestionnaire,
  getConfidenceStatus,
  getPublicRatingDisplay,
  PGR_CONFIG,
  PlayerRating,
  OpponentResult,
  RatingPeriodInput,
  BeginnerLevel,
} from "@ping-pang/pgr-core";

import { PlayersService, CreatePlayerData, AddExternalRankingData } from "./players.service.js";
import { MatchesService, CreateMatchData } from "./matches.service.js";
import { SnapshotsService, LeaderboardOptions } from "./snapshots.service.js";

export class PgrService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly playersService: PlayersService,
    private readonly matchesService: MatchesService,
    private readonly snapshotsService: SnapshotsService
  ) {}

  // ── Player management ─────────────────────────────────────────────────────

  async createPlayer(data: CreatePlayerData) {
    return this.playersService.create(data);
  }

  async addExternalRanking(playerId: string, data: AddExternalRankingData) {
    return this.playersService.addExternalRanking(playerId, data);
  }

  // ── Read queries ──────────────────────────────────────────────────────────

  /**
   * Current PGR for one player: latest snapshot + player info + public display.
   * Returns null if the player doesn't exist.
   *
   * publicDisplay: ready-to-use presentation object for the frontend.
   *   - { visible: false, label: "En évaluation" }  when matchCount < 3
   *   - { visible: true, rating, label, confidenceStatus } otherwise
   * The internal rating is always preserved in `snapshot` regardless.
   */
  async getCurrentRating(playerId: string) {
    const [player, snapshot] = await Promise.all([
      this.playersService.findById(playerId),
      this.snapshotsService.getLatestSnapshot(playerId),
    ]);
    if (!player) return null;
    const publicDisplay = snapshot
      ? getPublicRatingDisplay(snapshot.rating, snapshot.match_count)
      : getPublicRatingDisplay(0, 0);
    return { player, snapshot, publicDisplay };
  }

  /**
   * Global or per-country leaderboard, sorted by rating descending.
   * Each entry includes player info + publicDisplay.
   */
  async getLeaderboard(options: LeaderboardOptions = {}) {
    const snapshots = await this.snapshotsService.getLeaderboard(options);
    return snapshots.map((s) => ({
      ...s,
      publicDisplay: getPublicRatingDisplay(s.rating, s.match_count),
    }));
  }

  /**
   * Full PGR history for one player, most recent first.
   * Each snapshot carries its own publicDisplay at the time it was created.
   */
  async getPlayerHistory(playerId: string, limit?: number) {
    const [player, history] = await Promise.all([
      this.playersService.findById(playerId),
      this.snapshotsService.getPlayerHistory(playerId, limit),
    ]);
    return {
      player,
      history: history.map((s) => ({
        ...s,
        publicDisplay: getPublicRatingDisplay(s.rating, s.match_count),
      })),
    };
  }

  // ── Match lifecycle ────────────────────────────────────────────────────────

  /**
   * Record a new match. Status starts as PENDING.
   */
  async createMatch(data: CreateMatchData) {
    return this.matchesService.create(data);
  }

  /**
   * Confirm a pending match. Once confirmed it will be included in the next
   * rating period processing.
   */
  async confirmMatch(matchId: string) {
    return this.matchesService.confirm(matchId);
  }

  /**
   * Process all CONFIRMED matches in a date window and update PGR snapshots.
   * Defaults to all time if no window is provided.
   *
   * @param options.since  - only include matches from this date (inclusive)
   * @param options.until  - only include matches up to this date (inclusive)
   */
  async processConfirmedMatches(
    options: { since?: Date; until?: Date } = {}
  ): Promise<void> {
    const from = options.since ?? new Date(0);
    const to = options.until ?? new Date();
    return this.processRatingPeriod(from, to, "MATCH_BATCH");
  }

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Initialize a player's PGR from their external rankings.
   * If no external ranking is found, falls back to CLUB_BEGINNER level.
   */
  async initializePlayer(playerId: string) {
    const rankings = await this.playersService.getExternalRankings(playerId);

    const initial = initFromBestAvailableSource(
      rankings.map((r) => ({
        source: r.source as import("@ping-pang/pgr-core").DataSource,
        rankingValue: r.ranking_value,
        rank: r.rank,
      }))
    ) ?? initFromQuestionnaire("CLUB_BEGINNER");

    return this.snapshotsService.createSnapshot({
      playerId,
      ratingUpdate: {
        rating: initial.rating,
        ratingDeviation: initial.ratingDeviation,
        volatility: initial.volatility,
        matchCount: 0,
        confidenceStatus: "PROVISIONAL",
        isProvisional: true,
      },
      initializationSource: initial.initializationSource as PgrDataSource,
      algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
      snapshotDate: new Date(),
      trigger: "INITIALIZATION",
    });
  }

  /**
   * Initialize from a beginner questionnaire response.
   */
  async initializeFromQuestionnaire(playerId: string, level: BeginnerLevel) {
    const initial = initFromQuestionnaire(level);

    return this.snapshotsService.createSnapshot({
      playerId,
      ratingUpdate: {
        rating: initial.rating,
        ratingDeviation: initial.ratingDeviation,
        volatility: initial.volatility,
        matchCount: 0,
        confidenceStatus: "PROVISIONAL",
        isProvisional: true,
      },
      initializationSource: "QUESTIONNAIRE",
      algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
      snapshotDate: new Date(),
      trigger: "INITIALIZATION",
    });
  }

  // ── Rating period processing ───────────────────────────────────────────────

  /**
   * Process one rating period:
   *   1. Get all CONFIRMED matches in [periodStart, periodEnd]
   *   2. For each player in those matches, get their current PGR snapshot
   *   3. Build Glicko-2 inputs
   *   4. Run calculateRatingPeriod
   *   5. Persist new snapshots
   *
   * @param periodStart - inclusive start of the period
   * @param periodEnd   - inclusive end of the period
   * @param trigger     - reason for this recalculation
   */
  async processRatingPeriod(
    periodStart: Date,
    periodEnd: Date,
    trigger: PgrSnapshotTrigger = "MATCH_BATCH"
  ): Promise<void> {
    const matches = await this.matchesService.getConfirmedMatchesInPeriod(
      periodStart,
      periodEnd
    );

    if (matches.length === 0) return;

    // Collect all unique player IDs in this period
    const playerIds = new Set<string>();
    for (const m of matches) {
      playerIds.add(m.player_a_id);
      playerIds.add(m.player_b_id);
    }

    // Get latest snapshots for all players
    const snapshotMap = await this.snapshotsService.getLatestSnapshotsForPlayers(
      [...playerIds]
    );

    // Convert DB snapshots to core PlayerRating objects
    const playerRatingMap = new Map<string, PlayerRating>();
    for (const [pid, snap] of snapshotMap.entries()) {
      playerRatingMap.set(pid, {
        rating: snap.rating,
        ratingDeviation: snap.rating_deviation,
        volatility: snap.volatility,
        matchCount: snap.match_count,
        confidenceStatus: snap.confidence_status as import("@ping-pang/pgr-core").ConfidenceStatus,
        isProvisional: snap.is_provisional,
        initializationSource: (snap.initialization_source ?? "PING_PANG") as import("@ping-pang/pgr-core").DataSource,
        algorithmVersion: snap.algorithm_version,
      });
    }

    // Players without a snapshot get the default rating
    for (const pid of playerIds) {
      if (!playerRatingMap.has(pid)) {
        playerRatingMap.set(pid, {
          rating: PGR_CONFIG.DEFAULT_RATING,
          ratingDeviation: PGR_CONFIG.DEFAULT_RD,
          volatility: PGR_CONFIG.DEFAULT_VOLATILITY,
          matchCount: 0,
          confidenceStatus: "UNRATED",
          isProvisional: true,
          initializationSource: "PING_PANG",
          algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
        });
      }
    }

    // Build OpponentResult lists per player
    const resultsMap = new Map<string, OpponentResult[]>();
    for (const pid of playerIds) {
      resultsMap.set(pid, []);
    }

    for (const match of matches) {
      const ratingA = playerRatingMap.get(match.player_a_id)!;
      const ratingB = playerRatingMap.get(match.player_b_id)!;

      const outcomeA: OpponentResult = {
        opponentRating: ratingB.rating,
        opponentRD: ratingB.ratingDeviation,
        outcome: match.winner_id === match.player_a_id ? 1 : 0,
      };
      const outcomeB: OpponentResult = {
        opponentRating: ratingA.rating,
        opponentRD: ratingA.ratingDeviation,
        outcome: match.winner_id === match.player_b_id ? 1 : 0,
      };

      resultsMap.get(match.player_a_id)!.push(outcomeA);
      resultsMap.get(match.player_b_id)!.push(outcomeB);
    }

    // Run Glicko-2 for all players
    const inputs: RatingPeriodInput[] = [];
    const orderedIds: string[] = [];
    for (const pid of playerIds) {
      inputs.push({
        player: playerRatingMap.get(pid)!,
        results: resultsMap.get(pid)!,
      });
      orderedIds.push(pid);
    }

    const updates = calculateRatingPeriod(inputs);

    // Persist snapshots — use current time so snapshot_date ordering is correct.
    // periodEnd is the conceptual period boundary; the actual recalculation
    // timestamp is what matters for "get latest snapshot" queries.
    const snapshotDate = new Date();
    await Promise.all(
      updates.map((update, i) =>
        this.snapshotsService.createSnapshot({
          playerId: orderedIds[i],
          ratingUpdate: update,
          algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
          snapshotDate,
          trigger,
        })
      )
    );
  }

  // ── Single player recalculation ───────────────────────────────────────────

  /**
   * Recalculate one player's rating from scratch using all their confirmed matches.
   * Useful after data corrections or imports.
   */
  async recalculatePlayer(playerId: string) {
    const allMatches = await this.matchesService.getPlayerMatches(playerId, {
      validationStatus: "CONFIRMED",
    });

    const snapshots = await this.snapshotsService.getPlayerHistory(playerId, 1);
    const initSnap = snapshots[snapshots.length - 1]; // oldest = initialization

    const baseRating: PlayerRating = initSnap
      ? {
          rating: initSnap.rating,
          ratingDeviation: initSnap.rating_deviation,
          volatility: initSnap.volatility,
          matchCount: 0,
          confidenceStatus: "PROVISIONAL",
          isProvisional: true,
          initializationSource: (initSnap.initialization_source ?? "PING_PANG") as import("@ping-pang/pgr-core").DataSource,
          algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
        }
      : {
          rating: PGR_CONFIG.DEFAULT_RATING,
          ratingDeviation: PGR_CONFIG.DEFAULT_RD,
          volatility: PGR_CONFIG.DEFAULT_VOLATILITY,
          matchCount: 0,
          confidenceStatus: "UNRATED",
          isProvisional: true,
          initializationSource: "PING_PANG",
          algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
        };

    // Build opponent results (we need opponent ratings — use 1500 as fallback)
    const results: OpponentResult[] = allMatches.map((m) => {
      const isA = m.player_a_id === playerId;
      return {
        opponentRating: PGR_CONFIG.DEFAULT_RATING, // ideally fetch actual ratings
        opponentRD: PGR_CONFIG.DEFAULT_RD,
        outcome: m.winner_id === playerId ? 1 : 0,
      };
    });

    const update = calculateRatingUpdate(baseRating, results);

    return this.snapshotsService.createSnapshot({
      playerId,
      ratingUpdate: update,
      initializationSource: (baseRating.initializationSource) as PgrDataSource,
      algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
      snapshotDate: new Date(),
      trigger: "IMPORT_RECALCULATION",
    });
  }
}
