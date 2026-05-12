import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type PgrDataSource } from "@prisma/client";
import { parseNormalizedPlayersCsv } from "../src/csv-import.parser.js";
import { ImportsService } from "../src/imports.service.js";

interface CliArgs {
  file?: string;
  confirm: boolean;
  dryRun: boolean;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    printUsage();
    process.exit(1);
  }

  const filePath = resolveInputFile(args.file);
  const csv = await readFile(filePath, "utf8");
  const players = parseNormalizedPlayersCsv(csv);
  const source = deriveSingleSource(players.map((player) => player.source));

  printSummary(filePath, source, players.length);

  if (args.dryRun) {
    console.log("Dry run only. No database import was executed.");
    return;
  }

  if (!args.confirm) {
    const accepted = await askForConfirmation();
    if (!accepted) {
      console.log("Import cancelled. No database import was executed.");
      return;
    }
  }

  const prisma = new PrismaClient();
  try {
    const service = new ImportsService(prisma);
    const result = await service.importNormalizedPlayers({
      source,
      fileName: basename(filePath),
      players,
    });

    console.log("Import completed.");
    console.log(`Source import: ${result.import.id}`);
    console.log(`Players created: ${result.createdPlayers}`);
    console.log(`Players reused: ${result.existingPlayers}`);
    console.log(`Rankings created: ${result.createdRankings}`);
    console.log(`Initial snapshots created: ${result.createdSnapshots}`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { confirm: false, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--file") {
      args.file = argv[++i];
      continue;
    }
    if (arg.startsWith("--file=")) {
      args.file = arg.slice("--file=".length);
      continue;
    }
    if (arg === "--confirm") {
      args.confirm = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function resolveInputFile(input: string): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    resolve(process.cwd(), input),
    resolve(packageRoot, input),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`CSV file not found: ${input}`);
  }
  return found;
}

function deriveSingleSource(
  sources: Array<PgrDataSource | null | undefined>
): PgrDataSource {
  const uniqueSources = [...new Set(sources.filter(Boolean))] as PgrDataSource[];
  if (uniqueSources.length !== 1) {
    throw new Error(
      `CSV import expects exactly one source, found: ${
        uniqueSources.join(", ") || "none"
      }`
    );
  }
  return uniqueSources[0];
}

function printSummary(filePath: string, source: PgrDataSource, playerCount: number) {
  console.log("CSV import preview");
  console.log(`File: ${filePath}`);
  console.log(`Source: ${source}`);
  console.log(`Players: ${playerCount}`);
}

async function askForConfirmation(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      'Type "IMPORT" to write these rows to PGR tables: '
    );
    return answer.trim() === "IMPORT";
  } finally {
    rl.close();
  }
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run import:csv -- --file examples/top-players.csv",
      "",
      "Options:",
      "  --file <path>   CSV file to import",
      "  --dry-run       Parse and preview without writing to the database",
      "  --confirm       Skip the interactive confirmation prompt",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
