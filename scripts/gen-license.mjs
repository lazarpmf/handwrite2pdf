/**
 * Generate Pro license keys to sell.
 * Usage: PRO_LICENSE_SEED=your-secret npm run gen-license
 * Must use the SAME seed as the deployed PRO_LICENSE_SEED.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocalSeed() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return null;
  const match = readFileSync(path, "utf8").match(/^PRO_LICENSE_SEED=(.*)$/m);
  return match?.[1]?.trim() || null;
}

const seed =
  process.env.PRO_LICENSE_SEED ||
  loadEnvLocalSeed() ||
  "inktex-dev-seed-change-me";
const payload = process.argv[2] || "pro";
const digest = createHash("sha256")
  .update(`inktex:${payload}:${seed}`)
  .digest("hex");
const key = `INKTEX-${digest.slice(0, 8).toUpperCase()}`;

console.log(`Seed payload: ${payload}`);
console.log(`License key:  ${key}`);
console.log("");
console.log("Send this key to the buyer. They paste it in Postavke → Pro licenca.");
