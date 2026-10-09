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
  expiresAt: string | null;
  revoked: boolean;
  kind: "paid" | "gift";
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

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function licenseDays(): number {
  return positiveNumber(process.env.LICENSE_DAYS, 7);
}

export function monthDays(): number {
  return positiveNumber(process.env.LICENSE_MONTH_DAYS, 30);
}

export function minPaymentAmount(): number {
  return positiveNumber(process.env.BMC_MIN_AMOUNT, 3);
}

export function monthPaymentAmount(): number {
  return positiveNumber(process.env.BMC_MONTH_AMOUNT, 8);
}

const MONTH_EVENTS = new Set([
  "membership.started",
  "membership.updated",
  "recurring_donation.started",
  "recurring_donation.updated",
]);

const RENEW_EVENTS = new Set(["membership.updated", "recurring_donation.updated"]);

export function accessForPayment(type: string, amount: number): { days: number; renew: boolean } | null {
  if (MONTH_EVENTS.has(type)) {
    return { days: monthDays(), renew: RENEW_EVENTS.has(type) };
  }
  if (type !== "donation.created" && type !== "extra_purchase.created") return null;
  if (amount >= monthPaymentAmount()) return { days: monthDays(), renew: false };
  if (amount >= minPaymentAmount()) return { days: licenseDays(), renew: false };
  return null;
}

function newCode(): string {
  return `INKTEX-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function issuePass(input: {
  email: string;
  paymentId: string;
  amount: number;
  currency: string;
  days: number;
  renew?: boolean;
}): Promise<Pass> {
  return withLock(async () => {
    const db = await readDb();
    const existing = db.passes.find((pass) => pass.paymentId === input.paymentId);
    if (existing) {
      if (input.renew) {
        const current = existing.expiresAt ? Date.parse(existing.expiresAt) : Date.now();
        const base = Math.max(Date.now(), current);
        existing.expiresAt = new Date(base + input.days * 24 * 60 * 60 * 1000).toISOString();
        existing.revoked = false;
        existing.amount = input.amount;
        await writeDb(db);
      }
      return existing;
    }

    const createdAt = new Date();
    const pass: Pass = {
      code: newCode(),
      email: input.email,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency || "USD",
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + input.days * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
      kind: "paid",
    };
    db.passes.push(pass);
    await writeDb(db);
    return pass;
  });
}

export function normalizeGiftCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

function envGiftCodes(): string[] {
  return (process.env.GIFT_CODES || "")
    .split(",")
    .map((code) => normalizeGiftCode(code))
    .filter(Boolean);
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
  kind: "lifetime" | "pass" | "gift" | "none";
  expiresAt: string | null;
  reason?: "expired" | "revoked" | "unknown";
};

export async function resolveLicense(key: string): Promise<LicenseStatus> {
  const normalized = key.trim().toUpperCase();
  if (await validateLicense(normalized)) {
    return { valid: true, kind: "lifetime", expiresAt: null };
  }
  if (envGiftCodes().includes(normalized)) {
    return { valid: true, kind: "gift", expiresAt: null };
  }

  const db = await readDb();
  const pass = db.passes.find((item) => item.code === normalized);
  if (!pass) {
    return { valid: false, kind: "none", expiresAt: null, reason: "unknown" };
  }
  if (pass.revoked) {
    return { valid: false, kind: pass.kind === "gift" ? "gift" : "pass", expiresAt: pass.expiresAt, reason: "revoked" };
  }
  if (pass.kind === "gift" || !pass.expiresAt) {
    return { valid: true, kind: "gift", expiresAt: null };
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
