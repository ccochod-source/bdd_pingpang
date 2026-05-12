import {
  Club,
  ExternalRanking,
  Player,
  PlayerExternalId,
  PgrConfidenceLevel,
  PrismaClient,
  Prisma,
  PgrSnapshot,
  SourceImport,
  PgrDataSource,
} from "@prisma/client";
import {
  initFromBestAvailableSource,
  initFromQuestionnaire,
  PGR_CONFIG,
  type DataSource,
  type ExternalRankingInput,
} from "@ping-pang/pgr-core";

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
        imported_at: data.importedAt ?? new Date(),
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

  /**
   * Import already-normalized player records from any external source.
   *
   * This layer deliberately does not scrape anything. It only accepts data that
   * a future source adapter has already normalized.
   */
  async importNormalizedPlayers(
    data: ImportNormalizedPlayersData
  ): Promise<ImportNormalizedPlayersResult> {
    const sourceImport = await this.startImport(data);

    try {
      const results: ImportedNormalizedPlayerResult[] = [];

      for (const normalizedPlayer of data.players) {
        results.push(
          await this.importNormalizedPlayer(
            data.source,
            normalizedPlayer,
            sourceImport
          )
        );
      }

      const completedImport = await this.completeImport(
        sourceImport.id,
        data.players.length
      );

      return {
        import: completedImport,
        players: results,
        createdPlayers: results.filter((r) => r.createdPlayer).length,
        existingPlayers: results.filter((r) => !r.createdPlayer).length,
        createdRankings: results.reduce((sum, r) => sum + r.createdRankings, 0),
        createdSnapshots: results.filter((r) => r.createdSnapshot).length,
      };
    } catch (error) {
      await this.failImport(
        sourceImport.id,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async importNormalizedPlayer(
    importSource: PgrDataSource,
    normalizedPlayer: NormalizedExternalPlayer,
    sourceImport: SourceImport
  ): Promise<ImportedNormalizedPlayerResult> {
    const source = normalizedPlayer.source ?? importSource;
    const firstName = requireText(normalizedPlayer.firstName, "firstName");
    const lastName = requireText(normalizedPlayer.lastName, "lastName");
    const countryCode = normalizeCountryCode(normalizedPlayer.countryCode);
    const displayName =
      normalizeOptionalText(normalizedPlayer.displayName) ??
      `${firstName} ${lastName}`;
    const externalId = normalizeOptionalText(normalizedPlayer.externalId);

    const club = await this.findOrCreateClub(source, normalizedPlayer.club);
    const { player, createdPlayer } = await this.findOrCreatePlayer({
      source,
      externalId,
      firstName,
      lastName,
      displayName,
      countryCode,
      birthYear: normalizedPlayer.birthYear ?? undefined,
      gender: normalizeOptionalText(normalizedPlayer.gender),
      category: normalizeOptionalText(normalizedPlayer.category),
      clubId: club?.id,
    });

    const externalIdRow = externalId
      ? await this.addPlayerExternalId(player.id, {
          source,
          externalId,
          externalUrl: normalizeOptionalText(normalizedPlayer.externalUrl),
        })
      : null;

    const normalizedRankings = this.collectRankings(
      source,
      normalizedPlayer,
      sourceImport.imported_at
    );
    const rankings: ExternalRanking[] = [];
    let createdRankings = 0;

    for (const ranking of normalizedRankings) {
      const result = await this.addExternalRankingIfMissing(
        player.id,
        ranking,
        sourceImport.id
      );
      rankings.push(result.ranking);
      if (result.created) createdRankings++;
    }

    const snapshot = await this.initializeSnapshotIfMissing(
      player.id,
      normalizedRankings
    );

    return {
      player,
      createdPlayer,
      club,
      externalId: externalIdRow,
      rankings,
      createdRankings,
      snapshot,
      createdSnapshot: snapshot !== null,
    };
  }

  private async findOrCreateClub(
    source: PgrDataSource,
    club?: NormalizedExternalClub | null
  ): Promise<Club | null> {
    if (!club) return null;

    const name = requireText(club.name, "club.name");
    const countryCode = normalizeCountryCode(club.countryCode);
    const city = normalizeOptionalText(club.city);
    const clubSource = club.source ?? source;
    const externalId = normalizeOptionalText(club.externalId);

    if (externalId) {
      const existingByExternalId = await this.prisma.club.findFirst({
        where: {
          source: clubSource,
          external_id: externalId,
        },
      });

      if (existingByExternalId) {
        return this.prisma.club.update({
          where: { id: existingByExternalId.id },
          data: {
            name,
            country_code: countryCode,
            city,
            source: clubSource,
            external_id: externalId,
          },
        });
      }
    }

    const fallbackWhere: Prisma.ClubWhereInput = {
      name: { equals: name, mode: "insensitive" },
    };
    if (countryCode) fallbackWhere.country_code = countryCode;
    if (city) fallbackWhere.city = { equals: city, mode: "insensitive" };

    const existingByName = await this.prisma.club.findFirst({
      where: fallbackWhere,
    });
    if (existingByName) return existingByName;

    return this.prisma.club.create({
      data: {
        name,
        country_code: countryCode,
        city,
        source: clubSource,
        external_id: externalId,
      },
    });
  }

  private async findOrCreatePlayer(data: {
    source: PgrDataSource;
    externalId?: string;
    firstName: string;
    lastName: string;
    displayName: string;
    countryCode?: string;
    birthYear?: number;
    gender?: string;
    category?: string;
    clubId?: string;
  }): Promise<{ player: Player; createdPlayer: boolean }> {
    const existingByExternalId = data.externalId
      ? await this.findPlayerByExternalId(data.source, data.externalId)
      : null;

    const fallbackPlayer =
      existingByExternalId ??
      (!data.externalId
        ? await this.findSinglePlayerByIdentity({
            firstName: data.firstName,
            lastName: data.lastName,
            countryCode: data.countryCode,
            birthYear: data.birthYear,
            gender: data.gender,
          })
        : null);

    if (fallbackPlayer) {
      const updateData: Prisma.PlayerUncheckedUpdateInput = {
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: data.displayName,
      };
      if (data.countryCode) updateData.country_code = data.countryCode;
      if (data.birthYear) updateData.birth_year = data.birthYear;
      if (data.gender) updateData.gender = data.gender;
      if (data.category) updateData.category = data.category;
      if (data.clubId) updateData.club_id = data.clubId;

      const player = await this.prisma.player.update({
        where: { id: fallbackPlayer.id },
        data: updateData,
      });
      return { player, createdPlayer: false };
    }

    const player = await this.prisma.player.create({
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        display_name: data.displayName,
        country_code: data.countryCode,
        birth_year: data.birthYear,
        gender: data.gender,
        category: data.category,
        club_id: data.clubId,
      },
    });

    return { player, createdPlayer: true };
  }

  private async findPlayerByExternalId(
    source: PgrDataSource,
    externalId: string
  ): Promise<Player | null> {
    const row = await this.prisma.playerExternalId.findUnique({
      where: {
        source_external_id: {
          source,
          external_id: externalId,
        },
      },
      include: { player: true },
    });
    return row?.player ?? null;
  }

  private async findSinglePlayerByIdentity(data: {
    firstName: string;
    lastName: string;
    countryCode?: string;
    birthYear?: number;
    gender?: string;
  }): Promise<Player | null> {
    if (!data.countryCode) return null;

    const where: Prisma.PlayerWhereInput = {
      first_name: { equals: data.firstName, mode: "insensitive" },
      last_name: { equals: data.lastName, mode: "insensitive" },
      country_code: data.countryCode,
    };
    if (data.birthYear) where.birth_year = data.birthYear;
    if (data.gender) where.gender = data.gender;

    const candidates = await this.prisma.player.findMany({
      where,
      take: 2,
    });

    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous player fallback for ${data.firstName} ${data.lastName} (${data.countryCode})`
      );
    }

    return candidates[0] ?? null;
  }

  private async addPlayerExternalId(
    playerId: string,
    data: {
      source: PgrDataSource;
      externalId: string;
      externalUrl?: string;
    }
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

  private collectRankings(
    defaultSource: PgrDataSource,
    player: NormalizedExternalPlayer,
    importedAt: Date
  ): NormalizedRankingForImport[] {
    const rawRankings = [
      ...(player.ranking ? [player.ranking] : []),
      ...(player.rankings ?? []),
    ];

    return rawRankings.map((ranking) => ({
      source: ranking.source ?? defaultSource,
      rankingValue: ranking.rankingValue ?? null,
      rank: ranking.rank ?? null,
      totalPlayers: ranking.totalPlayers ?? null,
      rankedAt: toDateOnly(ranking.rankedAt ?? importedAt),
      confidenceLevel: ranking.confidenceLevel ?? "MEDIUM",
    }));
  }

  private async addExternalRankingIfMissing(
    playerId: string,
    data: NormalizedRankingForImport,
    importId: string
  ): Promise<{ ranking: ExternalRanking; created: boolean }> {
    const existing = await this.prisma.externalRanking.findFirst({
      where: {
        player_id: playerId,
        source: data.source,
        ranking_value: data.rankingValue,
        rank: data.rank,
        ranked_at: data.rankedAt,
      },
    });

    if (existing) {
      const ranking = await this.prisma.externalRanking.update({
        where: { id: existing.id },
        data: {
          confidence_level: data.confidenceLevel,
          import_id: importId,
        },
      });
      return { ranking, created: false };
    }

    const ranking = await this.prisma.externalRanking.create({
      data: {
        player_id: playerId,
        source: data.source,
        ranking_value: data.rankingValue,
        rank: data.rank,
        ranked_at: data.rankedAt,
        confidence_level: data.confidenceLevel,
        import_id: importId,
      },
    });

    return { ranking, created: true };
  }

  private async initializeSnapshotIfMissing(
    playerId: string,
    rankings: NormalizedRankingForImport[]
  ): Promise<PgrSnapshot | null> {
    const existingSnapshot = await this.prisma.pgrSnapshot.findFirst({
      where: { player_id: playerId },
      orderBy: { snapshot_date: "desc" },
    });
    if (existingSnapshot) return null;

    const externalRankingInputs: ExternalRankingInput[] = rankings.map((r) => ({
      source: r.source as DataSource,
      rankingValue: r.rankingValue,
      rank: r.rank,
      totalPlayers: r.totalPlayers,
    }));

    const initial =
      initFromBestAvailableSource(externalRankingInputs) ??
      initFromQuestionnaire("CLUB_BEGINNER");

    return this.prisma.pgrSnapshot.create({
      data: {
        player_id: playerId,
        rating: initial.rating,
        rating_deviation: initial.ratingDeviation,
        volatility: initial.volatility,
        match_count: 0,
        confidence_status: "PROVISIONAL",
        is_provisional: true,
        initialization_source: initial.initializationSource as PgrDataSource,
        algorithm_version: PGR_CONFIG.ALGORITHM_VERSION,
        snapshot_date: new Date(),
        trigger: "INITIALIZATION",
      },
    });
  }
}

interface NormalizedRankingForImport {
  source: PgrDataSource;
  rankingValue: number | null;
  rank: number | null;
  totalPlayers: number | null;
  rankedAt: Date;
  confidenceLevel: PgrConfidenceLevel;
}

function requireText(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(`Missing required normalized player field: ${fieldName}`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCountryCode(value: string | null | undefined): string | undefined {
  return normalizeOptionalText(value)?.toUpperCase();
}

function toDateOnly(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
