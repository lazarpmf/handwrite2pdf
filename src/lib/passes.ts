import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateLicense } from "@/lib/license";

export type Pass = {
  code: string;
  email: string;
  paymentId: string;
  amount: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
};

type Db = { passes: Pass[] };

const dbPath = path.join(process.cwd(), "data", "licenses.json");

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw) as Db;
    return { passes: Array.isArray(parsed.passes) ? parsed.passes : [] };
  } catch {
    return { passes: [] };
  }
}

async function writeDb(db: Db): Promise<void> {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, dbPath);
}

export function licenseDays(): number {
  const days = Number(process.env.LICENSE_DAYS || 7);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

export function minPaymentAmount(): number {
  const amount = Number(process.env.BMC_MIN_AMOUNT || 3);
  return Number.isFinite(amount) && amount > 0 ? amount : 3;
}

function newCode(): string {
  return `INKTEX-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function issuePass(input: {
  email: string;
  paymentId: string;
  amount: number;
  currency: string;
}): Promise<Pass> {
  return withLock(async () => {
    const db = await readDb();
    const existing = db.passes.find((pass) => pass.paymentId === input.paymentId);
    if (existing) return existing;

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + licenseDays() * 24 * 60 * 60 * 1000);
    const pass: Pass = {
      code: newCode(),
      email: input.email,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency || "USD",
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revoked: false,
    };
    db.passes.push(pass);
    await writeDb(db);
    return pass;
  });
}

export async function revokePass(paymentId: string): Promise<boolean> {
  return withLock(async () => {
    const db = await readDb();
    const pass = db.passes.find((item) => item.paymentId === paymentId);
    if (!pass) return false;
    pass.revoked = true;
    await writeDb(db);
    return true;
  });
}

export type LicenseStatus = {
  valid: boolean;
  kind: "lifetime" | "pass" | "none";
  expiresAt: string | null;
  reason?: "expired" | "revoked" | "unknown";
};

export async function resolveLicense(key: string): Promise<LicenseStatus> {
  const normalized = key.trim().toUpperCase();
  if (await validateLicense(normalized)) {
    return { valid: true, kind: "lifetime", expiresAt: null };
  }
  if (!/^INKTEX-[0-9A-F]{16}$/.test(normalized)) {
    return { valid: false, kind: "none", expiresAt: null, reason: "unknown" };
  }

  const db = await readDb();
  const pass = db.passes.find((item) => item.code === normalized);
  if (!pass) {
    return { valid: false, kind: "none", expiresAt: null, reason: "unknown" };
  }
  if (pass.revoked) {
    return { valid: false, kind: "pass", expiresAt: pass.expiresAt, reason: "revoked" };
  }
  if (Date.parse(pass.expiresAt) <= Date.now()) {
    return { valid: false, kind: "pass", expiresAt: pass.expiresAt, reason: "expired" };
  }
  return { valid: true, kind: "pass", expiresAt: pass.expiresAt };
}

export function verifyBmcSignature(rawBody: string, signature: string, secret: string): boolean {
  const received = signature.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
