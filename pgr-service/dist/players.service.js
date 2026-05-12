"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersService = void 0;
class PlayersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.player.create({
            data: {
                first_name: data.firstName,
                last_name: data.lastName,
                display_name: data.displayName ?? `${data.firstName} ${data.lastName}`,
                country_code: data.countryCode,
                birth_year: data.birthYear,
                gender: data.gender,
                category: data.category,
                club_id: data.clubId,
            },
        });
    }
    async findById(id, include) {
        return this.prisma.player.findUnique({ where: { id }, include });
    }
    async findByExternalId(source, externalId) {
        const ext = await this.prisma.playerExternalId.findUnique({
            where: { source_external_id: { source, external_id: externalId } },
            include: { player: true },
        });
        return ext?.player ?? null;
    }
    async addExternalId(playerId, data) {
        return this.prisma.playerExternalId.upsert({
            where: {
                source_external_id: {
                    source: data.source,
                    external_id: data.externalId,
                },
            },
            create: {
                player_id: playerId,
                source: data.source,
                external_id: data.externalId,
                external_url: data.externalUrl,
            },
            update: {
                external_url: data.externalUrl,
            },
        });
    }
    /**
     * Create or update a player by their external ID.
     * Useful for idempotent imports (re-running an import won't duplicate players).
     */
    async upsertByExternalId(source, externalId, data) {
        const existing = await this.findByExternalId(source, externalId);
        if (existing) {
            return this.prisma.player.update({
                where: { id: existing.id },
                data: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    display_name: data.displayName ?? `${data.firstName} ${data.lastName}`,
                    country_code: data.countryCode,
                    birth_year: data.birthYear,
                    gender: data.gender,
                    category: data.category,
                },
            });
        }
        const player = await this.create(data);
        await this.addExternalId(player.id, { source, externalId });
        return player;
    }
    async listByCountry(countryCode) {
        return this.prisma.player.findMany({ where: { country_code: countryCode } });
    }
    /**
     * Get a player's external rankings, ordered by most recent first.
     * Useful to determine which source should initialize their PGR.
     */
    async getExternalRankings(playerId) {
        return this.prisma.externalRanking.findMany({
            where: { player_id: playerId },
            orderBy: { ranked_at: "desc" },
        });
    }
}
exports.PlayersService = PlayersService;
//# sourceMappingURL=players.service.js.map