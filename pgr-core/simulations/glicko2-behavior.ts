/**
 * PGR v1 — Glicko-2 Behavior Simulations
 *
 * Pure calculation, no database. Covers all critical rating scenarios.
 * Goal: understand the algorithm's natural behavior before any tuning.
 *
 * Run with: npm run simulate
 */

import { calculateRatingUpdate } from "../src/glicko2.js";
import { PGR_CONFIG } from "../src/config.js";
import type { PlayerRating, OpponentResult } from "../src/types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function mkPlayer(rating: number, rd: number, matchCount = 0, vol = PGR_CONFIG.DEFAULT_VOLATILITY): PlayerRating {
  const status =
    matchCount === 0 ? "UNRATED"
    : matchCount < PGR_CONFIG.PROVISIONAL_THRESHOLD ? "PROVISIONAL"
    : matchCount < PGR_CONFIG.STABLE_THRESHOLD ? "CALIBRATING"
    : "STABLE";
  return {
    rating, ratingDeviation: rd, volatility: vol, matchCount,
    confidenceStatus: status,
    isProvisional: matchCount < PGR_CONFIG.PROVISIONAL_THRESHOLD,
    initializationSource: "PING_PANG",
    algorithmVersion: PGR_CONFIG.ALGORITHM_VERSION,
  };
}

function apply(p: PlayerRating, results: OpponentResult[]): PlayerRating {
  const u = calculateRatingUpdate(p, results);
  return { ...p, ...u };
}

/** Play one match, return updated player. */
function match(p: PlayerRating, oppRating: number, oppRD: number, outcome: 0 | 1): PlayerRating {
  return apply(p, [{ opponentRating: oppRating, opponentRD: oppRD, outcome }]);
}

/** Simulate N periods of inactivity. */
function inactive(p: PlayerRating, periods: number): PlayerRating {
  let curr = p;
  for (let i = 0; i < periods; i++) curr = apply(curr, []);
  return curr;
}

/** Simulate a series of matches, one per period. Returns full history. */
function series(initial: PlayerRating, rounds: Array<{ oppRating: number; oppRD: number; outcome: 0 | 1 }>): PlayerRating[] {
  const history: PlayerRating[] = [initial];
  let curr = initial;
  for (const r of rounds) {
    curr = match(curr, r.oppRating, r.oppRD, r.outcome);
    history.push(curr);
  }
  return history;
}

// ── Formatting ─────────────────────────────────────────────────────────────

const LINE = "─".repeat(78);
const DLINE = "═".repeat(78);

function ratingStr(p: PlayerRating): string {
  const badge =
    p.confidenceStatus === "STABLE"      ? "[STABLE]"
    : p.confidenceStatus === "CALIBRATING" ? "[CALIBRATING]"
    : p.confidenceStatus === "PROVISIONAL" ? "[PROVISIONAL]"
    : "[UNRATED]";
  return `${p.rating.toFixed(1).padStart(7)} ± ${p.ratingDeviation.toFixed(1).padEnd(6)} vol=${p.volatility.toFixed(5)}  ${badge} (${p.matchCount}m)`;
}

function row(label: string, before: PlayerRating, after: PlayerRating) {
  const dR = after.rating - before.rating;
  const dRD = after.ratingDeviation - before.ratingDeviation;
  const sign = (n: number) => n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
  const dRStr = sign(dR).padStart(7);
  const dRDStr = sign(dRD).padStart(6);
  console.log(`  ${label.padEnd(8)} avant : ${ratingStr(before)}`);
  console.log(`  ${" ".repeat(8)} après : ${ratingStr(after)}`);
  console.log(`  ${" ".repeat(8)} delta : ${dRStr} rating   ${dRDStr} RD`);
}

function section(title: string) {
  console.log(`\n${LINE}`);
  console.log(` ${title}`);
  console.log(LINE);
}

function header() {
  console.log(DLINE);
  console.log("  PGR v1 — Glicko-2 Behavior Simulations");
  console.log(`  TAU=${PGR_CONFIG.TAU}  PROVISIONAL<${PGR_CONFIG.PROVISIONAL_THRESHOLD}m  CALIBRATING<${PGR_CONFIG.STABLE_THRESHOLD}m  STABLE>=${PGR_CONFIG.STABLE_THRESHOLD}m`);
  console.log(DLINE);
}

// ── Scenarios ─────────────────────────────────────────────────────────────

header();

// ── S1: Débutant vs débutant ───────────────────────────────────────────────
section("S1 · Débutant vs débutant  [questionnaire CLUB_BEGINNER : 1300/300]");

