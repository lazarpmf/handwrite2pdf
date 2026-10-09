"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  licenseKey: string;
  isPro: boolean;
  onSaveLicense: (key: string) => Promise<{ ok: boolean; message: string }>;
  onClearLicense: () => void;
};

export function SettingsPanel({
  open,
  onClose,
  licenseKey,
  isPro,
  onSaveLicense,
  onClearLicense,
}: Props) {
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
          <h3>Prepoznavanje</h3>
          <p className="hint">
            Rukopis ide kroz lokalni Pix2Text (besplatna Python biblioteka).
            Nema API ključa i slike ne idu na Gemini.
          </p>
        </section>

        <section className="modal-section">
          <h3>Pro licenca {isPro ? "· aktivna" : ""}</h3>
          <p className="hint">
            Pro skida limit od 3 stranice i uklanja watermark na PDF-u.
            Konverzija i dalje radi lokalno, bez troška API-ja.
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
