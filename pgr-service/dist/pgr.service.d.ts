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
import { PrismaClient, SnapshotTrigger } from "@prisma/client";
import { BeginnerLevel } from "@ping-pang/pgr-core";
import { PlayersService } from "./players.service.js";
import { MatchesService } from "./matches.service.js";
import { SnapshotsService } from "./snapshots.service.js";
export declare class PgrService {
    private readonly prisma;
    private readonly playersService;
    private readonly matchesService;
    private readonly snapshotsService;
    constructor(prisma: PrismaClient, playersService: PlayersService, matchesService: MatchesService, snapshotsService: SnapshotsService);
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
        confidence_status: import(".prisma/client").$Enums.ConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.DataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.SnapshotTrigger;
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
        confidence_status: import(".prisma/client").$Enums.ConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.DataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.SnapshotTrigger;
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
    processRatingPeriod(periodStart: Date, periodEnd: Date, trigger?: SnapshotTrigger): Promise<void>;
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
        confidence_status: import(".prisma/client").$Enums.ConfidenceStatus;
        is_provisional: boolean;
        initialization_source: import(".prisma/client").$Enums.DataSource | null;
        algorithm_version: string;
        snapshot_date: Date;
        trigger: import(".prisma/client").$Enums.SnapshotTrigger;
    }>;
}
//# sourceMappingURL=pgr.service.d.ts.map