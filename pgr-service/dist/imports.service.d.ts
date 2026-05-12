import { PrismaClient, SourceImport, DataSource } from "@prisma/client";
export interface StartImportData {
    source: DataSource;
    fileName?: string;
    endpointUrl?: string;
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
    listBySource(source: DataSource): Promise<SourceImport[]>;
}
//# sourceMappingURL=imports.service.d.ts.map