import {
  PrismaClient,
  SourceImport,
  PgrDataSource,
  PgrImportStatus,
} from "@prisma/client";

export interface StartImportData {
  source: PgrDataSource;
  fileName?: string;
  endpointUrl?: string;
}

export class ImportsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new import record in PENDING state.
   * Call this before starting to insert records.
   */
  async startImport(data: StartImportData): Promise<SourceImport> {
    return this.prisma.sourceImport.create({
      data: {
        source: data.source,
        imported_at: new Date(),
        file_name: data.fileName,
        endpoint_url: data.endpointUrl,
        status: "PENDING",
      },
    });
  }

  /**
   * Mark an import as completed and record how many records were inserted.
   */
  async completeImport(
    importId: string,
    recordCount: number
  ): Promise<SourceImport> {
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
  async failImport(
    importId: string,
    errorMessage: string
  ): Promise<SourceImport> {
    return this.prisma.sourceImport.update({
      where: { id: importId },
      data: {
        status: "FAILED",
        error_message: errorMessage,
      },
    });
  }

  async findById(importId: string): Promise<SourceImport | null> {
    return this.prisma.sourceImport.findUnique({ where: { id: importId } });
  }

  async listRecentImports(limit = 20): Promise<SourceImport[]> {
    return this.prisma.sourceImport.findMany({
      orderBy: { imported_at: "desc" },
      take: limit,
    });
  }

  async listBySource(source: PgrDataSource): Promise<SourceImport[]> {
    return this.prisma.sourceImport.findMany({
      where: { source },
      orderBy: { imported_at: "desc" },
    });
  }
}
