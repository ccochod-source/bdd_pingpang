import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ImportsService } from "../src/imports.service.js";

const PGR_TABLE_BY_DELEGATE: Record<string, string> = {
  sourceImport: "pgr_source_imports",
  player: "pgr_players",
  playerExternalId: "pgr_player_external_ids",
  externalRanking: "pgr_external_rankings",
  club: "pgr_clubs",
  pgrSnapshot: "pgr_snapshots",
};

describe("ImportsService.importNormalizedPlayers", () => {
  it("imports a WTT top player", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);

    const result = await service.importNormalizedPlayers({
      source: "WTT",
      fileName: "wtt-top.csv",
      importedAt: new Date("2026-05-01T00:00:00Z"),
      players: [
        {
          externalId: "wtt-1",
          firstName: "Ma",
          lastName: "Long",
          countryCode: "CN",
          gender: "M",
          ranking: {
            rank: 1,
            rankingValue: 8500,
            rankedAt: new Date("2026-05-01"),
            confidenceLevel: "HIGH",
          },
        },
      ],
    });

    expect(result.import.status).toBe("DONE");
    expect(result.createdPlayers).toBe(1);
    expect(result.createdRankings).toBe(1);
    expect(db.players).toHaveLength(1);
    expect(db.playerExternalIds).toHaveLength(1);
    expect(db.externalRankings).toHaveLength(1);
    expect(db.pgrSnapshots).toHaveLength(1);
    expect(db.pgrSnapshots[0].initialization_source).toBe("WTT");
    expect(db.pgrSnapshots[0].rating).toBeGreaterThan(2800);
  });

  it("imports an FFTT player and creates the club", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);

    await service.importNormalizedPlayers({
      source: "FFTT",
      fileName: "fftt.csv",
      players: [
        {
          externalId: "fftt-123",
          firstName: "Camille",
          lastName: "Roux",
          countryCode: "FR",
          club: {
            name: "Paris XV Tennis de Table",
            countryCode: "FR",
            city: "Paris",
            externalId: "club-75015",
          },
          ranking: {
            rankingValue: 1850,
            rankedAt: new Date("2026-04-01"),
            confidenceLevel: "HIGH",
          },
        },
      ],
    });

    expect(db.clubs).toHaveLength(1);
    expect(db.players[0].club_id).toBe(db.clubs[0].id);
    expect(db.externalRankings[0].source).toBe("FFTT");
    expect(db.externalRankings[0].ranking_value).toBe(1850);
    expect(db.pgrSnapshots[0].initialization_source).toBe("FFTT");
    expect(db.pgrSnapshots[0].rating).toBeCloseTo(1710, 0);
  });

  it("imports a TTR player", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);

    await service.importNormalizedPlayers({
      source: "TTR",
      players: [
        {
          externalId: "ttr-456",
          firstName: "Anna",
          lastName: "Schmidt",
          countryCode: "DE",
          ranking: {
            rankingValue: 1830,
            rankedAt: new Date("2026-04-15"),
            confidenceLevel: "HIGH",
          },
        },
      ],
    });

    expect(db.players).toHaveLength(1);
    expect(db.externalRankings[0].source).toBe("TTR");
    expect(db.pgrSnapshots[0].initialization_source).toBe("TTR");
    expect(db.pgrSnapshots[0].rating).toBeCloseTo(1797, 0);
  });

  it("imports a player without external_id using the cautious identity fallback", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);
    const player = {
      firstName: "Lucia",
      lastName: "Garcia",
      countryCode: "ES",
      ranking: {
        source: "RFETM" as const,
        rank: 12,
        totalPlayers: 1000,
        rankedAt: new Date("2026-03-01"),
      },
    };

    await service.importNormalizedPlayers({
      source: "RFETM",
      players: [player],
    });
    await service.importNormalizedPlayers({
      source: "RFETM",
      players: [player],
    });

    expect(db.players).toHaveLength(1);
    expect(db.playerExternalIds).toHaveLength(0);
    expect(db.externalRankings).toHaveLength(1);
    expect(db.pgrSnapshots).toHaveLength(1);
  });

  it("can replay the same import without duplicating players, ids, rankings, clubs, or snapshots", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);
    const importPayload = {
      source: "WTT" as const,
      fileName: "wtt-replay.csv",
      importedAt: new Date("2026-05-01T00:00:00Z"),
      players: [
        {
          externalId: "wtt-999",
          firstName: "Replay",
          lastName: "Player",
          countryCode: "JP",
          club: {
            name: "Tokyo Table Tennis Club",
            countryCode: "JP",
            externalId: "club-tokyo-1",
          },
          ranking: {
            rank: 25,
            rankingValue: 3200,
            rankedAt: new Date("2026-05-01"),
            confidenceLevel: "HIGH" as const,
          },
        },
      ],
    };

    const first = await service.importNormalizedPlayers(importPayload);
    const second = await service.importNormalizedPlayers(importPayload);

    expect(first.createdPlayers).toBe(1);
    expect(second.createdPlayers).toBe(0);
    expect(second.existingPlayers).toBe(1);
    expect(second.createdRankings).toBe(0);
    expect(second.createdSnapshots).toBe(0);
    expect(db.sourceImports).toHaveLength(2);
    expect(db.players).toHaveLength(1);
    expect(db.playerExternalIds).toHaveLength(1);
    expect(db.externalRankings).toHaveLength(1);
    expect(db.clubs).toHaveLength(1);
    expect(db.pgrSnapshots).toHaveLength(1);
  });

  it("creates an initial PGR snapshot even without ranking data", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);

    await service.importNormalizedPlayers({
      source: "RANKEDIN",
      players: [
        {
          externalId: "rankedin-1",
          firstName: "No",
          lastName: "Ranking",
          countryCode: "GB",
        },
      ],
    });

    expect(db.pgrSnapshots).toHaveLength(1);
    expect(db.pgrSnapshots[0].match_count).toBe(0);
    expect(db.pgrSnapshots[0].initialization_source).toBe("QUESTIONNAIRE");
    expect(db.pgrSnapshots[0].rating).toBe(1300);
  });

  it("only touches Prisma delegates mapped to pgr_ tables", async () => {
    const db = new FakePgrDb();
    const service = new ImportsService(db.prisma);

    await service.importNormalizedPlayers({
      source: "FFTT",
      players: [
        {
          externalId: "fftt-safe-table-check",
          firstName: "Safe",
          lastName: "Import",
          countryCode: "FR",
          ranking: {
            rankingValue: 1400,
            rankedAt: new Date("2026-02-01"),
          },
        },
      ],
    });

    expect(db.touchedDelegates.length).toBeGreaterThan(0);
    expect(
      db.touchedDelegates.every((delegate) =>
        PGR_TABLE_BY_DELEGATE[delegate]?.startsWith("pgr_")
      )
    ).toBe(true);
  });
});

