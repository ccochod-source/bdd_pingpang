"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportsService = void 0;
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
}
exports.ImportsService = ImportsService;
//# sourceMappingURL=imports.service.js.map