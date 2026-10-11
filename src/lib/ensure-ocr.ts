import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const port = process.env.OCR_PORT || "8765";
const ocrUrl = process.env.OCR_SERVICE_URL || `http://127.0.0.1:${port}`;

let boot: Promise<void> | null = null;

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(`${ocrUrl}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function pythonPath(): Promise<string | null> {
  const candidates = [
    process.env.OCR_PYTHON,
    path.join(process.cwd(), ".venv", "bin", "python"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try the next interpreter
    }
  }
  return null;
}

function startProcess(python: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(python, ["ocr/server.py"], {
      cwd: process.cwd(),
      env: { ...process.env, OCR_PORT: port },
      detached: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.unref();
    setTimeout(resolve, 300);
  });
}

export async function ensureOcr(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.OCR_SERVICE_URL && !process.env.OCR_SERVICE_URL.includes("127.0.0.1") && !process.env.OCR_SERVICE_URL.includes("localhost")) {
    return { ok: true };
  }

  if (await isUp()) return { ok: true };

  if (process.env.NETLIFY || process.env.VERCEL) {
    return {
      ok: false,
      error:
        "Prepoznavanje rukopisa ne može da radi na Netlifyu. Na svom računaru otvori folder projekta i pokreni: npm run dev",
    };
  }

  const python = await pythonPath();
  if (!python) {
    return {
      ok: false,
      error:
        "Pix2Text još nije instaliran. U folderu projekta pokreni npm run dev i sačekaj prvu instalaciju, pa klikni ponovo.",
    };
  }

  if (!boot) {
    boot = startProcess(python).catch((error) => {
      boot = null;
      throw error;
    });
  }

  try {
    await boot;
  } catch {
    return { ok: false, error: "Program za čitanje rukopisa se nije pokrenuo." };
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isUp()) return { ok: true };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  boot = null;
  return {
    ok: false,
    error: "Čitanje rukopisa se još diže. Sačekaj pola minuta i klikni ponovo.",
  };
}

export function ocrConvertUrl(): string {
  return `${ocrUrl}/convert`;
}