class FakePgrDb {
  readonly sourceImports: any[] = [];
  readonly clubs: any[] = [];
  readonly players: any[] = [];
  readonly playerExternalIds: any[] = [];
  readonly externalRankings: any[] = [];
  readonly pgrSnapshots: any[] = [];
  readonly touchedDelegates: string[] = [];
  private nextIds: Record<string, number> = {};
  readonly prisma: PrismaClient;

  constructor() {
    this.prisma = {
      sourceImport: {
        create: async (args: any) => {
          this.touch("sourceImport");
          const row = {
            id: this.nextId("import"),
            record_count: null,
            error_message: null,
            created_at: new Date(),
            ...args.data,
          };
          this.sourceImports.push(row);
          return row;
        },
        update: async (args: any) => {
          this.touch("sourceImport");
          const row = this.requiredRow(this.sourceImports, args.where.id);
          Object.assign(row, args.data);
          return row;
        },
        findUnique: async (args: any) => {
          this.touch("sourceImport");
          return this.sourceImports.find((row) => row.id === args.where.id) ?? null;
        },
        findMany: async () => {
          this.touch("sourceImport");
          return [...this.sourceImports].sort(
            (a, b) => b.imported_at.getTime() - a.imported_at.getTime()
          );
        },
      },
      club: {
        findFirst: async (args: any) => {
          this.touch("club");
          return this.clubs.find((row) => this.matchesWhere(row, args.where)) ?? null;
        },
        create: async (args: any) => {
          this.touch("club");
          const row = {
            id: this.nextId("club"),
            created_at: new Date(),
            updated_at: new Date(),
            ...args.data,
          };
          this.clubs.push(row);
          return row;
        },
        update: async (args: any) => {
          this.touch("club");
          const row = this.requiredRow(this.clubs, args.where.id);
          Object.assign(row, args.data, { updated_at: new Date() });
          return row;
        },
      },
      player: {
        create: async (args: any) => {
          this.touch("player");
          const row = {
            id: this.nextId("player"),
            user_id: null,
            created_at: new Date(),
            updated_at: new Date(),
            ...args.data,
          };
          this.players.push(row);
          return row;
        },
        update: async (args: any) => {
          this.touch("player");
          const row = this.requiredRow(this.players, args.where.id);
          Object.assign(row, args.data, { updated_at: new Date() });
          return row;
        },
        findMany: async (args: any) => {
          this.touch("player");
          const rows = this.players.filter((row) => this.matchesWhere(row, args.where));
          return typeof args.take === "number" ? rows.slice(0, args.take) : rows;
        },
        findUnique: async (args: any) => {
          this.touch("player");
          return this.players.find((row) => row.id === args.where.id) ?? null;
        },
      },
      playerExternalId: {
        findUnique: async (args: any) => {
          this.touch("playerExternalId");
          const key = args.where.source_external_id;
          const row =
            this.playerExternalIds.find(
              (item) =>
                item.source === key.source && item.external_id === key.external_id
            ) ?? null;
          return this.withIncludedPlayer(row, args.include);
        },
        upsert: async (args: any) => {
          this.touch("playerExternalId");
          const key = args.where.source_external_id;
          const existing = this.playerExternalIds.find(
            (row) => row.source === key.source && row.external_id === key.external_id
          );
          if (existing) {
            Object.assign(existing, args.update);
            return existing;
          }
          const row = {
            id: this.nextId("external_id"),
            created_at: new Date(),
            ...args.create,
          };
          this.playerExternalIds.push(row);
          return row;
        },
      },
      externalRanking: {
        findFirst: async (args: any) => {
          this.touch("externalRanking");
          return (
            this.externalRankings.find((row) => this.matchesWhere(row, args.where)) ??
            null
          );
        },
        create: async (args: any) => {
          this.touch("externalRanking");
          const row = {
            id: this.nextId("ranking"),
            created_at: new Date(),
            ...args.data,
          };
          this.externalRankings.push(row);
          return row;
        },
        update: async (args: any) => {
          this.touch("externalRanking");
          const row = this.requiredRow(this.externalRankings, args.where.id);
          Object.assign(row, args.data);
          return row;
        },
        findMany: async (args: any) => {
          this.touch("externalRanking");
          return this.externalRankings.filter((row) =>
            this.matchesWhere(row, args.where)
          );
        },
      },
      pgrSnapshot: {
        findFirst: async (args: any) => {
          this.touch("pgrSnapshot");
          const rows = this.pgrSnapshots.filter((row) =>
            this.matchesWhere(row, args.where)
          );
          if (args.orderBy?.snapshot_date === "desc") {
            rows.sort(
              (a, b) => b.snapshot_date.getTime() - a.snapshot_date.getTime()
            );
          }
          return rows[0] ?? null;
        },
        create: async (args: any) => {
          this.touch("pgrSnapshot");
          const row = {
            id: this.nextId("snapshot"),
            created_at: new Date(),
            ...args.data,
          };
          this.pgrSnapshots.push(row);
          return row;
        },
      },
    } as unknown as PrismaClient;
  }

