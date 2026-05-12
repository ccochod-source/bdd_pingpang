import { PrismaClient, Player, PlayerExternalId, PgrDataSource, PgrConfidenceLevel, Prisma } from "@prisma/client";
export interface CreatePlayerData {
    firstName: string;
    lastName: string;
    displayName?: string;
    countryCode?: string;
    birthYear?: number;
    gender?: string;
    category?: string;
    clubId?: string;
}
export interface AddExternalIdData {
    source: PgrDataSource;
    externalId: string;
    externalUrl?: string;
}
export interface AddExternalRankingData {
    source: PgrDataSource;
    rankingValue?: number;
    rank?: number;
    rankedAt: Date;
    confidenceLevel: PgrConfidenceLevel;
    importId?: string;
}
export declare class PlayersService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    create(data: CreatePlayerData): Promise<Player>;
    findById(id: string, include?: Prisma.PlayerInclude): Promise<Player | null>;
    findByExternalId(source: PgrDataSource, externalId: string): Promise<Player | null>;
    addExternalId(playerId: string, data: AddExternalIdData): Promise<PlayerExternalId>;
    /**
     * Create or update a player by their external ID.
     * Useful for idempotent imports (re-running an import won't duplicate players).
     */
    upsertByExternalId(source: PgrDataSource, externalId: string, data: CreatePlayerData): Promise<Player>;
    listByCountry(countryCode: string): Promise<Player[]>;
    /**
     * Add an external ranking entry for a player.
     * Used before initializePlayer() to seed source data.
     */
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
     * Get a player's external rankings, ordered by most recent first.
     * Useful to determine which source should initialize their PGR.
     */
    getExternalRankings(playerId: string): Promise<{
        id: string;
        created_at: Date;
        source: import(".prisma/client").$Enums.PgrDataSource;
        player_id: string;
        ranking_value: number | null;
        rank: number | null;
        ranked_at: Date;
        confidence_level: import(".prisma/client").$Enums.PgrConfidenceLevel;
        import_id: string | null;
    }[]>;
}
//# sourceMappingURL=players.service.d.ts.map