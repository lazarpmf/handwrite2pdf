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

Jedan terminal:

```bash
npm run dev
```

Prvi put sam instalira Pix2Text i pokrene čitanje rukopisa. Drugi terminal nije potreban.

Prva konverzija skida Pix2Text modele (nekoliko stotina MB) u `~/.pix2text`.

## Zašto je tebi besplatno

- [Pix2Text](https://github.com/breezedeus/Pix2Text) je open-source (tekst, layout, formule → Markdown/LaTeX).
- Radi na tvom računaru. Nema naplate po slici.

Kvalitet je dobar na urednom rukopisu i štampi. Vrlo neuredan rukopis i dalje može promašiti formule — tu su cloud modeli jači, ali nisu besplatni bez limita.

## Kako da unovčiš

Buy Me a Coffee šalje webhook kad neko plati.

- Od `BMC_MIN_AMOUNT` (3 $) do ispod mjesečne cijene: kod važi `LICENSE_DAYS` (7) dana.
- Od `BMC_MONTH_AMOUNT` (8 $), ili membership: kod važi `LICENSE_MONTH_DAYS` (30) dana. Obnova membershipa produžava isti kod.
- Poklon, bez naplate i bez roka: `npm run gift -- DRAGANA-TAJNA`

1. Cijena kafe: 3 $.
2. Webhook URL: `https://tvoj-domen/api/webhooks/buymeacoffee`
3. Event: `donation.created` (i `donation.refunded` ako hoćeš da povrat novca ugasi kod).
4. `BMC_WEBHOOK_SECRET` = signing secret.
5. Mejl: `RESEND_API_KEY` ili SMTP, plus `MAIL_FROM`.
6. `NEXT_PUBLIC_BMC_URL` = link ka tvom profilu.

Kodovi se čuvaju u `data/licenses.json` na disku servera. App mora da radi na mašini sa stalnim diskom, istoj na kojoj prima webhook.

Ručni trajni ključ i dalje postoji: `npm run gen-license`.

**Free:** do 3 stranice, watermark na PDF.  
**Sedmica:** neograničeno, bez watermarka, 7 dana.  
**Mjesec:** neograničeno, bez watermarka, 30 dana.  
**Poklon kod:** neograničeno, bez roka.
