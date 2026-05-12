/**
 * Vérification lecture seule du leaderboard PGR.
 * Aucune écriture. Aucune modification.
 *
 * Run: npm run --workspace=pgr-service check:leaderboard
 */
import { PrismaClient } from "@prisma/client";
import { PgrService, PlayersService, MatchesService, SnapshotsService } from "../src/index.js";

const prisma = new PrismaClient();
const pgr = new PgrService(
  prisma,
  new PlayersService(prisma),
  new MatchesService(prisma),
  new SnapshotsService(prisma)
);

async function main() {
  console.log("══ Vérification leaderboard PGR (read-only) ════════════════\n");

  // 1. Top 20 global
  const global = await pgr.getLeaderboard({ limit: 20 });
  console.log(`── Top 20 global ────────────────────────────────────────────`);
  console.log(`   Total joueurs avec snapshot : ${global.length}`);
  global.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${String(s.player.display_name).padEnd(24)} [${s.player.country_code}][${s.player.gender ?? "?"}]  ${s.rating.toFixed(0).padStart(5)}`
    )
  );

  // 2. Top 20 France
  const france = await pgr.getLeaderboard({ countryCode: "FR", limit: 20 });
  console.log(`\n── Top 20 France ────────────────────────────────────────────`);
  console.log(`   Total joueurs FR : ${france.length}`);
  france.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${String(s.player.display_name).padEnd(24)}  ${s.rating.toFixed(0).padStart(5)}`
    )
  );

  // 3. Top hommes
  const men = await pgr.getLeaderboard({ gender: "M" });
  const women = await pgr.getLeaderboard({ gender: "F" });
  console.log(`\n── Counts par genre ─────────────────────────────────────────`);
  console.log(`   Hommes (M) : ${men.length}`);
  console.log(`   Femmes (F) : ${women.length}`);

  // 4. Count par pays (via raw query)
  const countryCounts = await prisma.$queryRaw<
    Array<{ country_code: string | null; count: bigint }>
  >`
    SELECT p.country_code, COUNT(DISTINCT cr.player_id) as count
    FROM pgr_current_ratings cr
    JOIN pgr_players p ON p.id = cr.player_id
    GROUP BY p.country_code
    ORDER BY count DESC, p.country_code
  `;
  console.log(`\n── Count par pays (pgr_current_ratings) ─────────────────────`);
  (countryCounts as any[]).forEach((r) =>
    console.log(`   [${r.country_code ?? "??"}]  ${Number(r.count)} joueur(s)`)
  );

  // 5. Résumé par source d'init
  const initSources = await prisma.$queryRaw<
    Array<{ initialization_source: string | null; count: bigint }>
  >`
    SELECT s.initialization_source, COUNT(DISTINCT s.player_id) as count
    FROM pgr_current_ratings cr
    JOIN pgr_snapshots s ON s.id = cr.snapshot_id
    GROUP BY s.initialization_source
    ORDER BY count DESC
  `;
  console.log(`\n── Count par source d'initialisation ────────────────────────`);
  (initSources as any[]).forEach((r) =>
    console.log(`   [${r.initialization_source ?? "QUESTIONNAIRE"}]  ${Number(r.count)} joueur(s)`)
  );

  console.log("\n══ Fin — aucune écriture ════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
