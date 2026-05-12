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
import { PrismaClient, PgrSnapshotTrigger } from "@prisma/client";
import { BeginnerLevel } from "@ping-pang/pgr-core";
import { PlayersService, CreatePlayerData, AddExternalRankingData } from "./players.service.js";
import { MatchesService, CreateMatchData } from "./matches.service.js";
import { SnapshotsService } from "./snapshots.service.js";
export declare class PgrService {
    private readonly prisma;
    private readonly playersService;
    private readonly matchesService;
    private readonly snapshotsService;
    constructor(prisma: PrismaClient, playersService: PlayersService, matchesService: MatchesService, snapshotsService: SnapshotsService);
    createPlayer(data: CreatePlayerData): Promise<{
        id: string;
        user_id: string | null;
        first_name: string;
        last_name: string;
        display_name: string;
        country_code: string | null;
        birth_year: number | null;
        gender: string | null;
        category: string | null;
        club_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    addExternalRanking(playerId: string, data: AddExternalRankingData): Promise<{
        id: string;
        created_at: Date;
        source: import(".prisma/client").$Enums.PgrDataSource;
        player_id: string;
        ranking_value: number | null;
        rank: number | null;
        ranked_at: Date;
        confidence_level: import(".prisma/client").$Enums.PgrConfidenceLevel;
        import_id: string | null;
    }>;
    /**
     * Current PGR for one player: latest snapshot + player info + public display.
     * Returns null if the player doesn't exist.
     *
     * publicDisplay: ready-to-use presentation object for the frontend.
     *   - { visible: false, label: "En évaluation" }  when matchCount < 3
     *   - { visible: true, rating, label, confidenceStatus } otherwise
     * The internal rating is always preserved in `snapshot` regardless.
     */
    getCurrentRating(playerId: string): Promise<{
        player: {
            id: string;
            user_id: string | null;
            first_name: string;
            last_name: string;
            display_name: string;
            country_code: string | null;
            birth_year: number | null;
            gender: string | null;
            category: string | null;
            club_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
        snapshot: {
            id: string;
            created_at: Date;
            player_id: string;
            rating: number;
            rating_deviation: number;
            volatility: number;
            match_count: number;
            confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
            is_provisional: boolean;
            initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
            algorithm_version: string;
            snapshot_date: Date;
            trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
        } | null;
        publicDisplay: import("@ping-pang/pgr-core").PublicRatingDisplay;
    } | null>;
    /**
     * Global or per-country leaderboard, sorted by rating descending.
     * Each entry includes player info + publicDisplay.
     */
    getLeaderboard(options?: {
        countryCode?: string;
        limit?: number;
    }): Promise<{
        publicDisplay: import("@ping-pang/pgr-core").PublicRatingDisplay;
        player: {
            id: string;
            user_id: string | null;
            first_name: string;
            last_name: string;
            display_name: string;
            country_code: string | null;
            birth_year: number | null;
            gender: string | null;
            category: string | null;
            club_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
        id: string;
        created_at: Date;
        player_id: string;
        rating: number;
        rating_deviation: number;
        volatility: number;
        match_count: number;
        confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
    }[]>;
    /**
     * Full PGR history for one player, most recent first.
     * Each snapshot carries its own publicDisplay at the time it was created.
     */
    getPlayerHistory(playerId: string, limit?: number): Promise<{
        player: {
            id: string;
            user_id: string | null;
            first_name: string;
            last_name: string;
            display_name: string;
            country_code: string | null;
            birth_year: number | null;
            gender: string | null;
            category: string | null;
            club_id: string | null;
            created_at: Date;
            updated_at: Date;
        } | null;
        history: {
            publicDisplay: import("@ping-pang/pgr-core").PublicRatingDisplay;
            id: string;
            created_at: Date;
            player_id: string;
            rating: number;
            rating_deviation: number;
            volatility: number;
            match_count: number;
            confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
            is_provisional: boolean;
            initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
            algorithm_version: string;
            snapshot_date: Date;
            trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
        }[];
    }>;
    /**
     * Record a new match. Status starts as PENDING.
     */
    createMatch(data: CreateMatchData): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        source: import(".prisma/client").$Enums.PgrDataSource;
        import_id: string | null;
        player_a_id: string;
        player_b_id: string;
        winner_id: string | null;
        score_a: number | null;
        score_b: number | null;
        sets_detail: import("@prisma/client/runtime/library.js").JsonValue | null;
        played_at: Date;
        competition_id: string | null;
        validation_status: import(".prisma/client").$Enums.PgrValidationStatus;
    }>;
    /**
     * Confirm a pending match. Once confirmed it will be included in the next
     * rating period processing.
     */
    confirmMatch(matchId: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        source: import(".prisma/client").$Enums.PgrDataSource;
        import_id: string | null;
        player_a_id: string;
        player_b_id: string;
        winner_id: string | null;
        score_a: number | null;
        score_b: number | null;
        sets_detail: import("@prisma/client/runtime/library.js").JsonValue | null;
        played_at: Date;
        competition_id: string | null;
        validation_status: import(".prisma/client").$Enums.PgrValidationStatus;
    }>;
    /**
     * Process all CONFIRMED matches in a date window and update PGR snapshots.
     * Defaults to all time if no window is provided.
     *
     * @param options.since  - only include matches from this date (inclusive)
     * @param options.until  - only include matches up to this date (inclusive)
     */
    processConfirmedMatches(options?: {
        since?: Date;
        until?: Date;
    }): Promise<void>;
    /**
     * Initialize a player's PGR from their external rankings.
     * If no external ranking is found, falls back to CLUB_BEGINNER level.
     */
    initializePlayer(playerId: string): Promise<{
        id: string;
        created_at: Date;
        player_id: string;
        rating: number;
        rating_deviation: number;
        volatility: number;
        match_count: number;
        confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
    }>;
    /**
     * Initialize from a beginner questionnaire response.
     */
    initializeFromQuestionnaire(playerId: string, level: BeginnerLevel): Promise<{
        id: string;
        created_at: Date;
        player_id: string;
        rating: number;
        rating_deviation: number;
        volatility: number;
        match_count: number;
        confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
    }>;
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
    processRatingPeriod(periodStart: Date, periodEnd: Date, trigger?: PgrSnapshotTrigger): Promise<void>;
    /**
     * Recalculate one player's rating from scratch using all their confirmed matches.
     * Useful after data corrections or imports.
     */
    recalculatePlayer(playerId: string): Promise<{
        id: string;
        created_at: Date;
        player_id: string;
        rating: number;
        rating_deviation: number;
        volatility: number;
        match_count: number;
        confidence_status: import(".prisma/client").$Enums.PgrConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.PgrDataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.PgrSnapshotTrigger;
    }>;
}
//# sourceMappingURL=pgr.service.d.ts.map