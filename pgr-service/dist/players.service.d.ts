import { PrismaClient, Player, PlayerExternalId, DataSource, Prisma } from "@prisma/client";
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
    source: DataSource;
    externalId: string;
    externalUrl?: string;
}
export declare class PlayersService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    create(data: CreatePlayerData): Promise<Player>;
    findById(id: string, include?: Prisma.PlayerInclude): Promise<Player | null>;
    findByExternalId(source: DataSource, externalId: string): Promise<Player | null>;
    addExternalId(playerId: string, data: AddExternalIdData): Promise<PlayerExternalId>;
    /**
     * Create or update a player by their external ID.
     * Useful for idempotent imports (re-running an import won't duplicate players).
     */
    upsertByExternalId(source: DataSource, externalId: string, data: CreatePlayerData): Promise<Player>;
    listByCountry(countryCode: string): Promise<Player[]>;
    /**
     * Get a player's external rankings, ordered by most recent first.
     * Useful to determine which source should initialize their PGR.
     */
    getExternalRankings(playerId: string): Promise<{
        id: string;
        source: import(".prisma/client").$Enums.DataSource;
        created_at: Date;
        player_id: string;
        ranking_value: number | null;
        rank: number | null;
        ranked_at: Date;
        confidence_level: import(".prisma/client").$Enums.ConfidenceLevel;
        import_id: string | null;
    }[]>;
}
//# sourceMappingURL=players.service.d.ts.map