  private touch(delegate: string) {
    this.touchedDelegates.push(delegate);
  }

  private nextId(prefix: string): string {
    this.nextIds[prefix] = (this.nextIds[prefix] ?? 0) + 1;
    return `${prefix}_${this.nextIds[prefix]}`;
  }

  private requiredRow(rows: any[], id: string): any {
    const row = rows.find((item) => item.id === id);
    if (!row) throw new Error(`Missing fake row: ${id}`);
    return row;
  }

  private withIncludedPlayer(row: any | null, include: any): any | null {
    if (!row || !include?.player) return row;
    return {
      ...row,
      player: this.players.find((player) => player.id === row.player_id) ?? null,
    };
  }

  private matchesWhere(row: any, where: any): boolean {
    if (!where) return true;

    return Object.entries(where).every(([field, expected]) => {
      if (expected === undefined) return true;
      const actual = row[field];

      if (expected instanceof Date) {
        return actual instanceof Date && actual.getTime() === expected.getTime();
      }

      if (expected && typeof expected === "object" && "equals" in expected) {
        const expectedValue = (expected as any).equals;
        if ((expected as any).mode === "insensitive") {
          return String(actual).toLowerCase() === String(expectedValue).toLowerCase();
        }
        return actual === expectedValue;
      }

      if (expected === null) {
        return actual === null || actual === undefined;
      }

      return actual === expected;
    });
  }
}
