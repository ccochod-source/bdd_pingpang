import type { PgrConfidenceLevel, PgrDataSource } from "@prisma/client";
import type { NormalizedExternalPlayer } from "./imports.service.js";

export const NORMALIZED_PLAYER_CSV_COLUMNS = [
  "source",
  "external_id",
  "external_url",
  "first_name",
  "last_name",
  "display_name",
  "country_code",
  "gender",
  "category",
  "club_name",
  "club_country_code",
  "ranking_value",
  "rank",
  "ranked_at",
  "confidence_level",
  "total_players",
] as const;

const PGR_DATA_SOURCES = [
  "FFTT",
  "WTT",
  "ITTF",
  "TTR",
  "RANKEDIN",
  "RFETM",
  "FITET",
  "CTTA",
  "JTTA",
  "KTTF",
  "PING_PANG",
  "QUESTIONNAIRE",
  "MANUAL",
] as const satisfies readonly PgrDataSource[];

const PGR_CONFIDENCE_LEVELS = [
  "HIGH",
  "MEDIUM",
  "LOW",
] as const satisfies readonly PgrConfidenceLevel[];

type NormalizedPlayerCsvColumn =
  (typeof NORMALIZED_PLAYER_CSV_COLUMNS)[number];

interface CsvRecord {
  values: string[];
  line: number;
}

/**
 * Parse a normalized players CSV into import-ready player objects.
 *
 * This parser is intentionally small and local: it supports quoted fields,
 * escaped quotes and CRLF/LF line endings without adding a runtime dependency.
 */
export function parseNormalizedPlayersCsv(
  csv: string
): NormalizedExternalPlayer[] {
  const records = parseCsvRecords(csv).filter(
    (record) => !record.values.every((value) => value.trim() === "")
  );

  if (records.length === 0) {
    throw new Error("CSV is empty");
  }

  const headers = records[0].values.map((value) => value.trim());
  validateHeaders(headers);

  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => headerIndex.set(header, index));

  return records.slice(1).map((record) =>
    parsePlayerRecord(record, headerIndex)
  );
}

function parsePlayerRecord(
  record: CsvRecord,
  headerIndex: Map<string, number>
): NormalizedExternalPlayer {
  const get = (column: NormalizedPlayerCsvColumn): string =>
    record.values[headerIndex.get(column) ?? -1]?.trim() ?? "";
  const optional = (column: NormalizedPlayerCsvColumn): string | undefined =>
    emptyToUndefined(get(column));

  const source = parseSource(get("source"), record.line);
  const firstName = requireValue(get("first_name"), "first_name", record.line);
  const lastName = requireValue(get("last_name"), "last_name", record.line);
  const countryCode = parseCountryCode(optional("country_code"), record.line);
  const clubCountryCode = parseCountryCode(
    optional("club_country_code"),
    record.line
  );

  const rankingValue = parseOptionalNumber(
    optional("ranking_value"),
    "ranking_value",
    record.line
  );
  const rank = parseOptionalInteger(optional("rank"), "rank", record.line);
  const totalPlayers = parseOptionalInteger(
    optional("total_players"),
    "total_players",
    record.line
  );
  const rankedAt = parseOptionalDate(optional("ranked_at"), record.line);
  const confidenceLevel = parseOptionalConfidenceLevel(
    optional("confidence_level"),
    record.line
  );

  const hasRankingSignal = rankingValue !== undefined || rank !== undefined;
  const hasRankingMetadata =
    rankedAt !== undefined ||
    confidenceLevel !== undefined ||
    totalPlayers !== undefined;

  if (!hasRankingSignal && hasRankingMetadata) {
    throw new Error(
      `Line ${record.line}: ranking metadata requires rank or ranking_value`
    );
  }

  return {
    source,
    externalId: optional("external_id"),
    externalUrl: optional("external_url"),
    firstName,
    lastName,
    displayName: optional("display_name"),
    countryCode,
    gender: optional("gender"),
    category: optional("category"),
    club: optional("club_name")
      ? {
          name: optional("club_name")!,
          countryCode: clubCountryCode,
          source,
        }
      : undefined,
    ranking: hasRankingSignal
      ? {
          source,
          rankingValue,
          rank,
          totalPlayers,
          rankedAt,
          confidenceLevel,
        }
      : undefined,
  };
}

function parseCsvRecords(csv: string): CsvRecord[] {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: CsvRecord[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new Error(`Line ${line}: unexpected quote in unquoted field`);
      }
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      records.push({ values: row, line: recordLine });
      row = [];
      field = "";
      line++;
      recordLine = line;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error(`Line ${recordLine}: unterminated quoted field`);
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push({ values: row, line: recordLine });
  }

  return records;
}

function validateHeaders(headers: string[]) {
  const seen = new Set<string>();
  const duplicates = headers.filter((header) => {
    if (!header) return false;
    if (seen.has(header)) return true;
    seen.add(header);
    return false;
  });
  if (duplicates.length > 0) {
    throw new Error(`Duplicate CSV column(s): ${duplicates.join(", ")}`);
  }

  const missing = NORMALIZED_PLAYER_CSV_COLUMNS.filter(
    (column) => !headers.includes(column)
  );
  if (missing.length > 0) {
    throw new Error(`Missing CSV column(s): ${missing.join(", ")}`);
  }
}

function parseSource(value: string, line: number): PgrDataSource {
  const source = value.trim().toUpperCase();
  if (!PGR_DATA_SOURCES.includes(source as PgrDataSource)) {
    throw new Error(`Line ${line}: invalid source "${value}"`);
  }
  return source as PgrDataSource;
}

function parseOptionalConfidenceLevel(
  value: string | undefined,
  line: number
): PgrConfidenceLevel | undefined {
  if (!value) return undefined;
  const confidenceLevel = value.toUpperCase();
  if (!PGR_CONFIDENCE_LEVELS.includes(confidenceLevel as PgrConfidenceLevel)) {
    throw new Error(`Line ${line}: invalid confidence_level "${value}"`);
  }
  return confidenceLevel as PgrConfidenceLevel;
}

function parseCountryCode(
  value: string | undefined,
  line: number
): string | undefined {
  if (!value) return undefined;
  const countryCode = value.toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error(`Line ${line}: country codes must use ISO alpha-2 format`);
  }
  return countryCode;
}

function parseOptionalNumber(
  value: string | undefined,
  column: string,
  line: number
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Line ${line}: invalid ${column} "${value}"`);
  }
  return parsed;
}

function parseOptionalInteger(
  value: string | undefined,
  column: string,
  line: number
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Line ${line}: invalid ${column} "${value}"`);
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, line: number): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Line ${line}: ranked_at must use YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Line ${line}: invalid ranked_at "${value}"`);
  }

  return date;
}

function requireValue(value: string, column: string, line: number): string {
  const normalized = emptyToUndefined(value);
  if (!normalized) {
    throw new Error(`Line ${line}: missing required ${column}`);
  }
  return normalized;
}

function emptyToUndefined(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}
