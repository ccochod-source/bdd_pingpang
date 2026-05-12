import { Club, ExternalRanking, Player, PlayerExternalId, PgrConfidenceLevel, PrismaClient, PgrSnapshot, SourceImport, PgrDataSource } from "@prisma/client";
export interface StartImportData {
    source: PgrDataSource;
    fileName?: string;
    endpointUrl?: string;
    importedAt?: Date;
}
export interface NormalizedExternalClub {
    name: string;
    countryCode?: string | null;
    city?: string | null;
    source?: PgrDataSource | null;
    externalId?: string | null;
}
export interface NormalizedExternalRanking {
    source?: PgrDataSource | null;
    rankingValue?: number | null;
    rank?: number | null;
    totalPlayers?: number | null;
    rankedAt?: Date | string | null;
    confidenceLevel?: PgrConfidenceLevel;
}
export interface NormalizedExternalPlayer {
    source?: PgrDataSource | null;
    externalId?: string | null;
    externalUrl?: string | null;
    firstName: string;
    lastName: string;
    displayName?: string | null;
    countryCode?: string | null;
    birthYear?: number | null;
    gender?: string | null;
    category?: string | null;
    club?: NormalizedExternalClub | null;
    ranking?: NormalizedExternalRanking | null;
    rankings?: NormalizedExternalRanking[];
}
export interface ImportNormalizedPlayersData extends StartImportData {
    players: NormalizedExternalPlayer[];
}
export interface ImportedNormalizedPlayerResult {
    player: Player;
    createdPlayer: boolean;
    club: Club | null;
    externalId: PlayerExternalId | null;
    rankings: ExternalRanking[];
    createdRankings: number;
    snapshot: PgrSnapshot | null;
    createdSnapshot: boolean;
}
export interface ImportNormalizedPlayersResult {
    import: SourceImport;
    players: ImportedNormalizedPlayerResult[];
    createdPlayers: number;
    existingPlayers: number;
    createdRankings: number;
    createdSnapshots: number;
}
export declare class ImportsService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    /**
     * Create a new import record in PENDING state.
     * Call this before starting to insert records.
     */
    startImport(data: StartImportData): Promise<SourceImport>;
    /**
     * Mark an import as completed and record how many records were inserted.
     */
    completeImport(importId: string, recordCount: number): Promise<SourceImport>;
    /**
     * Mark an import as failed and store the error message.
     */
    failImport(importId: string, errorMessage: string): Promise<SourceImport>;
    findById(importId: string): Promise<SourceImport | null>;
    listRecentImports(limit?: number): Promise<SourceImport[]>;
    listBySource(source: PgrDataSource): Promise<SourceImport[]>;
    /**
     * Import already-normalized player records from any external source.
     *
     * This layer deliberately does not scrape anything. It only accepts data that
     * a future source adapter has already normalized.
     */
    importNormalizedPlayers(data: ImportNormalizedPlayersData): Promise<ImportNormalizedPlayersResult>;
    private importNormalizedPlayer;
    private findOrCreateClub;
    private findOrCreatePlayer;
    private findPlayerByExternalId;
    private findSinglePlayerByIdentity;
    private addPlayerExternalId;
    private collectRankings;
    private addExternalRankingIfMissing;
    private initializeSnapshotIfMissing;
}
//# sourceMappingURL=imports.service.d.ts.map