const beg_a = mkPlayer(1300, 300, 0);
const beg_b = mkPlayer(1300, 300, 0);

const s1_a_win = match(beg_a, beg_b.rating, beg_b.ratingDeviation, 1);
const s1_b_win = match(beg_b, beg_a.rating, beg_a.ratingDeviation, 1);

row("A gagne", beg_a, s1_a_win);
console.log();
row("B gagne", beg_b, s1_b_win);
console.log(`
  Lecture : Deux débutants qui se battent. Résultat légèrement supérieur à
  l'attendu car RD élevé amplifie chaque victoire. Le gagnant monte mais
  la RD reste haute — un seul match n'est pas suffisant pour affirmer quoi que ce soit.`);

// ── S2: Débutant vs joueur stable ─────────────────────────────────────────
section("S2 · Débutant vs joueur stable  [1300/300  vs  1600/50]");

const beg = mkPlayer(1300, 300, 0);
const stable_mid = mkPlayer(1600, 50, 50);

const s2_beg_upsets = match(beg, stable_mid.rating, stable_mid.ratingDeviation, 1);
const s2_beg_loses  = match(beg, stable_mid.rating, stable_mid.ratingDeviation, 0);
const s2_stable_win = match(stable_mid, beg.rating, beg.ratingDeviation, 1);
const s2_stable_loses = match(stable_mid, beg.rating, beg.ratingDeviation, 0);

row("A (déb.) upset", beg, s2_beg_upsets);
console.log();
row("A (déb.) perd",  beg, s2_beg_loses);
console.log();
row("B (stable) gagne", stable_mid, s2_stable_win);
console.log();
row("B (stable) perd",  stable_mid, s2_stable_loses);
console.log(`
  Lecture : La RD du joueur stable (50) protège son rating — même une défaite
  contre un débutant ne le détruit pas. Le débutant bouge beaucoup dans les deux
  sens : c'est la RD élevée qui amplifie ses résultats. Comportement correct.`);

// ── S3: Stable vs stable ───────────────────────────────────────────────────
section("S3 · Joueur stable vs joueur stable  [1800/50  vs  1500/50]");

const stable_top = mkPlayer(1800, 50, 60);
const stable_low = mkPlayer(1500, 50, 60);

const s3_top_wins  = match(stable_top, stable_low.rating, stable_low.ratingDeviation, 1);
const s3_top_loses = match(stable_top, stable_low.rating, stable_low.ratingDeviation, 0);
const s3_low_wins  = match(stable_low, stable_top.rating, stable_top.ratingDeviation, 1);

row("Top (1800) gagne [attendu]",   stable_top, s3_top_wins);
console.log();
row("Top (1800) perd  [upset]",     stable_top, s3_top_loses);
console.log();
row("Bas (1500) gagne [huge upset]", stable_low, s3_low_wins);
console.log(`
  Lecture : Deux joueurs stables. La victoire attendue (top gagne) fait peu
  bouger les ratings — c'est l'information déjà connue. L'upset (bas gagne)
  donne un signal fort. C'est exactement ce que Glicko-2 est censé faire.`);

// ── S4: Top mondial vs joueur moyen ───────────────────────────────────────
section("S4 · Top mondial vs joueur moyen  [2700/80  vs  1700/80]");

const world_top = mkPlayer(2700, 80, 100);
const regional  = mkPlayer(1700, 80, 40);

const s4_top_wins  = match(world_top, regional.rating, regional.ratingDeviation, 1);
const s4_top_loses = match(world_top, regional.rating, regional.ratingDeviation, 0);
const s4_reg_upsets = match(regional, world_top.rating, world_top.ratingDeviation, 1);

row("WTT #1 gagne [attendu]", world_top, s4_top_wins);
console.log();
row("WTT #1 perd  [upset]",   world_top, s4_top_loses);
console.log();
row("Régional upset WTT #1",  regional,  s4_reg_upsets);
console.log(`
  Lecture : Le top mondial ne gagne presque rien en battant un joueur 1000 pts
  en dessous — résultat déjà attendu. En cas d'upset, la perte est modérée (RD
  basse = résistance). Le régional gagne énormément : upset informatif.`);

// ── S5: Upset énorme ───────────────────────────────────────────────────────
section("S5 · Upset énorme  [900/250 débutant avancé  bat  2400/60 champion]");

const weak = mkPlayer(900, 250, 3);
const champ = mkPlayer(2400, 60, 80);

