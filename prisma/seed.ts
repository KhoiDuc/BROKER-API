import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { savePortfolio } from "../src/lib/portfolio-service";
import type { BrokerPortfolioJson } from "../src/lib/types";

async function main() {
  const seedPath = resolve(process.cwd(), "seed", "portfolio.json");
  const raw = readFileSync(seedPath, "utf8");
  const portfolio = JSON.parse(raw) as BrokerPortfolioJson;
  const saved = await savePortfolio(portfolio);
  const count = (saved.positions?.length ?? 0) + (saved.closedPositions?.length ?? 0);
  console.log(`Seeded ${count} positions from ${seedPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
