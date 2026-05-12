"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchesService = void 0;
class MatchesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.match.create({
            data: {
                player_a_id: data.playerAId,
                player_b_id: data.playerBId,
                winner_id: data.winnerId,
                score_a: data.scoreA,
                score_b: data.scoreB,
                sets_detail: data.setsDetail
                    ? data.setsDetail
                    : undefined,
                played_at: data.playedAt,
                competition_id: data.competitionId,
                source: data.source,
                import_id: data.importId,
                validation_status: "PENDING",
            },
        });
    }
    async confirm(matchId) {
        return this.prisma.match.update({
            where: { id: matchId },
            data: { validation_status: "CONFIRMED" },
        });
    }
    async dispute(matchId) {
        return this.prisma.match.update({
            where: { id: matchId },
            data: { validation_status: "DISPUTED" },
        });
    }
    async reject(matchId) {
        return this.prisma.match.update({
            where: { id: matchId },
            data: { validation_status: "REJECTED" },
        });
    }
    async getPlayerMatches(playerId, options = {}) {
        const where = {
            OR: [{ player_a_id: playerId }, { player_b_id: playerId }],
            ...(options.from || options.to
                ? {
                    played_at: {
                        ...(options.from ? { gte: options.from } : {}),
                        ...(options.to ? { lte: options.to } : {}),
                    },
                }
                : {}),
            ...(options.validationStatus
                ? { validation_status: options.validationStatus }
                : {}),
            ...(options.source ? { source: options.source } : {}),
        };
        return this.prisma.match.findMany({
            where,
            orderBy: { played_at: "desc" },
            take: options.limit,
        });
    }
    /**
     * Get all CONFIRMED matches in a date range — used for rating period processing.
     */
    async getConfirmedMatchesInPeriod(from, to) {
        return this.prisma.match.findMany({
            where: {
                validation_status: "CONFIRMED",
                played_at: { gte: from, lte: to },
            },
            orderBy: { played_at: "asc" },
        });
    }
    async findById(id) {
        return this.prisma.match.findUnique({ where: { id } });
    }
}
exports.MatchesService = MatchesService;
//# sourceMappingURL=matches.service.js.map