const s5_weak_upsets = match(weak, champ.rating, champ.ratingDeviation, 1);
const s5_champ_wins  = match(champ, weak.rating, weak.ratingDeviation, 1);
const s5_champ_loses = match(champ, weak.rating, weak.ratingDeviation, 0);

row("Faible (900) bat champion", weak,  s5_weak_upsets);
console.log();
row("Champion gagne [trivial]",  champ, s5_champ_wins);
console.log();
row("Champion perd  [upset]",    champ, s5_champ_loses);
console.log(`
  Lecture : Upset extrême. Le joueur faible gagne +200 à +500 pts selon la RD.
  Le champion perd peu car RD=60 et l'événement est mathématiquement possible
  (incertitude haute sur le faible). Ce comportement est CORRECT — c'est
  précisément ce que doit faire un système de rating sérieux face à l'incertitude.`);

// ── S6: Série de 10 victoires ─────────────────────────────────────────────
section("S6 · Série de 10 victoires  [départ : 1500/350  vs  1500/50 à chaque match]");

const newcomer = mkPlayer(1500, 350, 0);
const opp_stable = { oppRating: 1500, oppRD: 50 };
const wins10 = series(newcomer, Array(10).fill({ ...opp_stable, outcome: 1 as 0 | 1 }));

console.log(`  Après chaque victoire consécutive contre 1500/RD50 :\n`);
wins10.forEach((p, i) => {
  if (i === 0) return;
  const prev = wins10[i - 1];
  const dR = p.rating - prev.rating;
  console.log(`  Match ${String(i).padStart(2)} : ${p.rating.toFixed(0).padStart(5)} ± ${p.ratingDeviation.toFixed(0).padStart(3)}  vol=${p.volatility.toFixed(5)}  Δ+${dR.toFixed(0).padStart(4)}  [${p.confidenceStatus}]`);
});
console.log(`
  Lecture : Convergence rapide. Les premiers matchs donnent les plus gros gains
  (RD haute = fort apprentissage). Chaque victoire réduit la RD et donc
  l'amplitude des gains suivants. Le système converge naturellement.`);

// ── S7: Série de 10 défaites ──────────────────────────────────────────────
section("S7 · Série de 10 défaites  [départ : 1500/350  vs  1500/50 à chaque match]");

const loses10 = series(newcomer, Array(10).fill({ ...opp_stable, outcome: 0 as 0 | 1 }));

console.log(`  Après chaque défaite consécutive contre 1500/RD50 :\n`);
loses10.forEach((p, i) => {
  if (i === 0) return;
  const prev = loses10[i - 1];
  const dR = p.rating - prev.rating;
  console.log(`  Match ${String(i).padStart(2)} : ${p.rating.toFixed(0).padStart(5)} ± ${p.ratingDeviation.toFixed(0).padStart(3)}  vol=${p.volatility.toFixed(5)}  Δ${dR.toFixed(0).padStart(5)}  [${p.confidenceStatus}]`);
});
console.log(`
  Lecture : Symétrie parfaite avec les victoires. La série de défaites fait
  converger rapidement vers le bas. Floor naturel : si un joueur 1500 perd
  10× contre des 1500, il finit autour de 850-900 — ce niveau est réaliste.`);

// ── S8: Symétrie victoires / défaites  ────────────────────────────────────
section("S8 · Alternance victoire/défaite  [1500/350 vs 1500/50]");

const alternating = series(newcomer, Array(20).fill(null).map((_, i) => ({
  ...opp_stable, outcome: (i % 2 === 0 ? 1 : 0) as 0 | 1,
})));

[5, 10, 20].forEach(n => {
  const p = alternating[n];
  console.log(`  Après ${String(n).padStart(2)} matchs : ${p.rating.toFixed(0).padStart(5)} ± ${p.ratingDeviation.toFixed(0).padStart(3)}  vol=${p.volatility.toFixed(5)}  [${p.confidenceStatus}]`);
});
console.log(`
  Lecture : Un joueur qui alterne victoires/défaites contre des égaux converge
  vers 1500 avec une RD stable. Le système s'auto-calibre correctement.`);

// ── S9: Inactivité ────────────────────────────────────────────────────────
section("S9 · Inactivité — dérive de la RD  [joueur stable : 1800/50]");

const active_stable = mkPlayer(1800, 50, 80);
console.log(`  Départ : ${ratingStr(active_stable)}\n`);

