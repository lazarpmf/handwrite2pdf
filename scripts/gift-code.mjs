/**
 * Invent a permanent free Pro code and give it to someone.
 * Usage: npm run gift -- DRAGANA-TAJNA
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const raw = process.argv.slice(2).join("-");
const code = raw.trim().toUpperCase().replace(/\s+/g, "-");

if (!/^[A-Z0-9-]{6,40}$/.test(code)) {
  console.error("Kod treba 6–40 znakova: slova, brojevi i crtica.");
  console.error("Primjer: npm run gift -- DRAGANA-TAJNA");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "data", "licenses.json");

let db = { passes: [] };
try {
  db = JSON.parse(await readFile(dbPath, "utf8"));
  if (!Array.isArray(db.passes)) db.passes = [];
} catch {
  db = { passes: [] };
}

const existing = db.passes.find((pass) => pass.code === code);
if (existing && !existing.revoked) {
  console.log(`Kod već postoji i radi: ${code}`);
  process.exit(0);
}

if (existing) {
  existing.revoked = false;
  existing.kind = "gift";
  existing.expiresAt = null;
} else {
  db.passes.push({
    code,
    email: "",
    paymentId: `gift:${code}`,
    amount: 0,
    currency: "USD",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    revoked: false,
    kind: "gift",
  });
}

await mkdir(path.dirname(dbPath), { recursive: true });
const tmp = `${dbPath}.${process.pid}.tmp`;
await writeFile(tmp, JSON.stringify(db, null, 2));
await rename(tmp, dbPath);

console.log(`Poklon kod: ${code}`);
console.log("Nema roka. Osoba ga nalijepi u Postavke → Pro licenca.");
