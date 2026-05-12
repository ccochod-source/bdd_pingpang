/**
 * PGR v1 — Full flow integration test
 *
 * Simulates the complete backend lifecycle:
 *   createPlayer → initializePlayer → createMatch → confirmMatch
 *   → processConfirmedMatches → getCurrentRating → getPlayerHistory → getLeaderboard
 *
 * Creates and then deletes its own test data. Never touches non-pgr_ tables.
 * Safe to run multiple times.
 *
 * Run with: npm run test:flow
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

// ── Assertion helpers ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string, detail = "") {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? `  ← ${detail}` : ""}`);
    failed++;
  }
}

// ── Cleanup registry ───────────────────────────────────────────────────────

const toClean = { matchIds: [] as string[], playerIds: [] as string[] };

async function teardown() {
  if (toClean.matchIds.length) {
    await prisma.match.deleteMany({ where: { id: { in: toClean.matchIds } } });
  }
  for (const pid of toClean.playerIds) {
    await prisma.pgrSnapshot.deleteMany({ where: { player_id: pid } });
    await prisma.externalRanking.deleteMany({ where: { player_id: pid } });
    await prisma.playerExternalId.deleteMany({ where: { player_id: pid } });
    await prisma.player.delete({ where: { id: pid } }).catch(() => {});
  }
}

// ── Main flow ──────────────────────────────────────────────────────────────

async function main() {
  console.log("PGR Flow Test\n");

  try {
    // ── 1. createPlayer ────────────────────────────────────────────────
    console.log("── 1. createPlayer");

    const playerA = await pgr.createPlayer({
      firstName: "Test",
      lastName: "AlphaFlow",
      countryCode: "FR",
      gender: "M",
    });
    toClean.playerIds.push(playerA.id);
    ok(!!playerA.id, "Player A créé");

    const playerB = await pgr.createPlayer({
      firstName: "Test",
      lastName: "BetaFlow",
      countryCode: "DE",
      gender: "F",
    });
    toClean.playerIds.push(playerB.id);
    ok(!!playerB.id, "Player B créé");

    // ── 2. Pas de snapshot avant initialisation ────────────────────────
    console.log("\n── 2. Pas de snapshot avant initialisation");

    const beforeInit = await pgr.getCurrentRating(playerA.id);
    ok(beforeInit?.snapshot === null, "getCurrentRating.snapshot = null avant init");

    // ── 3. initializeFromQuestionnaire ────────────────────────────────
    console.log("\n── 3. initializeFromQuestionnaire (A = CLUB_BEGINNER)");

    const snapA = await pgr.initializeFromQuestionnaire(playerA.id, "CLUB_BEGINNER");
    ok(snapA.trigger === "INITIALIZATION", "trigger = INITIALIZATION");
    ok(snapA.initialization_source === "QUESTIONNAIRE", "source = QUESTIONNAIRE");
    ok(snapA.rating === 1300, `rating = 1300 (got ${snapA.rating})`);
    ok(snapA.rating_deviation === 300, `RD = 300 (got ${snapA.rating_deviation})`);
    ok(snapA.match_count === 0, "match_count = 0");

    // ── 4. addExternalRanking + initializePlayer ───────────────────────
    console.log("\n── 4. addExternalRanking + initializePlayer (B = TTR 1820)");

    await pgr.addExternalRanking(playerB.id, {
      source: "TTR",
      rankingValue: 1820,
      rankedAt: new Date("2024-03-01"),
      confidenceLevel: "HIGH",
    });
    const snapB = await pgr.initializePlayer(playerB.id);
    ok(snapB.trigger === "INITIALIZATION", "trigger = INITIALIZATION");
    ok(snapB.initialization_source === "TTR", "source = TTR");
    // TTR formula: pgr = 1500 + (ttr - 1500) * 0.9 = 1500 + 290 = 1790... actually initFromTTR({ttr:1820})
    // = 1500 + (1820-1500)*0.9 = 1500 + 288 = 1788
    ok(snapB.rating > 1500, `B rating > 1500 (got ${snapB.rating.toFixed(0)})`);

    // ── 5. getCurrentRating — confirme les snapshots d'init ────────────
    console.log("\n── 5. getCurrentRating (après init)");

    const rA0 = await pgr.getCurrentRating(playerA.id);
    const rB0 = await pgr.getCurrentRating(playerB.id);
    ok(rA0?.snapshot?.rating === 1300, `A = 1300 (got ${rA0?.snapshot?.rating})`);
    ok((rB0?.snapshot?.rating ?? 0) > 1500, `B > 1500 (got ${rB0?.snapshot?.rating?.toFixed(0)})`);
    ok(rA0?.player.id === playerA.id, "getCurrentRating retourne le player");

    // ── 6. createMatch (PENDING) ───────────────────────────────────────
    console.log("\n── 6. createMatch (PENDING, A bat B)");

    const match = await pgr.createMatch({
      playerAId: playerA.id,
      playerBId: playerB.id,
      winnerId: playerA.id,
      scoreA: 3,
      scoreB: 1,
      setsDetail: [[11, 8], [9, 11], [11, 7], [11, 6]],
      playedAt: new Date("2024-04-10T14:00:00Z"),
      source: "PING_PANG",
    });
    toClean.matchIds.push(match.id);
    ok(match.validation_status === "PENDING", "status = PENDING");
    ok(match.winner_id === playerA.id, "winner_id = playerA");

    // ── 7. processConfirmedMatches avec match PENDING ─────────────────
    console.log("\n── 7. processConfirmedMatches (match PENDING — doit être ignoré)");

    await pgr.processConfirmedMatches({
      since: new Date("2024-04-01"),
      until: new Date("2024-04-30"),
    });

    const rA_pending = await pgr.getCurrentRating(playerA.id);
    const rB_pending = await pgr.getCurrentRating(playerB.id);
    ok(
      rA_pending?.snapshot?.rating === rA0?.snapshot?.rating,
      `A inchangé — match PENDING ignoré (${rA_pending?.snapshot?.rating})`
    );
    ok(
      rB_pending?.snapshot?.rating === rB0?.snapshot?.rating,
      `B inchangé — match PENDING ignoré (${rB_pending?.snapshot?.rating})`
    );
    const histA_pending = await pgr.getPlayerHistory(playerA.id);
    ok(
      histA_pending.history.length === 1,
      `A a toujours 1 seul snapshot (got ${histA_pending.history.length})`
    );

    // ── 8. confirmMatch ────────────────────────────────────────────────
    console.log("\n── 8. confirmMatch");

    const confirmed = await pgr.confirmMatch(match.id);
    ok(confirmed.validation_status === "CONFIRMED", "status = CONFIRMED");

    // ── 9. processConfirmedMatches (match CONFIRMED) ───────────────────
    console.log("\n── 9. processConfirmedMatches (match CONFIRMED — doit impacter PGR)");

    await pgr.processConfirmedMatches({
      since: new Date("2024-04-01"),
      until: new Date("2024-04-30"),
    });

    const rA1 = await pgr.getCurrentRating(playerA.id);
    const rB1 = await pgr.getCurrentRating(playerB.id);

    const deltaA = (rA1?.snapshot?.rating ?? 0) - (rA0?.snapshot?.rating ?? 0);
    const deltaB = (rB1?.snapshot?.rating ?? 0) - (rB0?.snapshot?.rating ?? 0);

    ok(deltaA !== 0, `A rating modifié (Δ ${deltaA > 0 ? "+" : ""}${deltaA.toFixed(1)})`);
    ok(deltaB !== 0, `B rating modifié (Δ ${deltaB > 0 ? "+" : ""}${deltaB.toFixed(1)})`);
    ok(deltaA > 0, `A (gagnant) monte (Δ +${deltaA.toFixed(1)})`);
    ok(deltaB < 0, `B (perdant) descend (Δ ${deltaB.toFixed(1)})`);
    ok(
      (rA1?.snapshot?.match_count ?? 0) === 1,
      `A.match_count = 1 (got ${rA1?.snapshot?.match_count})`
    );
    ok(
      (rB1?.snapshot?.match_count ?? 0) === 1,
      `B.match_count = 1 (got ${rB1?.snapshot?.match_count})`
    );

    // ── 10. Chaque recalcul crée un nouveau snapshot ───────────────────
    console.log("\n── 10. Historique — chaque recalcul crée un nouveau snapshot");

    const histA = await pgr.getPlayerHistory(playerA.id);
    const histB = await pgr.getPlayerHistory(playerB.id);

    ok(histA.history.length === 2, `A a 2 snapshots (INITIALIZATION + MATCH_BATCH) — got ${histA.history.length}`);
    ok(histB.history.length === 2, `B a 2 snapshots (INITIALIZATION + MATCH_BATCH) — got ${histB.history.length}`);
    ok(histA.history[0].trigger === "MATCH_BATCH", `A history[0].trigger = MATCH_BATCH`);
    ok(histA.history[1].trigger === "INITIALIZATION", `A history[1].trigger = INITIALIZATION`);
    // Dernier snapshot = bon rating
    ok(
      histA.history[0].rating === rA1?.snapshot?.rating,
      `getCurrentRating retourne bien le dernier snapshot`
    );

    // ── 11. processConfirmedMatches idempotent sur fenêtre déjà traitée
    console.log("\n── 11. Idempotence — re-process sur la même fenêtre");

    // Re-run on same window — should create NEW snapshots from batch
    // (Glicko-2 would include the same matches again — this tests the behavior)
    // The match is now in the batch again, so match_count will increment
    // This is expected behavior: the same match gets processed again
    // In production, you'd track processed_at on matches — out of scope for v1
    const histA_before_rerun = await pgr.getPlayerHistory(playerA.id);
    const snapshotCountBefore = histA_before_rerun.history.length;

    // For now just verify no crash and new snapshots are created
    await pgr.processConfirmedMatches({
      since: new Date("2024-04-01"),
      until: new Date("2024-04-30"),
    });
    const histA_after_rerun = await pgr.getPlayerHistory(playerA.id);
    ok(
      histA_after_rerun.history.length > snapshotCountBefore,
      `Re-process crée bien un nouveau snapshot (immutable history)`
    );

    // ── 12. getLeaderboard ─────────────────────────────────────────────
    console.log("\n── 12. getLeaderboard");

    const board = await pgr.getLeaderboard();
    const boardA = board.find((s) => s.player_id === playerA.id);
    const boardB = board.find((s) => s.player_id === playerB.id);

    ok(!!boardA, "A présent dans le leaderboard");
    ok(!!boardB, "B présent dans le leaderboard");

    // Leaderboard doit refléter le DERNIER snapshot
    const rA_final = await pgr.getCurrentRating(playerA.id);
    ok(
      boardA?.rating === rA_final?.snapshot?.rating,
      `leaderboard A = dernier snapshot (${boardA?.rating?.toFixed(0)})`
    );
    // Players are returned with display info
    ok(boardA?.player.country_code === "FR", `A.country_code = FR`);
    ok(boardB?.player.country_code === "DE", `B.country_code = DE`);

    // Leaderboard filtré par pays
    const frBoard = await pgr.getLeaderboard({ countryCode: "FR" });
    ok(
      frBoard.some((s) => s.player_id === playerA.id),
      "A dans leaderboard FR"
    );
    ok(
      !frBoard.some((s) => s.player_id === playerB.id),
      "B absent du leaderboard FR"
    );

  } finally {
    await teardown();
    await prisma.$disconnect();
  }

  // ── Résultat ───────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${total} assertions — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("Flow test OK.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
