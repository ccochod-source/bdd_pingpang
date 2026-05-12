import { describe, expect, it } from "vitest";
import {
  NORMALIZED_PLAYER_CSV_COLUMNS,
  parseNormalizedPlayersCsv,
} from "../src/csv-import.parser.js";

const header = NORMALIZED_PLAYER_CSV_COLUMNS.join(",");

describe("parseNormalizedPlayersCsv", () => {
  it("parses normalized WTT/FFTT/TTR rows", () => {
    const players = parseNormalizedPlayersCsv(
      [
        header,
        "WTT,WTT-1,,Ma,Long,Ma Long,CN,M,SENIOR,,,8500,1,2026-05-01,HIGH,1000",
        "FFTT,FFTT-1,,Camille,Roux,Camille Roux,FR,F,SENIOR,Paris XV Tennis de Table,FR,1850,,2026-04-01,MEDIUM,",
        "TTR,TTR-1,,Anna,Schmidt,Anna Schmidt,DE,F,SENIOR,Berlin TTC,DE,1830,,2026-04-15,HIGH,",
      ].join("\n")
    );

    expect(players).toHaveLength(3);
    expect(players[0]).toMatchObject({
      source: "WTT",
      externalId: "WTT-1",
      firstName: "Ma",
      lastName: "Long",
      countryCode: "CN",
      ranking: {
        source: "WTT",
        rankingValue: 8500,
        rank: 1,
        totalPlayers: 1000,
        confidenceLevel: "HIGH",
      },
    });
    expect(players[0].ranking?.rankedAt?.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(players[1].club).toMatchObject({
      name: "Paris XV Tennis de Table",
      countryCode: "FR",
      source: "FFTT",
    });
    expect(players[2].ranking?.rankingValue).toBe(1830);
  });

  it("supports quoted fields, commas and escaped quotes", () => {
    const players = parseNormalizedPlayersCsv(
      [
        header,
        'WTT,WTT-2,,"Li, Wei",Chen,"Li ""The Wall"" Chen",CN,M,SENIOR,,,7200,8,2026-05-01,HIGH,1000',
      ].join("\n")
    );

    expect(players[0].firstName).toBe("Li, Wei");
    expect(players[0].displayName).toBe('Li "The Wall" Chen');
  });

  it("allows rows without ranking data", () => {
    const players = parseNormalizedPlayersCsv(
      [
        header,
        "RANKEDIN,RANKEDIN-1,,No,Ranking,No Ranking,GB,F,SENIOR,,,,,,,",
      ].join("\n")
    );

    expect(players).toHaveLength(1);
    expect(players[0].ranking).toBeUndefined();
  });

  it("rejects missing expected columns", () => {
    expect(() =>
      parseNormalizedPlayersCsv(
        [
          NORMALIZED_PLAYER_CSV_COLUMNS.filter(
            (column) => column !== "ranked_at"
          ).join(","),
          "WTT,WTT-1,,A,B,A B,CN,M,SENIOR,,,1000,1,HIGH,1000",
        ].join("\n")
      )
    ).toThrow("Missing CSV column(s): ranked_at");
  });

  it("rejects invalid numeric fields with the CSV line number", () => {
    expect(() =>
      parseNormalizedPlayersCsv(
        [
          header,
          "WTT,WTT-1,,A,B,A B,CN,M,SENIOR,,,not-a-number,1,2026-05-01,HIGH,1000",
        ].join("\n")
      )
    ).toThrow('Line 2: invalid ranking_value "not-a-number"');
  });

  it("rejects ranking metadata without a rank or ranking_value signal", () => {
    expect(() =>
      parseNormalizedPlayersCsv(
        [
          header,
          "WTT,WTT-1,,A,B,A B,CN,M,SENIOR,,,,,2026-05-01,HIGH,",
        ].join("\n")
      )
    ).toThrow("Line 2: ranking metadata requires rank or ranking_value");
  });
});
