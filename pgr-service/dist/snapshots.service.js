"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotsService = void 0;
class SnapshotsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSnapshot(data) {
        return this.prisma.pgrSnapshot.create({
            data: {
                player_id: data.playerId,
                rating: data.ratingUpdate.rating,
                rating_deviation: data.ratingUpdate.ratingDeviation,
                volatility: data.ratingUpdate.volatility,
                match_count: data.ratingUpdate.matchCount,
                confidence_status: data.ratingUpdate
                    .confidenceStatus,
                is_provisional: data.ratingUpdate.isProvisional,
                initialization_source: data.initializationSource,
                algorithm_version: data.algorithmVersion,
                snapshot_date: data.snapshotDate,
                trigger: data.trigger,
            },
        });
    }
    async getLatestSnapshot(playerId) {
        return this.prisma.pgrSnapshot.findFirst({
            where: { player_id: playerId },
            orderBy: { snapshot_date: "desc" },
        });
    }
    /**
     * Get the PGR history for a player, most recent first.
     */
    async getPlayerHistory(playerId, limit = 50) {
        return this.prisma.pgrSnapshot.findMany({
            where: { player_id: playerId },
            orderBy: { snapshot_date: "desc" },
            take: limit,
        });
    }
    /**
     * Get the latest snapshot for every player in a list.
     * Returns a Map<playerId, PgrSnapshot>.
     */
    async getLatestSnapshotsForPlayers(playerIds) {
        // Fetch all and keep the latest per player
        const rows = await this.prisma.pgrSnapshot.findMany({
            where: { player_id: { in: playerIds } },
            orderBy: { snapshot_date: "desc" },
        });
        const map = new Map();
        for (const row of rows) {
            if (!map.has(row.player_id)) {
                map.set(row.player_id, row);
            }
        }
        return map;
    }
    /**
     * Leaderboard: top N players by rating, optionally filtered by country.
     * Returns snapshots with player info included.
     */
    async getLeaderboard(options = {}) {
        const { limit = 100, countryCode } = options;
        const rows = await this.prisma.pgrSnapshot.findMany({
            where: {
                player: countryCode ? { country_code: countryCode } : undefined,
            },
            include: { player: true },
            orderBy: { snapshot_date: "desc" },
        });
        // Deduplicate: keep only the latest snapshot per player
        const seen = new Set();
        const latest = [];
        for (const row of rows) {
            if (!seen.has(row.player_id)) {
                seen.add(row.player_id);
                latest.push(row);
            }
        }
        return latest
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit);
    }
}
exports.SnapshotsService = SnapshotsService;
//# sourceMappingURL=snapshots.service.js.map