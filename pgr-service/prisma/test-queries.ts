/**
 * PGR v1 — Query smoke tests
 *
 * Tests all PgrService read/write methods against the seeded data.
 * Requires: npm run db:seed has been run at least once.
 *
 * Run with: npm run db:test-queries
 */

import { PrismaClient } from "@prisma/client";
import {
  PlayersService,
  MatchesService,
  SnapshotsService,
  PgrService,
} from "../src/index.js";

const prisma = new PrismaClient();
const pgr = new PgrService(
  prisma,
  new PlayersService(prisma),
  new MatchesService(prisma),
  new SnapshotsService(prisma)
);

async function main() {
  // Resolve two players from the seed by last name
  const [wei, sophie] = await Promise.all([
    prisma.player.findFirst({ where: { last_name: "Chen" } }),
    prisma.player.findFirst({ where: { last_name: "Marchand" } }),
  ]);
  if (!wei || !sophie) {
    throw new Error("Seed data not found — run npm run db:seed first");
  }

  // ── 1. getCurrentRating ────────────────────────────────────────────────
  console.log("\n── 1. getCurrentRating ──────────────────────────────────");
  const weiRating = await pgr.getCurrentRating(wei.id);
  console.log(
    `  ${weiRating?.player.display_name} (${weiRating?.player.country_code})`
  );
  console.log(`  Rating : ${weiRating?.snapshot?.rating.toFixed(0)}`);
  console.log(`  RD     : ${weiRating?.snapshot?.rating_deviation.toFixed(0)}`);
  console.log(`  Status : ${weiRating?.snapshot?.confidence_status}`);
  console.log(`  Source : ${weiRating?.snapshot?.initialization_source}`);

  // ── 2. getLeaderboard — global top 5 ──────────────────────────────────
  console.log("\n── 2. getLeaderboard (global top 5) ────────────────────");
  const top5 = await pgr.getLeaderboard({ limit: 5 });
  top5.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${s.player.display_name.padEnd(20)} ${s.rating
        .toFixed(0)
        .padStart(5)}  RD: ${s.rating_deviation.toFixed(0).padStart(3)}  [${s.player.country_code}]`
    );
  });

  // ── 3. getLeaderboard — France ─────────────────────────────────────────
  console.log("\n── 3. getLeaderboard (France) ───────────────────────────");
  const frBoard = await pgr.getLeaderboard({ countryCode: "FR" });
  frBoard.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${s.player.display_name.padEnd(20)} ${s.rating.toFixed(0)}`
    );
  });

  // ── 4. getPlayerHistory ────────────────────────────────────────────────
  console.log(
    "\n── 4. getPlayerHistory (Sophie Marchand) ────────────────"
  );
  const sophieHist = await pgr.getPlayerHistory(sophie.id);
  console.log(`  Player: ${sophieHist.player?.display_name}`);
  sophieHist.history.forEach((s) => {
    console.log(
      `  [${s.snapshot_date.toISOString().slice(0, 10)}]  ${s.rating
        .toFixed(0)
        .padStart(5)} ± ${s.rating_deviation
        .toFixed(0)
        .padStart(3)}  trigger: ${s.trigger}`
    );
  });

  // ── 5. createMatch ────────────────────────────────────────────────────
  console.log("\n── 5. createMatch ───────────────────────────────────────");
  const newMatch = await pgr.createMatch({
    playerAId: wei.id,
    playerBId: sophie.id,
    winnerId: wei.id,
    scoreA: 3,
    scoreB: 0,
    setsDetail: [
      [11, 5],
      [11, 7],
      [11, 4],
    ],
    playedAt: new Date("2024-04-01T14:00:00Z"),
    source: "PING_PANG",
  });
  console.log(`  id     : ${newMatch.id}`);
  console.log(`  status : ${newMatch.validation_status}`);

  // ── 6. confirmMatch ───────────────────────────────────────────────────
  console.log("\n── 6. confirmMatch ──────────────────────────────────────");
  const confirmed = await pgr.confirmMatch(newMatch.id);
  console.log(`  Match ${confirmed.id.slice(0, 8)}…  status: ${confirmed.validation_status}`);

  // ── 7. processConfirmedMatches ────────────────────────────────────────
  console.log(
    "\n── 7. processConfirmedMatches ───────────────────────────"
  );
  const weiSnapBefore = (await pgr.getCurrentRating(wei.id))?.snapshot;
  const sophieSnapBefore = (await pgr.getCurrentRating(sophie.id))?.snapshot;

  await pgr.processConfirmedMatches({
    since: new Date("2024-01-01"),
    until: new Date("2024-12-31"),
  });

  const weiSnapAfter = (await pgr.getCurrentRating(wei.id))?.snapshot;
  const sophieSnapAfter = (await pgr.getCurrentRating(sophie.id))?.snapshot;

  console.log(
    `  Wei Chen        : ${weiSnapBefore?.rating.toFixed(0)} → ${weiSnapAfter?.rating.toFixed(0)}  (Δ ${(
      (weiSnapAfter?.rating ?? 0) - (weiSnapBefore?.rating ?? 0)
    ).toFixed(0)})`
  );
  console.log(
    `  Sophie Marchand : ${sophieSnapBefore?.rating.toFixed(0)} → ${sophieSnapAfter?.rating.toFixed(0)}  (Δ ${(
      (sophieSnapAfter?.rating ?? 0) - (sophieSnapBefore?.rating ?? 0)
    ).toFixed(0)})`
  );

  // ── 8. leaderboard after processing ───────────────────────────────────
  console.log(
    "\n── 8. getLeaderboard after processConfirmedMatches (top 5) ─"
  );
  const top5After = await pgr.getLeaderboard({ limit: 5 });
  top5After.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${s.player.display_name.padEnd(20)} ${s.rating
        .toFixed(0)
        .padStart(5)}  matches: ${s.match_count}`
    );
  });

  console.log("\nAll queries OK.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
