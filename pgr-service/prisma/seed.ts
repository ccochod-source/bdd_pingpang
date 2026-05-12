/**
 * PGR v1 — Seed data
 *
 * Fictional players only. Designed to cover all source types and confidence levels:
 *   - WTT/ITTF pros (high confidence)
 *   - FFTT licensed players (medium confidence)
 *   - TTR/German players (medium confidence)
 *   - Players from other federations (low/medium)
 *   - Questionnaire beginners (provisional)
 *
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client";
import {
  initFromWTT,
  initFromFFTT,
  initFromTTR,
  initFromQuestionnaire,
  initFromRank,
  PGR_CONFIG,
} from "../../pgr-core/src/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PGR v1...");

  // ── source_imports ─────────────────────────────────────────────────────
  const [importWTT, importFFTT, importTTR, importRankedin] = await Promise.all([
    prisma.sourceImport.create({
      data: {
        source: "WTT",
        imported_at: new Date("2024-03-01T00:00:00Z"),
        file_name: "wtt_rankings_2024_03.csv",
        status: "DONE",
        record_count: 4,
      },
    }),
    prisma.sourceImport.create({
      data: {
        source: "FFTT",
        imported_at: new Date("2024-03-01T00:00:00Z"),
        file_name: "fftt_classement_2024_03.csv",
        status: "DONE",
        record_count: 5,
      },
    }),
    prisma.sourceImport.create({
      data: {
        source: "TTR",
        imported_at: new Date("2024-03-01T00:00:00Z"),
        file_name: "clicktt_ttr_2024_03.csv",
        status: "DONE",
        record_count: 3,
      },
    }),
    prisma.sourceImport.create({
      data: {
        source: "RANKEDIN",
        imported_at: new Date("2024-03-01T00:00:00Z"),
        file_name: "rankedin_england_2024_03.csv",
        status: "DONE",
        record_count: 2,
      },
    }),
  ]);

  // ── clubs ──────────────────────────────────────────────────────────────
  const [clubParis, clubMunich, clubShanghai, clubLondon, clubBarcelona] =
    await Promise.all([
      prisma.club.create({
        data: {
          name: "Paris XV Tennis de Table",
          country_code: "FR",
          city: "Paris",
          source: "FFTT",
          external_id: "FFTT-CLB-75015",
        },
      }),
      prisma.club.create({
        data: {
          name: "TSV München Tischtennis",
          country_code: "DE",
          city: "Munich",
          source: "TTR",
          external_id: "TTR-CLB-MUC001",
        },
      }),
      prisma.club.create({
        data: {
          name: "Shanghai Bohua TTC",
          country_code: "CN",
          city: "Shanghai",
          source: "MANUAL",
        },
      }),
      prisma.club.create({
        data: {
          name: "London Ormesby TTC",
          country_code: "GB",
          city: "London",
          source: "RANKEDIN",
        },
      }),
      prisma.club.create({
        data: {
          name: "Club Natació Sabadell TT",
          country_code: "ES",
          city: "Sabadell",
          source: "RFETM",
        },
      }),
    ]);

  // ── competitions ───────────────────────────────────────────────────────
  const [compWTT, compFftt] = await Promise.all([
    prisma.competition.create({
      data: {
        name: "WTT Champions Frankfurt 2024",
        type: "WTT_MAJOR",
        country_code: "DE",
        start_date: new Date("2024-02-14"),
        end_date: new Date("2024-02-18"),
        source: "WTT",
      },
    }),
    prisma.competition.create({
      data: {
        name: "Championnat de France Pro A 2023-2024",
        type: "NATIONAL",
        country_code: "FR",
        start_date: new Date("2023-09-01"),
        end_date: new Date("2024-05-31"),
        source: "FFTT",
      },
    }),
  ]);

  // ── players ────────────────────────────────────────────────────────────
  // WTT/ITTF pros
  const [wei, sophie, markus, erika, julien, camille, pierre, anna, carlos, priya, alex, emma] =
    await Promise.all([
      // Wei Chen — Chinese pro, WTT rank 3
      prisma.player.create({
        data: {
          first_name: "Wei",
          last_name: "Chen",
          display_name: "Wei Chen",
          country_code: "CN",
          gender: "M",
          category: "SENIOR",
          club_id: clubShanghai.id,
        },
      }),
      // Sophie Marchand — French pro, WTT rank 72 (women)
      prisma.player.create({
        data: {
          first_name: "Sophie",
          last_name: "Marchand",
          display_name: "Sophie Marchand",
          country_code: "FR",
          gender: "F",
          category: "SENIOR",
          club_id: clubParis.id,
        },
      }),
      // Markus Hoffmann — German pro, WTT rank 44
      prisma.player.create({
        data: {
          first_name: "Markus",
          last_name: "Hoffmann",
          display_name: "Markus Hoffmann",
          country_code: "DE",
          gender: "M",
          category: "SENIOR",
          club_id: clubMunich.id,
        },
      }),
      // Erika Tanaka — Japanese pro, WTT rank 18 (women)
      prisma.player.create({
        data: {
          first_name: "Erika",
          last_name: "Tanaka",
          display_name: "Erika Tanaka",
          country_code: "JP",
          gender: "F",
          category: "SENIOR",
        },
      }),
      // Julien Bernard — French FFTT player, 2300 pts
      prisma.player.create({
        data: {
          first_name: "Julien",
          last_name: "Bernard",
          display_name: "Julien Bernard",
          country_code: "FR",
          gender: "M",
          category: "SENIOR",
          club_id: clubParis.id,
        },
      }),
      // Camille Roux — French FFTT player, 1650 pts
      prisma.player.create({
        data: {
          first_name: "Camille",
          last_name: "Roux",
          display_name: "Camille Roux",
          country_code: "FR",
          gender: "F",
          category: "SENIOR",
          club_id: clubParis.id,
        },
      }),
      // Pierre Lefebvre — French FFTT player, 980 pts
      prisma.player.create({
        data: {
          first_name: "Pierre",
          last_name: "Lefebvre",
          display_name: "Pierre Lefebvre",
          country_code: "FR",
          gender: "M",
          category: "SENIOR",
          club_id: clubParis.id,
        },
      }),
      // Anna Müller — German TTR 1820
      prisma.player.create({
        data: {
          first_name: "Anna",
          last_name: "Müller",
          display_name: "Anna Müller",
          country_code: "DE",
          gender: "F",
          category: "SENIOR",
          club_id: clubMunich.id,
        },
      }),
      // Carlos Vidal — Spanish RFETM, rank 15
      prisma.player.create({
        data: {
          first_name: "Carlos",
          last_name: "Vidal",
          display_name: "Carlos Vidal",
          country_code: "ES",
          gender: "M",
          category: "SENIOR",
          club_id: clubBarcelona.id,
        },
      }),
      // Priya Sharma — English Rankedin, rank 8
      prisma.player.create({
        data: {
          first_name: "Priya",
          last_name: "Sharma",
          display_name: "Priya Sharma",
          country_code: "GB",
          gender: "F",
          category: "SENIOR",
          club_id: clubLondon.id,
        },
      }),
      // Alex Durand — French beginner, questionnaire
      prisma.player.create({
        data: {
          first_name: "Alex",
          last_name: "Durand",
          display_name: "Alex Durand",
          country_code: "FR",
          gender: "M",
        },
      }),
      // Emma Wilson — British beginner, questionnaire
      prisma.player.create({
        data: {
          first_name: "Emma",
          last_name: "Wilson",
          display_name: "Emma Wilson",
          country_code: "GB",
          gender: "F",
        },
      }),
    ]);

  // ── player_external_ids ───────────────────────────────────────────────
  await Promise.all([
    prisma.playerExternalId.create({ data: { player_id: wei.id, source: "WTT", external_id: "WTT-CN-0003" } }),
    prisma.playerExternalId.create({ data: { player_id: sophie.id, source: "WTT", external_id: "WTT-FR-W072" } }),
    prisma.playerExternalId.create({ data: { player_id: sophie.id, source: "FFTT", external_id: "FFTT-756821" } }),
    prisma.playerExternalId.create({ data: { player_id: markus.id, source: "WTT", external_id: "WTT-DE-0044" } }),
    prisma.playerExternalId.create({ data: { player_id: markus.id, source: "TTR", external_id: "TTR-DE-88201" } }),
    prisma.playerExternalId.create({ data: { player_id: erika.id, source: "WTT", external_id: "WTT-JP-W018" } }),
    prisma.playerExternalId.create({ data: { player_id: julien.id, source: "FFTT", external_id: "FFTT-124530" } }),
    prisma.playerExternalId.create({ data: { player_id: camille.id, source: "FFTT", external_id: "FFTT-389014" } }),
    prisma.playerExternalId.create({ data: { player_id: pierre.id, source: "FFTT", external_id: "FFTT-501233" } }),
    prisma.playerExternalId.create({ data: { player_id: anna.id, source: "TTR", external_id: "TTR-DE-44819" } }),
    prisma.playerExternalId.create({ data: { player_id: carlos.id, source: "RFETM", external_id: "RFETM-0015" } }),
    prisma.playerExternalId.create({ data: { player_id: priya.id, source: "RANKEDIN", external_id: "RKD-GB-F008" } }),
  ]);

  // ── external_rankings ─────────────────────────────────────────────────
  const rankedAt = new Date("2024-03-01");
  await Promise.all([
    prisma.externalRanking.create({ data: { player_id: wei.id, source: "WTT", rank: 3, ranking_value: 10200, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importWTT.id } }),
    prisma.externalRanking.create({ data: { player_id: sophie.id, source: "WTT", rank: 72, ranking_value: 2800, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importWTT.id } }),
    prisma.externalRanking.create({ data: { player_id: sophie.id, source: "FFTT", ranking_value: 2450, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importFFTT.id } }),
    prisma.externalRanking.create({ data: { player_id: markus.id, source: "WTT", rank: 44, ranking_value: 4800, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importWTT.id } }),
    prisma.externalRanking.create({ data: { player_id: markus.id, source: "TTR", ranking_value: 2680, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importTTR.id } }),
    prisma.externalRanking.create({ data: { player_id: erika.id, source: "WTT", rank: 18, ranking_value: 7100, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importWTT.id } }),
    prisma.externalRanking.create({ data: { player_id: julien.id, source: "FFTT", ranking_value: 2300, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importFFTT.id } }),
    prisma.externalRanking.create({ data: { player_id: camille.id, source: "FFTT", ranking_value: 1650, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importFFTT.id } }),
    prisma.externalRanking.create({ data: { player_id: pierre.id, source: "FFTT", ranking_value: 980, ranked_at: rankedAt, confidence_level: "MEDIUM", import_id: importFFTT.id } }),
    prisma.externalRanking.create({ data: { player_id: anna.id, source: "TTR", ranking_value: 1820, ranked_at: rankedAt, confidence_level: "HIGH", import_id: importTTR.id } }),
    prisma.externalRanking.create({ data: { player_id: carlos.id, source: "RFETM", rank: 15, ranked_at: rankedAt, confidence_level: "MEDIUM" } }),
    prisma.externalRanking.create({ data: { player_id: priya.id, source: "RANKEDIN", rank: 8, ranked_at: rankedAt, confidence_level: "MEDIUM", import_id: importRankedin.id } }),
  ]);

  // ── Initial PGR snapshots ─────────────────────────────────────────────
  const initDate = new Date("2024-03-01T00:00:00Z");

  const ratings = {
    wei: initFromWTT({ rank: 3, points: 10200 }),
    sophie: initFromWTT({ rank: 72, points: 2800 }),
    markus: initFromWTT({ rank: 44, points: 4800 }),
    erika: initFromWTT({ rank: 18, points: 7100 }),
    julien: initFromFFTT({ points: 2300 }),
    camille: initFromFFTT({ points: 1650 }),
    pierre: initFromFFTT({ points: 980 }),
    anna: initFromTTR({ ttr: 1820 }),
    carlos: initFromRank({ rank: 15, source: "RFETM" }),
    priya: initFromRank({ rank: 8, source: "RANKEDIN" }),
    alex: initFromQuestionnaire("CLUB_BEGINNER"),
    emma: initFromQuestionnaire("COMPLETE_BEGINNER"),
  };

  const playerRatingPairs: Array<[string, typeof ratings.wei, string]> = [
    [wei.id, ratings.wei, "WTT"],
    [sophie.id, ratings.sophie, "WTT"],
    [markus.id, ratings.markus, "WTT"],
    [erika.id, ratings.erika, "WTT"],
    [julien.id, ratings.julien, "FFTT"],
    [camille.id, ratings.camille, "FFTT"],
    [pierre.id, ratings.pierre, "FFTT"],
    [anna.id, ratings.anna, "TTR"],
    [carlos.id, ratings.carlos, "RFETM"],
    [priya.id, ratings.priya, "RANKEDIN"],
    [alex.id, ratings.alex, "QUESTIONNAIRE"],
    [emma.id, ratings.emma, "QUESTIONNAIRE"],
  ];

  await Promise.all(
    playerRatingPairs.map(([playerId, r, source]) =>
      prisma.pgrSnapshot.create({
        data: {
          player_id: playerId,
          rating: r.rating,
          rating_deviation: r.ratingDeviation,
          volatility: r.volatility,
          match_count: 0,
          confidence_status: "PROVISIONAL",
          is_provisional: true,
          initialization_source: source as any,
          algorithm_version: PGR_CONFIG.ALGORITHM_VERSION,
          snapshot_date: initDate,
          trigger: "INITIALIZATION",
        },
      })
    )
  );

  // ── Matches (fictional, historically plausible) ────────────────────────
  const matchDate = (y: number, m: number, d: number) =>
    new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T14:00:00Z`);

  const matchData = [
    // WTT Frankfurt pro matches
    { a: wei.id, b: markus.id, w: wei.id, sa: 4, sb: 1, sets: [[11,8],[11,5],[9,11],[11,7],[11,9]], date: matchDate(2024,2,15), comp: compWTT.id, src: "WTT" },
    { a: sophie.id, b: erika.id, w: erika.id, sa: 1, sb: 4, sets: [[8,11],[9,11],[11,8],[7,11],[9,11]], date: matchDate(2024,2,16), comp: compWTT.id, src: "WTT" },
    { a: wei.id, b: markus.id, w: wei.id, sa: 4, sb: 0, sets: [[11,4],[11,6],[11,8],[11,3]], date: matchDate(2024,2,17), comp: compWTT.id, src: "WTT" },
    // Bridge match: Markus (WTT) vs Julien (FFTT) — creates DE-FR link
    { a: markus.id, b: julien.id, w: markus.id, sa: 3, sb: 1, sets: [[11,7],[9,11],[11,8],[11,5]], date: matchDate(2024,2,18), comp: compWTT.id, src: "WTT" },
    // French championship
    { a: julien.id, b: camille.id, w: julien.id, sa: 3, sb: 0, sets: [[11,6],[11,4],[11,8]], date: matchDate(2024,1,20), comp: compFftt.id, src: "FFTT" },
    { a: camille.id, b: pierre.id, w: camille.id, sa: 3, sb: 1, sets: [[11,5],[11,8],[8,11],[11,7]], date: matchDate(2024,1,21), comp: compFftt.id, src: "FFTT" },
    { a: julien.id, b: pierre.id, w: julien.id, sa: 3, sb: 0, sets: [[11,3],[11,5],[11,4]], date: matchDate(2024,2,10), comp: compFftt.id, src: "FFTT" },
    // Sophie (WTT/FFTT bridge) vs Julien in French championship
    { a: sophie.id, b: julien.id, w: sophie.id, sa: 3, sb: 0, sets: [[11,4],[11,6],[11,3]], date: matchDate(2024,3,10), comp: compFftt.id, src: "FFTT" },
    // Anna vs Markus — German internal
    { a: markus.id, b: anna.id, w: markus.id, sa: 3, sb: 0, sets: [[11,2],[11,5],[11,4]], date: matchDate(2024,1,15), src: "TTR" },
    // Ping Pang in-app matches (unvalidated at creation)
    { a: camille.id, b: alex.id, w: camille.id, sa: 3, sb: 0, sets: [[11,2],[11,3],[11,1]], date: matchDate(2024,3,20), src: "PING_PANG" },
    { a: alex.id, b: pierre.id, w: pierre.id, sa: 0, sb: 3, sets: [[4,11],[5,11],[3,11]], date: matchDate(2024,3,22), src: "PING_PANG" },
    { a: priya.id, b: emma.id, w: priya.id, sa: 3, sb: 0, sets: [[11,1],[11,2],[11,0]], date: matchDate(2024,3,25), src: "PING_PANG" },
  ];

  const createdMatches = await Promise.all(
    matchData.map((m) =>
      prisma.match.create({
        data: {
          player_a_id: m.a,
          player_b_id: m.b,
          winner_id: m.w,
          score_a: m.sa,
          score_b: m.sb,
          sets_detail: m.sets as any,
          played_at: m.date,
          competition_id: m.comp,
          source: m.src as any,
          // Imported official matches are auto-confirmed; Ping Pang matches start PENDING
          validation_status: m.src === "PING_PANG" ? "PENDING" : "CONFIRMED",
        },
      })
    )
  );

  console.log(`Created:`);
  console.log(`  4  source_imports`);
  console.log(`  5  clubs`);
  console.log(`  2  competitions`);
  console.log(`  12 players`);
  console.log(`  12 player_external_ids`);
  console.log(`  12 external_rankings`);
  console.log(`  12 pgr_snapshots (INITIALIZATION)`);
  console.log(`  ${createdMatches.length} matches (${matchData.filter(m => m.src !== "PING_PANG").length} CONFIRMED, ${matchData.filter(m => m.src === "PING_PANG").length} PENDING)`);
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
