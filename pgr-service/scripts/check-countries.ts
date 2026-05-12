/**
 * Top 20 par pays : CN, JP, KR
 * Run: cd pgr-service && npx tsx scripts/check-countries.ts
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

async function showTop(label: string, countryCode: string, gender?: "M" | "F") {
  const results = await pgr.getLeaderboard({ countryCode, gender, limit: 20 });
  console.log(`\n── Top 20 ${label} ─────────────────────────────────────────`);
  console.log(`   Total : ${results.length}`);
  results.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${String(s.player.display_name).padEnd(26)} [${s.player.gender ?? "?"}]  ${s.rating.toFixed(0).padStart(5)}`
    )
  );
}

async function main() {
  console.log("══ Top 20 par pays ══════════════════════════════════════════\n");

  await showTop("Chine (CN)", "CN");
  await showTop("Japon (JP)", "JP");
  await showTop("Corée (KR)", "KR");

  console.log("\n══ Fin ══════════════════════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