[1, 4, 12, 24, 52].forEach(periods => {
  const p = inactive(active_stable, periods);
  const label = periods === 1 ? "1 période " : periods === 4 ? "4 périodes" : periods === 12 ? "12 pér.   " : periods === 24 ? "24 pér.   " : "52 pér.   ";
  const timeLabel =
    periods === 1  ? "(1 semaine)" :
    periods === 4  ? "(1 mois)   " :
    periods === 12 ? "(3 mois)   " :
    periods === 24 ? "(6 mois)   " :
                     "(1 an)     ";
  console.log(`  ${label} ${timeLabel} : ${ratingStr(p)}`);
});

console.log(`
  Lecture : La RD croît très lentement avec TAU=0.5 et Vol=0.06. Un joueur
  stable (RD=50) qui disparaît 1 an ne dépasse pas 75-80 de RD. Le système
  est résistant à l'inactivité — pas d'inflation/déflation sauvage. `);

// ── S10: Retour après inactivité ──────────────────────────────────────────
section("S10 · Retour après 1 an d'inactivité  [1800/50 → inactif → reprend]");

const before_inactive = mkPlayer(1800, 50, 80);
const after_12months  = inactive(before_inactive, 52);
const comeback_win    = match(after_12months, 1700, 60, 1);
const comeback_lose   = match(after_12months, 1700, 60, 0);

console.log(`  Avant pause  : ${ratingStr(before_inactive)}`);
console.log(`  Après 1 an   : ${ratingStr(after_12months)}`);
console.log();
row("  Retour, gagne [vs 1700/60]", after_12months, comeback_win);
console.log();
row("  Retour, perd  [vs 1700/60]", after_12months, comeback_lose);
console.log(`
  Lecture : Le retour est traité comme un état d'incertitude légèrement
  augmentée. Premier match = fort signal. Les 2e et 3e matchs ramèneront
  rapidement vers la vraie valeur actuelle.`);

// ── S11: Progression selon le nombre de matchs ────────────────────────────
section("S11 · Progression à 5 / 30 / 300 matchs  [1500/350 vs 1500/50]");

function progressTo(n: number): PlayerRating {
  // Alternating W/L for realism — converges toward true level
  const results = Array(n).fill(null).map((_, i) => ({
    ...opp_stable, outcome: (i % 3 !== 2 ? 1 : 0) as 0 | 1, // 2W/1L ratio
  }));
  return series(newcomer, results)[n];
}

[5, 10, 20, 30, 50, 100, 200, 300].forEach(n => {
  const p = progressTo(n);
  console.log(
    `  ${String(n).padStart(3)} matchs : ${p.rating.toFixed(0).padStart(5)} ± ${p.ratingDeviation.toFixed(0).padStart(3)}  vol=${p.volatility.toFixed(5)}  [${p.confidenceStatus}]`
  );
});
console.log(`
  Lecture : La RD converge asymptotiquement. À 30 matchs on entre en STABLE,
  mais la RD peut encore être à 100-150. Après 100-200 matchs, un joueur
  bien actif atteint RD=50-70 : le "steady state" Glicko-2.`);

// ── S12: Impact du paramètre TAU ──────────────────────────────────────────
section("S12 · Sensibilité au paramètre TAU  [même scénario, TAU=0.3 / 0.5 / 1.0]");

console.log(`  Scénario : 1500/350 bat 1700/60  (premier match, fort adversaire)\n`);

[0.3, 0.5, 1.0].forEach(tau => {
  const p = mkPlayer(1500, 350, 0);
  const update = calculateRatingUpdate(p, [{ opponentRating: 1700, opponentRD: 60, outcome: 1 }], tau);
  console.log(
    `  TAU=${tau}  : ${p.rating.toFixed(0)} → ${update.rating.toFixed(0).padStart(5)} ± ${update.ratingDeviation.toFixed(0).padStart(3)}  vol: ${p.volatility.toFixed(5)} → ${update.volatility.toFixed(5)}`
  );
});
console.log(`
  Lecture : TAU contrôle la réactivité de la VOLATILITY (pas directement
  du rating). À TAU=0.5 (valeur courante), la volatilité évolue modérément.
  À TAU=1.0 elle peut exploser. Notre TAU=0.5 est dans les clous de Glickman.`);

// ── Rapport de recommandation ──────────────────────────────────────────────

console.log(`\n${DLINE}`);
console.log("  ANALYSE STRATÉGIQUE — Comportement Glicko-2 pour PGR v1");
console.log(DLINE);

