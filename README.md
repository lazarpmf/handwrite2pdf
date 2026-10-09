# InkTeX

Fotografiraj stranice iz sveske → **Pix2Text** pretvori u **LaTeX** → eksportuj **PDF** / `.tex` / Overleaf.

Prepoznavanje je lokalno. Nema Gemini ključa i slike ne idu u cloud.

## Pokretanje

```bash
cd inktex
npm install
python3 -m venv .venv
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r ocr/requirements.txt
cp .env.example .env.local
```

Dva terminala:

```bash
npm run ocr
npm run dev
```

Prva konverzija skida Pix2Text modele (nekoliko stotina MB) u `~/.pix2text`.

## Zašto je tebi besplatno

- [Pix2Text](https://github.com/breezedeus/Pix2Text) je open-source (tekst, layout, formule → Markdown/LaTeX).
- Radi na tvom računaru. Nema naplate po slici.

Kvalitet je dobar na urednom rukopisu i štampi. Vrlo neuredan rukopis i dalje može promašiti formule — tu su cloud modeli jači, ali nisu besplatni bez limita.

## Kako da unovčiš

Buy Me a Coffee šalje webhook kad neko uplati najmanje `BMC_MIN_AMOUNT` (podrazumijevano 3 $). App napravi jedinstveni kod, važi `LICENSE_DAYS` dana (podrazumijevano 7), i pošalje ga na mejl kupca.

1. Cijena kafe: 3 $.
2. Webhook URL: `https://tvoj-domen/api/webhooks/buymeacoffee`
3. Event: `donation.created` (i `donation.refunded` ako hoćeš da povrat novca ugasi kod).
4. `BMC_WEBHOOK_SECRET` = signing secret.
5. Mejl: `RESEND_API_KEY` ili SMTP, plus `MAIL_FROM`.
6. `NEXT_PUBLIC_BMC_URL` = link ka tvom profilu.

Kodovi se čuvaju u `data/licenses.json` na disku servera. App mora da radi na mašini sa stalnim diskom, istoj na kojoj prima webhook.

Ručni trajni ključ i dalje postoji: `npm run gen-license`.

**Free:** do 3 stranice, watermark na PDF.  
**Pro sedmica:** neograničeno, bez watermarka, 7 dana.
