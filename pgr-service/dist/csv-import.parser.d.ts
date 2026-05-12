import type { NormalizedExternalPlayer } from "./imports.service.js";
export declare const NORMALIZED_PLAYER_CSV_COLUMNS: readonly ["source", "external_id", "external_url", "first_name", "last_name", "display_name", "country_code", "gender", "category", "club_name", "club_country_code", "ranking_value", "rank", "ranked_at", "confidence_level", "total_players"];
/**
 * Parse a normalized players CSV into import-ready player objects.
 *
 * This parser is intentionally small and local: it supports quoted fields,
 * escaped quotes and CRLF/LF line endings without adding a runtime dependency.
 */
export declare function parseNormalizedPlayersCsv(csv: string): NormalizedExternalPlayer[];
//# sourceMappingURL=csv-import.parser.d.ts.map