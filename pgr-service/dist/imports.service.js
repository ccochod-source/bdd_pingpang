"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportsService = void 0;
const pgr_core_1 = require("@ping-pang/pgr-core");
class ImportsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Create a new import record in PENDING state.
     * Call this before starting to insert records.
     */
    async startImport(data) {
        return this.prisma.sourceImport.create({
            data: {
                source: data.source,
                imported_at: data.importedAt ?? new Date(),
                file_name: data.fileName,
                endpoint_url: data.endpointUrl,
                status: "PENDING",
            },
        });
    }
    /**
     * Mark an import as completed and record how many records were inserted.
     */
    async completeImport(importId, recordCount) {
        return this.prisma.sourceImport.update({
            where: { id: importId },
            data: {
                status: "DONE",
                record_count: recordCount,
            },
        });
    }
    /**
     * Mark an import as failed and store the error message.
     */
    async failImport(importId, errorMessage) {
        return this.prisma.sourceImport.update({
            where: { id: importId },
            data: {
                status: "FAILED",
                error_message: errorMessage,
            },
        });
    }
    async findById(importId) {
        return this.prisma.sourceImport.findUnique({ where: { id: importId } });
    }
    async listRecentImports(limit = 20) {
        return this.prisma.sourceImport.findMany({
            orderBy: { imported_at: "desc" },
            take: limit,
        });
    }
    async listBySource(source) {
        return this.prisma.sourceImport.findMany({
            where: { source },
            orderBy: { imported_at: "desc" },
        });
    }
    /**
     * Import already-normalized player records from any external source.
     *
     * This layer deliberately does not scrape anything. It only accepts data that
     * a future source adapter has already normalized.
     */
    async importNormalizedPlayers(data) {
        const sourceImport = await this.startImport(data);
        try {
            const results = [];
            for (const normalizedPlayer of data.players) {
                results.push(await this.importNormalizedPlayer(data.source, normalizedPlayer, sourceImport));
            }
            const completedImport = await this.completeImport(sourceImport.id, data.players.length);
            return {
                import: completedImport,
                players: results,
                createdPlayers: results.filter((r) => r.createdPlayer).length,
                existingPlayers: results.filter((r) => !r.createdPlayer).length,
                createdRankings: results.reduce((sum, r) => sum + r.createdRankings, 0),
                createdSnapshots: results.filter((r) => r.createdSnapshot).length,
            };
        }
        catch (error) {
            await this.failImport(sourceImport.id, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    async importNormalizedPlayer(importSource, normalizedPlayer, sourceImport) {
        const source = normalizedPlayer.source ?? importSource;
        const firstName = requireText(normalizedPlayer.firstName, "firstName");
        const lastName = requireText(normalizedPlayer.lastName, "lastName");
        const countryCode = normalizeCountryCode(normalizedPlayer.countryCode);
        const displayName = normalizeOptionalText(normalizedPlayer.displayName) ??
            `${firstName} ${lastName}`;
        const externalId = normalizeOptionalText(normalizedPlayer.externalId);
        const club = await this.findOrCreateClub(source, normalizedPlayer.club);
        const { player, createdPlayer } = await this.findOrCreatePlayer({
            source,
            externalId,
            firstName,
            lastName,
            displayName,
            countryCode,
            birthYear: normalizedPlayer.birthYear ?? undefined,
            gender: normalizeOptionalText(normalizedPlayer.gender),
            category: normalizeOptionalText(normalizedPlayer.category),
            clubId: club?.id,
        });
        const externalIdRow = externalId
            ? await this.addPlayerExternalId(player.id, {
                source,
                externalId,
                externalUrl: normalizeOptionalText(normalizedPlayer.externalUrl),
            })
            : null;
        const normalizedRankings = this.collectRankings(source, normalizedPlayer, sourceImport.imported_at);
        const rankings = [];
        let createdRankings = 0;
        for (const ranking of normalizedRankings) {
            const result = await this.addExternalRankingIfMissing(player.id, ranking, sourceImport.id);
            rankings.push(result.ranking);
            if (result.created)
                createdRankings++;
        }
        const snapshot = await this.initializeSnapshotIfMissing(player.id, normalizedRankings);
        return {
            player,
            createdPlayer,
            club,
            externalId: externalIdRow,
            rankings,
            createdRankings,
            snapshot,
            createdSnapshot: snapshot !== null,
        };
    }
    async findOrCreateClub(source, club) {
        if (!club)
            return null;
        const name = requireText(club.name, "club.name");
        const countryCode = normalizeCountryCode(club.countryCode);
        const city = normalizeOptionalText(club.city);
        const clubSource = club.source ?? source;
        const externalId = normalizeOptionalText(club.externalId);
        if (externalId) {
            const existingByExternalId = await this.prisma.club.findFirst({
                where: {
                    source: clubSource,
                    external_id: externalId,
                },
            });
            if (existingByExternalId) {
                return this.prisma.club.update({
                    where: { id: existingByExternalId.id },
                    data: {
                        name,
                        country_code: countryCode,
                        city,
                        source: clubSource,
                        external_id: externalId,
                    },
                });
            }
        }
        const fallbackWhere = {
            name: { equals: name, mode: "insensitive" },
        };
        if (countryCode)
            fallbackWhere.country_code = countryCode;
        if (city)
            fallbackWhere.city = { equals: city, mode: "insensitive" };
        const existingByName = await this.prisma.club.findFirst({
            where: fallbackWhere,
        });
        if (existingByName)
            return existingByName;
        return this.prisma.club.create({
            data: {
                name,
                country_code: countryCode,
                city,
                source: clubSource,
                external_id: externalId,
            },
        });
    }
    async findOrCreatePlayer(data) {
        const existingByExternalId = data.externalId
            ? await this.findPlayerByExternalId(data.source, data.externalId)
            : null;
        const fallbackPlayer = existingByExternalId ??
            (!data.externalId
                ? await this.findSinglePlayerByIdentity({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    countryCode: data.countryCode,
                    birthYear: data.birthYear,
                    gender: data.gender,
                })
                : null);
        if (fallbackPlayer) {
            const updateData = {
                first_name: data.firstName,
                last_name: data.lastName,
                display_name: data.displayName,
            };
            if (data.countryCode)
                updateData.country_code = data.countryCode;
            if (data.birthYear)
                updateData.birth_year = data.birthYear;
            if (data.gender)
                updateData.gender = data.gender;
            if (data.category)
                updateData.category = data.category;
            if (data.clubId)
                updateData.club_id = data.clubId;
            const player = await this.prisma.player.update({
                where: { id: fallbackPlayer.id },
                data: updateData,
            });
            return { player, createdPlayer: false };
        }
        const player = await this.prisma.player.create({
            data: {
                first_name: data.firstName,
                last_name: data.lastName,
                display_name: data.displayName,
                country_code: data.countryCode,
                birth_year: data.birthYear,
                gender: data.gender,
                category: data.category,
                club_id: data.clubId,
            },
        });
        return { player, createdPlayer: true };
    }
    async findPlayerByExternalId(source, externalId) {
        const row = await this.prisma.playerExternalId.findUnique({
            where: {
                source_external_id: {
                    source,
                    external_id: externalId,
                },
            },
            include: { player: true },
        });
        return row?.player ?? null;
    }
    async findSinglePlayerByIdentity(data) {
        if (!data.countryCode)
            return null;
        const where = {
            first_name: { equals: data.firstName, mode: "insensitive" },
            last_name: { equals: data.lastName, mode: "insensitive" },
            country_code: data.countryCode,
        };
        if (data.birthYear)
            where.birth_year = data.birthYear;
        if (data.gender)
            where.gender = data.gender;
        const candidates = await this.prisma.player.findMany({
            where,
            take: 2,
        });
        if (candidates.length > 1) {
            throw new Error(`Ambiguous player fallback for ${data.firstName} ${data.lastName} (${data.countryCode})`);
        }
        return candidates[0] ?? null;
    }
    async addPlayerExternalId(playerId, data) {
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
    collectRankings(defaultSource, player, importedAt) {
        const rawRankings = [
            ...(player.ranking ? [player.ranking] : []),
            ...(player.rankings ?? []),
        ];
        return rawRankings.map((ranking) => ({
            source: ranking.source ?? defaultSource,
            rankingValue: ranking.rankingValue ?? null,
            rank: ranking.rank ?? null,
            totalPlayers: ranking.totalPlayers ?? null,
            rankedAt: toDateOnly(ranking.rankedAt ?? importedAt),
            confidenceLevel: ranking.confidenceLevel ?? "MEDIUM",
        }));
    }
    async addExternalRankingIfMissing(playerId, data, importId) {
        const existing = await this.prisma.externalRanking.findFirst({
            where: {
                player_id: playerId,
                source: data.source,
                ranking_value: data.rankingValue,
                rank: data.rank,
                ranked_at: data.rankedAt,
            },
        });
        if (existing) {
            const ranking = await this.prisma.externalRanking.update({
                where: { id: existing.id },
                data: {
                    confidence_level: data.confidenceLevel,
                    import_id: importId,
                },
            });
            return { ranking, created: false };
        }
        const ranking = await this.prisma.externalRanking.create({
            data: {
                player_id: playerId,
                source: data.source,
                ranking_value: data.rankingValue,
                rank: data.rank,
                ranked_at: data.rankedAt,
                confidence_level: data.confidenceLevel,
                import_id: importId,
            },
        });
        return { ranking, created: true };
    }
    async initializeSnapshotIfMissing(playerId, rankings) {
        const existingSnapshot = await this.prisma.pgrSnapshot.findFirst({
            where: { player_id: playerId },
            orderBy: { snapshot_date: "desc" },
        });
        if (existingSnapshot)
            return null;
        const externalRankingInputs = rankings.map((r) => ({
            source: r.source,
            rankingValue: r.rankingValue,
            rank: r.rank,
            totalPlayers: r.totalPlayers,
        }));
        const initial = (0, pgr_core_1.initFromBestAvailableSource)(externalRankingInputs) ??
            (0, pgr_core_1.initFromQuestionnaire)("CLUB_BEGINNER");
        return this.prisma.pgrSnapshot.create({
            data: {
                player_id: playerId,
                rating: initial.rating,
                rating_deviation: initial.ratingDeviation,
                volatility: initial.volatility,
                match_count: 0,
                confidence_status: "PROVISIONAL",
                is_provisional: true,
                initialization_source: initial.initializationSource,
                algorithm_version: pgr_core_1.PGR_CONFIG.ALGORITHM_VERSION,
                snapshot_date: new Date(),
                trigger: "INITIALIZATION",
            },
        });
    }
}
exports.ImportsService = ImportsService;
function requireText(value, fieldName) {
    const normalized = normalizeOptionalText(value);
    if (!normalized) {
        throw new Error(`Missing required normalized player field: ${fieldName}`);
    }
    return normalized;
}
function normalizeOptionalText(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function normalizeCountryCode(value) {
    return normalizeOptionalText(value)?.toUpperCase();
}
function toDateOnly(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
//# sourceMappingURL=imports.service.js.map