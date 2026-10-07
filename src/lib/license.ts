/**
 * Pro license keys: INKTEX-XXXXXXXX
 * Checksum = first 8 hex chars of SHA-256("inktex:" + payload + ":" + seed)
 * Seed defaults for local use; set PRO_LICENSE_SEED in production.
 */

const DEFAULT_SEED = "inktex-dev-seed-change-me";

export function getLicenseSeed(): string {
  return process.env.PRO_LICENSE_SEED || DEFAULT_SEED;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateLicense(payload = "pro"): Promise<string> {
  const seed = getLicenseSeed();
  const digest = await sha256Hex(`inktex:${payload}:${seed}`);
  return `INKTEX-${digest.slice(0, 8).toUpperCase()}`;
}

export async function validateLicense(key: string): Promise<boolean> {
  const normalized = key.trim().toUpperCase();
  if (!/^INKTEX-[0-9A-F]{8}$/.test(normalized)) return false;
  for (const payload of ["pro", "lifetime", "early"]) {
    const candidate = await generateLicense(payload);
    if (normalized === candidate) return true;
  }
  return false;
}
