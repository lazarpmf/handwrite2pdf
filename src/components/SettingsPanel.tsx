"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  licenseKey: string;
  isPro: boolean;
  onSaveLicense: (key: string) => Promise<{ ok: boolean; message: string }>;
  onClearLicense: () => void;
};

export function SettingsPanel({
  open,
  onClose,
  apiKey,
  onSaveApiKey,
  licenseKey,
  isPro,
  onSaveLicense,
  onClearLicense,
}: Props) {
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftLicense, setDraftLicense] = useState(licenseKey);
  const [licenseMsg, setLicenseMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <h2>Postavke</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Zatvori
          </button>
        </div>

        <section className="modal-section">
          <h3>Gemini API ključ (besplatno)</h3>
          <p className="hint">
            Ključ ostaje u tvom browseru. App ga šalje samo Google Gemini API-ju
            radi konverzije.{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Uzmi besplatni ključ
            </a>
          </p>
          <input
            type="password"
            className="field"
            placeholder="AIza..."
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              onSaveApiKey(draftKey);
              setLicenseMsg("API ključ sačuvan.");
            }}
          >
            Sačuvaj API ključ
          </button>
        </section>

        <section className="modal-section">
          <h3>Pro licenca {isPro ? "· aktivna" : ""}</h3>
          <p className="hint">
            Pro skida limit od 3 stranice, uklanja watermark na PDF-u i
            otključava neograničene konverzije. I dalje koristiš svoj Gemini
            ključ — tebi hostovanje ostaje besplatno.
          </p>
          <input
            type="text"
            className="field"
            placeholder="INKTEX-XXXXXXXX"
            value={draftLicense}
            onChange={(e) => setDraftLicense(e.target.value)}
            autoComplete="off"
          />
          <div className="btn-row">
            <button
              type="button"
              className="primary-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await onSaveLicense(draftLicense);
                setLicenseMsg(res.message);
                setBusy(false);
              }}
            >
              Aktiviraj
            </button>
            {isPro && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  onClearLicense();
                  setDraftLicense("");
                  setLicenseMsg("Pro deaktiviran.");
                }}
              >
                Ukloni
              </button>
            )}
          </div>
          {licenseMsg && <p className="status-line">{licenseMsg}</p>}
        </section>
      </div>
    </div>
  );
}