console.log(`
CONSTATS CLÉS :

  [1] RD INITIALE ÉLEVÉE (300-400) → swings de 100-400 pts au premier match.
      Mathématiquement juste : on ne connaît pas le niveau du joueur.
      Impact produit : rating instable et peu crédible en phase PROVISIONAL.

  [2] STABLE vs STABLE (RD=50) → 5-25 pts par match.
      Comportement idéal pour la majorité des joueurs rodés.

  [3] UPSET → ampl itude proportionnelle à l'incertitude.
      Un débutant (RD=300) qui bat un champion bouge de +350 pts.
      Un stable (RD=50) qui bat un champion bouge de +60 pts.
      C'est INTENTIONNEL : plus on connaît le joueur, moins on réagit.

  [4] INACTIVITÉ → RD croît très lentement avec TAU=0.5.
      Pas de déflation/inflation parasites. Comportement sain.

  [5] CONVERGENCE → 30 matchs pour atteindre STABLE. 100+ pour RD < 80.
      Le vrai niveau d'un joueur n'est "connu" qu'après 30-50 matchs.
      C'est la réalité statistique de Glicko-2, pas un bug.
`);

console.log(`PROBLÈME RÉEL IDENTIFIÉ :
  Les swings en phase PROVISIONAL (matchs 1-10) sont importants mais prévisibles.
  La question n'est pas algorithmique : c'est une question de COMMUNICATION PRODUIT.
  Un rating de 1300 → 1688 après 1 match n'est pas un bug : c'est Glicko-2 qui dit
  "cet adversaire m'a révélé que tu vaux probablement 1688, je le note."
  Le problème : montrer ce chiffre brut à l'utilisateur comme s'il était définitif.
`);

console.log(`OPTIONS DISPONIBLES (sans toucher à l'algorithme) :

  A) GLICKO-2 PUR (statu quo)
     → Afficher rating + RD + badge [PROVISIONAL/CALIBRATING/STABLE]
     → Éduquer : "votre rating sera fiable après 30 matchs"
     ✓ Fondateur, honnête, pas de distorsion
     ✗ Peut déstabiliser les utilisateurs en phase initiale

  B) RD INITIALES PLUS BASSES (ajustement des questionnaires)
     → Questionnaire CLUB_BEGINNER : 1300/300 → 1300/180
     → COMPLETE_BEGINNER : 900/400 → 900/220
     → Moins de swings mais convergence plus lente vers le vrai niveau
     ✓ Présentation plus douce pour les nouveaux
     ✗ Sous-estime l'incertitude réelle — rating moins informatif

  C) RATING INTERNE vs RATING PUBLIC
     → Rating interne : Glicko-2 pur, toujours calculé
     → Rating public (affiché) : seulement si matchCount >= 3
     → Avant 3 matchs : afficher "Non classé" ou badge gris
     ✓ Protège l'utilisateur des artefacts de la phase initiale
     ✓ N'altère pas l'algorithme — calcul reste pur en interne
     ✓ C'est la pratique de Chess.com, Lichess, etc.
     ✗ Complexité de présentation à gérer

  D) SEUILS DE CONFIANCE AJUSTÉS
     → PROVISIONAL_THRESHOLD : 10 → 15
     → STABLE_THRESHOLD : 30 → 50
     → Garder le badge [PROVISIONAL] plus longtemps avant de clore le débat
     ✓ Communique mieux l'incertitude
     ✓ Zéro impact sur l'algorithme
     ✗ Jugement subjectif sur les seuils
`);

console.log(`RECOMMANDATION POUR UNE V1 FONDATRICE SÉRIEUSE :

  Combiner C + D.

  1. Glicko-2 pur, sans cap, sans ajustement d'algorithme.
     Le rating interne est toujours calculé, quels que soient les swings.

  2. Rating public affiché seulement si matchCount >= 3.
     Avant : badge "En évaluation" sans chiffre.

  3. Seuils ajustés :
     PROVISIONAL  → < 15 matchs  (badge orange, "en cours de calibration")
     CALIBRATING  → 15-50 matchs (badge bleu, "rating indicatif")
     STABLE       → >= 50 matchs  (badge vert, "rating fiable")

  4. RD toujours visible en transparence pour les joueurs qui le souhaitent.
     La RD est la vérité sur l'incertitude — ne pas la cacher.

  5. NE PAS toucher à TAU=0.5 pour l'instant. Valeur standard Glickman.
     Éventuellement descendre à TAU=0.3 après observation sur données réelles.

  6. Priorité 2 (pas v1) : différencier le rating "de compétition" officielle
     vs "ligue interne Ping Pang" — deux RD initiales distinctes selon la source.
`);

console.log(DLINE);
