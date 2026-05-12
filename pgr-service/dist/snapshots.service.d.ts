import { PrismaClient, PgrSnapshot, DataSource, SnapshotTrigger } from "@prisma/client";
import type { RatingUpdate } from "@ping-pang/pgr-core";
export interface CreateSnapshotData {
    playerId: string;
    ratingUpdate: RatingUpdate;
    initializationSource?: DataSource;
    algorithmVersion: string;
    snapshotDate: Date;
    trigger: SnapshotTrigger;
}
export declare class SnapshotsService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    createSnapshot(data: CreateSnapshotData): Promise<PgrSnapshot>;
    getLatestSnapshot(playerId: string): Promise<PgrSnapshot | null>;
    /**
     * Get the PGR history for a player, most recent first.
     */
    getPlayerHistory(playerId: string, limit?: number): Promise<PgrSnapshot[]>;
    /**
     * Get the latest snapshot for every player in a list.
     * Returns a Map<playerId, PgrSnapshot>.
     */
    getLatestSnapshotsForPlayers(playerIds: string[]): Promise<Map<string, PgrSnapshot>>;
    /**
     * Leaderboard: top N players by rating, optionally filtered by country.
     */
    getLeaderboard(options?: {
        limit?: number;
        countryCode?: string;
    }): Promise<PgrSnapshot[]>;
}
//# sourceMappingURL=snapshots.service.d.ts.map