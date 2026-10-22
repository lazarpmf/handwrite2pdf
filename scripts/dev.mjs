import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const isWin = process.platform === "win32";
const python = path.join(".venv", isWin ? "Scripts/python.exe" : "bin/python");

function sh(command) {
  execSync(command, { stdio: "inherit", shell: true });
}

if (!existsSync(python)) {
  console.log("Prvi put: instaliram Pix2Text. Ovo može potrajati nekoliko minuta.");
  const systemPython = isWin ? "py -3" : "python3";
  try {
    sh(`${systemPython} -m venv .venv`);
    sh(`"${python}" -m pip install -U pip`);
    sh(
      `"${python}" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu`,
    );
    sh(`"${python}" -m pip install -r ocr/requirements.txt`);
  } catch {
    console.error("Treba Python 3.10 ili noviji. Instaliraj ga, pa ponovo pokreni npm run dev.");
    process.exit(1);
  }
}

console.log("Pix2Text sluša na 127.0.0.1:8765. Stranicu otvori na http://localhost:3000");

const ocr = spawn(python, ["ocr/server.py"], { stdio: "inherit" });
const web = spawn(isWin ? "npx.cmd" : "npx", ["next", "dev"], {
  stdio: "inherit",
  shell: isWin,
});

function stop() {
  ocr.kill();
  web.kill();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", (code) => {
  ocr.kill();
  process.exit(code ?? 0);
});
