import {
  PrismaClient,
  Player,
  PlayerExternalId,
  PgrDataSource,
  PgrConfidenceLevel,
  Prisma,
} from "@prisma/client";

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

export class PlayersService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePlayerData): Promise<Player> {
    return this.prisma.player.create({
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: data.displayName ?? `${data.firstName} ${data.lastName}`,
        country_code: data.countryCode,
        birth_year: data.birthYear,
        gender: data.gender,
        category: data.category,
        club_id: data.clubId,
      },
    });
  }

  async findById(
    id: string,
    include?: Prisma.PlayerInclude
  ): Promise<Player | null> {
    return this.prisma.player.findUnique({ where: { id }, include });
  }

  async findByExternalId(
    source: PgrDataSource,
    externalId: string
  ): Promise<Player | null> {
    const ext = await this.prisma.playerExternalId.findUnique({
      where: { source_external_id: { source, external_id: externalId } },
      include: { player: true },
    });
    return ext?.player ?? null;
  }

  async addExternalId(
    playerId: string,
    data: AddExternalIdData
  ): Promise<PlayerExternalId> {
    return this.prisma.playerExternalId.upsert({
      where: {
        source_external_id: {
          source: data.source,
          external_id: data.externalId,
        },
      },
      create: {
        player_id: playerId,
        source: data.source,
        external_id: data.externalId,
        external_url: data.externalUrl,
      },
      update: {
        external_url: data.externalUrl,
      },
    });
  }

  /**
   * Create or update a player by their external ID.
   * Useful for idempotent imports (re-running an import won't duplicate players).
   */
  async upsertByExternalId(
    source: PgrDataSource,
    externalId: string,
    data: CreatePlayerData
  ): Promise<Player> {
    const existing = await this.findByExternalId(source, externalId);

    if (existing) {
      return this.prisma.player.update({
        where: { id: existing.id },
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          display_name: data.displayName ?? `${data.firstName} ${data.lastName}`,
          country_code: data.countryCode,
          birth_year: data.birthYear,
          gender: data.gender,
          category: data.category,
        },
      });
    }

    const player = await this.create(data);
    await this.addExternalId(player.id, { source, externalId });
    return player;
  }

  async listByCountry(countryCode: string): Promise<Player[]> {
    return this.prisma.player.findMany({ where: { country_code: countryCode } });
  }

  /**
   * Add an external ranking entry for a player.
   * Used before initializePlayer() to seed source data.
   */
  async addExternalRanking(playerId: string, data: AddExternalRankingData) {
    return this.prisma.externalRanking.create({
      data: {
        player_id: playerId,
        source: data.source,
        ranking_value: data.rankingValue,
        rank: data.rank,
        ranked_at: data.rankedAt,
        confidence_level: data.confidenceLevel,
        import_id: data.importId,
      },
    });
  }

  /**
   * Get a player's external rankings, ordered by most recent first.
   * Useful to determine which source should initialize their PGR.
   */
  async getExternalRankings(playerId: string) {
    return this.prisma.externalRanking.findMany({
      where: { player_id: playerId },
      orderBy: { ranked_at: "desc" },
    });
  }
}
