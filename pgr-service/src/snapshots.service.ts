import {
  PrismaClient,
  PgrSnapshot,
  PgrConfidenceStatus,
  PgrDataSource,
  PgrSnapshotTrigger,
  Prisma,
} from "@prisma/client";
import type { RatingUpdate } from "@ping-pang/pgr-core";

export type SnapshotWithPlayer = Prisma.PgrSnapshotGetPayload<{
  include: { player: true };
}>;

export interface LeaderboardOptions {
  limit?: number;
  countryCode?: string;
  gender?: string;
  category?: string;
  initializationSource?: PgrDataSource;
}

export interface CreateSnapshotData {
  playerId: string;
  ratingUpdate: RatingUpdate;
  initializationSource?: PgrDataSource;
  algorithmVersion: string;
  snapshotDate: Date;
  trigger: PgrSnapshotTrigger;
}

export class SnapshotsService {
  constructor(private readonly prisma: PrismaClient) {}

  async createSnapshot(data: CreateSnapshotData): Promise<PgrSnapshot> {
    return this.prisma.pgrSnapshot.create({
      data: {
        player_id: data.playerId,
        rating: data.ratingUpdate.rating,
        rating_deviation: data.ratingUpdate.ratingDeviation,
        volatility: data.ratingUpdate.volatility,
        match_count: data.ratingUpdate.matchCount,
        confidence_status: data.ratingUpdate
          .confidenceStatus as PgrConfidenceStatus,
        is_provisional: data.ratingUpdate.isProvisional,
        initialization_source: data.initializationSource,
        algorithm_version: data.algorithmVersion,
        snapshot_date: data.snapshotDate,
        trigger: data.trigger,
      },
    });
  }

  async getLatestSnapshot(playerId: string): Promise<PgrSnapshot | null> {
    return this.prisma.pgrSnapshot.findFirst({
      where: { player_id: playerId },
      orderBy: { snapshot_date: "desc" },
    });
  }

  /**
   * Get the PGR history for a player, most recent first.
   */
  async getPlayerHistory(
    playerId: string,
    limit = 50
  ): Promise<PgrSnapshot[]> {
    return this.prisma.pgrSnapshot.findMany({
      where: { player_id: playerId },
      orderBy: { snapshot_date: "desc" },
      take: limit,
    });
  }

  /**
   * Get the latest snapshot for every player in a list.
   * Returns a Map<playerId, PgrSnapshot>.
   */
  async getLatestSnapshotsForPlayers(
    playerIds: string[]
  ): Promise<Map<string, PgrSnapshot>> {
    // Fetch all and keep the latest per player
    const rows = await this.prisma.pgrSnapshot.findMany({
      where: { player_id: { in: playerIds } },
      orderBy: { snapshot_date: "desc" },
    });

    const map = new Map<string, PgrSnapshot>();
    for (const row of rows) {
      if (!map.has(row.player_id)) {
        map.set(row.player_id, row);
      }
    }
    return map;
  }

  /**
   * Leaderboard: top N players by rating, with optional filters.
   * Returns snapshots with player info included.
   */
  async getLeaderboard(options: LeaderboardOptions = {}): Promise<SnapshotWithPlayer[]> {
    const { limit = 100, countryCode, gender, category, initializationSource } = options;

    const playerFilter = {
      ...(countryCode !== undefined && { country_code: countryCode }),
      ...(gender !== undefined && { gender }),
      ...(category !== undefined && { category }),
    };

    const rows = await this.prisma.pgrSnapshot.findMany({
      where: {
        ...(Object.keys(playerFilter).length > 0 && { player: playerFilter }),
        ...(initializationSource !== undefined && { initialization_source: initializationSource }),
      },
      include: { player: true },
      orderBy: { snapshot_date: "desc" },
    });

    // Deduplicate: keep only the latest snapshot per player
    const seen = new Set<string>();
    const latest: SnapshotWithPlayer[] = [];
    for (const row of rows) {
      if (!seen.has(row.player_id)) {
        seen.add(row.player_id);
        latest.push(row);
      }
    }

    return latest
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }
}
