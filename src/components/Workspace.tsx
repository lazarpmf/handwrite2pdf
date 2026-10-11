"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { SettingsPanel } from "@/components/SettingsPanel";
import {
  compressImageFile,
  fileToBase64Payload,
  type PageImage,
} from "@/lib/images";
import {
  copyText,
  downloadText,
  exportPreviewToPdf,
  openOverleaf,
} from "@/lib/export";
import { latexToPreviewHtml } from "@/lib/latex-preview";
import { FREE_PAGE_LIMIT } from "@/lib/constants";
import {
  clearStoredLicense,
  getStoredLatex,
  getStoredLicense,
  setStoredLatex,
  setStoredLicense,
} from "@/lib/storage";

type Tab = "notebook" | "latex" | "pdf";

function formatUntil(iso: string): string {
  return new Date(iso).toLocaleString("sr-Latn", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Workspace() {
  const [tab, setTab] = useState<Tab>("notebook");
  const [pages, setPages] = useState<PageImage[]>([]);
  const [latex, setLatex] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const license = getStoredLicense();
    const draft = getStoredLatex();
    setLicenseKey(license);
    if (draft) setLatex(draft);
    setHydrated(true);
    if (license) {
      void fetch("/api/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: license }),
      })
        .then((r) => r.json())
        .then((d: { valid?: boolean; expiresAt?: string | null }) => {
          setIsPro(Boolean(d.valid));
          setProUntil(d.expiresAt ? formatUntil(d.expiresAt) : null);
        })
        .catch(() => setIsPro(false));
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setStoredLatex(latex);
  }, [latex, hydrated]);

  const previewHtml = useMemo(() => latexToPreviewHtml(latex), [latex]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: PageImage[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      const compressed = await compressImageFile(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
        mimeType: compressed.type,
      });
    }
    setPages((prev) => [...prev, ...next]);
    setError("");
  }

  function removePage(id: string) {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function movePage(id: string, dir: -1 | 1) {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
      return copy;
    });
  }

  async function convert() {
    setError("");
    setStatus("");
    if (!pages.length) {
      setError("Dodaj barem jednu fotografiju iz sveske.");
      return;
    }
    if (!isPro && pages.length > FREE_PAGE_LIMIT) {
      setError(
        `Besplatno: max ${FREE_PAGE_LIMIT} stranice. Kupi Pro ili ukloni višak.`,
      );
      return;
    }

    setBusy(true);
    setStatus(
      "Čitam rukopis…",
    );
    try {
      const images = await Promise.all(
        pages.map((p) => fileToBase64Payload(p.file)),
      );
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(licenseKey ? { "x-inktex-license": licenseKey } : {}),
        },
        body: JSON.stringify({ images }),
      });
      const data = (await res.json()) as {
        latex?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Konverzija nije uspjela.");
      }
      setLatex(data.latex || "");
      setTab("latex");
      setStatus("Gotovo — pregledaj LaTeX, pa eksportuj PDF.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška pri konverziji.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">InkTeX</p>
          <p className="tagline">Sveska → LaTeX → PDF</p>
        </div>
        <div className="top-actions">
          <span className={`pill ${isPro ? "pill-pro" : "pill-free"}`}>
            {isPro ? "Pro" : "Free"}
          </span>
          <a className="ghost-btn" href="/pricing">
            Unovči / Pro
          </a>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Postavke
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Workflow">
        {(
          [
            ["notebook", "Sveska"],
            ["latex", "LaTeX"],
            ["pdf", "PDF"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {(error || status) && (
        <div className={`banner ${error ? "banner-error" : "banner-ok"}`}>
          {error || status}
        </div>
      )}

      {tab === "notebook" && (
        <section className="panel">
          <div className="panel-intro">
            <h1>Fotografiraj stranice</h1>
            <p>
              Jedna ili više stranica iz sveske. Redoslijed na listi je
              redoslijed u dokumentu.
              {!isPro && ` Free limit: ${FREE_PAGE_LIMIT} stranice.`}
            </p>
          </div>

          <div className="capture-row">
            <button
              type="button"
              className="primary-btn"
              onClick={() => cameraRef.current?.click()}
            >
              Kamera
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => fileRef.current?.click()}
            >
              Iz galerije
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={busy || !pages.length}
              onClick={() => void convert()}
            >
              {busy ? "Konvertujem…" : "Pretvori u LaTeX"}
            </button>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {pages.length === 0 ? (
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles(e.dataTransfer.files);
              }}
            >
              <p>Prevuci fotografije ovdje ili koristi dugmad iznad.</p>
            </div>
          ) : (
            <ul className="page-grid">
              {pages.map((page, index) => (
                <li key={page.id} className="page-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.previewUrl} alt={`Stranica ${index + 1}`} />
                  <div className="page-meta">
                    <span>#{index + 1}</span>
                    <div className="page-ops">
                      <button type="button" onClick={() => movePage(page.id, -1)}>
                        ↑
                      </button>
                      <button type="button" onClick={() => movePage(page.id, 1)}>
                        ↓
                      </button>
                      <button type="button" onClick={() => removePage(page.id)}>
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "latex" && (
        <section className="panel split">
          <div className="split-pane">
            <div className="pane-head">
              <h2>LaTeX izvor</h2>
              <div className="btn-row">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!latex}
                  onClick={async () => {
                    await copyText(latex);
                    setStatus("LaTeX kopiran u clipboard.");
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!latex}
                  onClick={() => {
                    downloadText("notes.tex", latex, "application/x-tex");
                    setStatus("Preuzet notes.tex");
                  }}
                >
                  .tex
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!latex}
                  onClick={() => {
                    openOverleaf(latex);
                    setStatus(
                      "LaTeX kopiran — zalijepi u novi Overleaf projekat.",
                    );
                  }}
                >
                  Overleaf
                </button>
              </div>
            </div>
            <textarea
              className="latex-editor"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="Ovdje će se pojaviti generisani LaTeX…"
              spellCheck={false}
            />
          </div>
          <div className="split-pane preview-pane">
            <div className="pane-head">
              <h2>Pregled</h2>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setTab("pdf")}
              >
                Otvori PDF tab
              </button>
            </div>
            <div
              className="doc-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </section>
      )}

      {tab === "pdf" && (
        <section className="panel">
          <div className="panel-intro">
            <h1>PDF eksport</h1>
            <p>
              Pregled je renderovan iz LaTeX-a (KaTeX). Za puni TeX compile
              koristi Overleaf. {!isPro && "Free PDF ima mali watermark."}
            </p>
          </div>
          <div className="capture-row">
            <button
              type="button"
              className="primary-btn"
              disabled={!latex}
              onClick={async () => {
                if (!previewRef.current) return;
                setBusy(true);
                try {
                  await exportPreviewToPdf(previewRef.current, {
                    filename: "inktex-notes.pdf",
                    watermark: isPro ? undefined : "Created with InkTeX (Free)",
                  });
                  setStatus("PDF sačuvan.");
                } catch {
                  setError("PDF eksport nije uspio.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Preuzmi PDF
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!latex}
              onClick={() => window.print()}
            >
              Štampaj / Save as PDF
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!latex}
              onClick={() => {
                downloadText("notes.tex", latex, "application/x-tex");
              }}
            >
              Preuzmi .tex
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!latex}
              onClick={() => openOverleaf(latex)}
            >
              Overleaf
            </button>
          </div>
          <div className="pdf-stage">
            <div ref={previewRef} className="doc-preview print-sheet">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </section>
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        licenseKey={licenseKey}
        isPro={isPro}
        proUntil={proUntil}
        onSaveLicense={async (key) => {
          const res = await fetch("/api/license/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          const data = (await res.json()) as {
            valid?: boolean;
            expiresAt?: string | null;
            reason?: string;
          };
          if (data.valid) {
            setLicenseKey(key.trim().toUpperCase());
            setStoredLicense(key);
            setIsPro(true);
            const until = data.expiresAt ? formatUntil(data.expiresAt) : null;
            setProUntil(until);
            return {
              ok: true,
              message: until ? `Pro aktivan do ${until}.` : "Pro aktiviran. Hvala!",
            };
          }
          if (data.reason === "expired") {
            return { ok: false, message: "Kod je istekao. Kupi novu sedmicu." };
          }
          return { ok: false, message: "Neispravan licencni ključ." };
        }}
        onClearLicense={() => {
          clearStoredLicense();
          setLicenseKey("");
          setIsPro(false);
          setProUntil(null);
        }}
      />
    </div>
  );
}
