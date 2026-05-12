import { describe, expect, it } from "vitest";
import type { PrismaClient, Player, PgrSnapshot } from "@prisma/client";
import { SnapshotsService, SnapshotWithPlayer } from "../src/snapshots.service.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

let idCounter = 0;

function makePlayer(overrides: Partial<Player> = {}): Player {
  idCounter++;
  return {
    id: `player-${idCounter}`,
    user_id: null,
    first_name: "Test",
    last_name: "Player",
    display_name: `Player ${idCounter}`,
    country_code: "FR",
    birth_year: null,
    gender: "M",
    category: "SENIOR",
    club_id: null,
    created_at: new Date("2026-05-12"),
    updated_at: new Date("2026-05-12"),
    ...overrides,
  };
}

function makeSnapshot(
  player: Player,
  rating: number,
  overrides: Partial<PgrSnapshot> = {}
): SnapshotWithPlayer {
  return {
    id: `snap-${player.id}`,
    player_id: player.id,
    rating,
    rating_deviation: 100,
    volatility: 0.06,
    match_count: 0,
    confidence_status: "PROVISIONAL",
    is_provisional: true,
    initialization_source: "ITTF",
    algorithm_version: "2",
    snapshot_date: new Date("2026-05-12T00:00:00Z"),
    trigger: "INITIALIZATION",
    created_at: new Date("2026-05-12"),
    player,
    ...overrides,
  } as SnapshotWithPlayer;
}

// ── Fake DB ───────────────────────────────────────────────────────────────────

class FakeSnapshotsDb {
  private store: SnapshotWithPlayer[] = [];

  add(snapshot: SnapshotWithPlayer) {
    this.store.push(snapshot);
    return this;
  }

  readonly prisma = {
    pgrSnapshot: {
      findMany: async (args: any): Promise<SnapshotWithPlayer[]> => {
        let rows = [...this.store];

        // Filter by snapshot-level field
        const initSource = args.where?.initialization_source;
        if (initSource !== undefined) {
          rows = rows.filter((r) => r.initialization_source === initSource);
        }

        // Filter by nested player fields
        const pf = args.where?.player as Record<string, string> | undefined;
        if (pf) {
          rows = rows.filter((r) => {
            if (pf.country_code !== undefined && r.player.country_code !== pf.country_code) return false;
            if (pf.gender !== undefined && r.player.gender !== pf.gender) return false;
            if (pf.category !== undefined && r.player.category !== pf.category) return false;
            return true;
          });
        }

        // Sort by snapshot_date desc (for deduplication logic in SnapshotsService)
        if (args.orderBy?.snapshot_date === "desc") {
          rows.sort((a, b) => b.snapshot_date.getTime() - a.snapshot_date.getTime());
        }

        return rows;
      },
    },
  } as unknown as PrismaClient;
}

// ── Test data ─────────────────────────────────────────────────────────────────
//
// 6 players across 3 countries, 2 genders, 2 init sources:
//   CN M ITTF  rating 2897
//   FR M ITTF  rating 2756
//   FR M ITTF  rating 2607
//   DE M ITTF  rating 2427
//   FR F FFTT  rating 1600
//   DE F TTR   rating 1580

function buildTestDb() {
  const wang = makePlayer({ id: "p-wang", country_code: "CN", gender: "M" });
  const felix = makePlayer({ id: "p-felix", country_code: "FR", gender: "M" });
  const alexis = makePlayer({ id: "p-alexis", country_code: "FR", gender: "M" });
  const duda = makePlayer({ id: "p-duda", country_code: "DE", gender: "M" });
  const marie = makePlayer({ id: "p-marie", country_code: "FR", gender: "F" });
  const hanna = makePlayer({ id: "p-hanna", country_code: "DE", gender: "F" });

  const db = new FakeSnapshotsDb();
  db.add(makeSnapshot(wang, 2897));
  db.add(makeSnapshot(felix, 2756));
  db.add(makeSnapshot(alexis, 2607));
  db.add(makeSnapshot(duda, 2427));
  db.add(makeSnapshot(marie, 1600, { initialization_source: "FFTT" }));
  db.add(makeSnapshot(hanna, 1580, { initialization_source: "TTR" }));

  return db;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SnapshotsService.getLeaderboard", () => {
  it("top global — returns all players sorted by rating desc", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard();

    expect(result).toHaveLength(6);
    expect(result[0].player.id).toBe("p-wang");
    expect(result[0].rating).toBe(2897);
    expect(result[5].player.id).toBe("p-hanna");
    expect(result[5].rating).toBe(1580);
  });

  it("top France — returns only FR players sorted by rating desc", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ countryCode: "FR" });

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.player.country_code === "FR")).toBe(true);
    expect(result[0].rating).toBe(2756);
    expect(result[2].rating).toBe(1600);
  });

  it("top Allemagne — returns only DE players sorted by rating desc", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ countryCode: "DE" });

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.player.country_code === "DE")).toBe(true);
    expect(result[0].rating).toBe(2427);
    expect(result[1].rating).toBe(1580);
  });

  it("top hommes — returns only M players sorted by rating desc", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ gender: "M" });

    expect(result).toHaveLength(4);
    expect(result.every((r) => r.player.gender === "M")).toBe(true);
    expect(result[0].rating).toBe(2897);
    expect(result[3].rating).toBe(2427);
  });

  it("top femmes — returns only F players sorted by rating desc", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ gender: "F" });

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.player.gender === "F")).toBe(true);
    expect(result[0].rating).toBe(1600);
    expect(result[1].rating).toBe(1580);
  });

  it("limit 2 — returns only the top 2 players", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].rating).toBe(2897);
    expect(result[1].rating).toBe(2756);
  });

  it("initializationSource ITTF — returns only ITTF-initialized players", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ initializationSource: "ITTF" });

    expect(result).toHaveLength(4);
    expect(result.every((r) => r.initialization_source === "ITTF")).toBe(true);
    expect(result[0].rating).toBe(2897);
  });

  it("combined filter — top FR femmes", async () => {
    const service = new SnapshotsService(buildTestDb().prisma);
    const result = await service.getLeaderboard({ countryCode: "FR", gender: "F" });

    expect(result).toHaveLength(1);
    expect(result[0].player.id).toBe("p-marie");
    expect(result[0].rating).toBe(1600);
  });

  it("deduplicates — only the latest snapshot per player is kept", async () => {
    const p = makePlayer({ id: "p-dup", country_code: "JP", gender: "M" });
    const db = new FakeSnapshotsDb();
    // Two snapshots for the same player — latest should win
    db.add(makeSnapshot(p, 1800, { snapshot_date: new Date("2026-01-01") }));
    db.add(makeSnapshot(p, 2000, { snapshot_date: new Date("2026-05-12") }));

    const service = new SnapshotsService(db.prisma);
    const result = await service.getLeaderboard();

    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(2000);
  });
});
