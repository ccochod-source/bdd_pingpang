import { PrismaClient, Match, DataSource, ValidationStatus } from "@prisma/client";
import type { SetScore } from "@ping-pang/pgr-core";
export interface CreateMatchData {
    playerAId: string;
    playerBId: string;
    winnerId?: string;
    scoreA?: number;
    scoreB?: number;
    setsDetail?: SetScore[];
    playedAt: Date;
    competitionId?: string;
    source: DataSource;
    importId?: string;
}
export interface GetMatchesOptions {
    from?: Date;
    to?: Date;
    validationStatus?: ValidationStatus;
    source?: DataSource;
    limit?: number;
}
export declare class MatchesService {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    create(data: CreateMatchData): Promise<Match>;
    confirm(matchId: string): Promise<Match>;
    dispute(matchId: string): Promise<Match>;
    reject(matchId: string): Promise<Match>;
    getPlayerMatches(playerId: string, options?: GetMatchesOptions): Promise<Match[]>;
    /**
     * Get all CONFIRMED matches in a date range — used for rating period processing.
     */
    getConfirmedMatchesInPeriod(from: Date, to: Date): Promise<Match[]>;
    findById(id: string): Promise<Match | null>;
}
//# sourceMappingURL=matches.service.d.ts.map