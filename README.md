# InkTeX

Fotografisi stranicu sveske → **Pix2Text** na tvom računaru pretvori u **LaTeX** → eksportuj **PDF**.

## Na svom računaru

Treba Node.js i Python 3.10 ili noviji. Na Windowsu, pri instalaciji Pythona uključi "Add python.exe to PATH".

```bash
git clone https://github.com/lazarpmf/handwrite2pdf
cd handwrite2pdf
npm install
npm run dev
```

Otvori adresu koju terminal ispiše, obično http://localhost:3000.

1. **Fotografisi stranicu sveske** ili **Iz galerije**.
2. **Pretvori u LaTeX**. Prvi put skida modele (nekoliko stotina MB) i može trajati nekoliko minuta. Sljedeći put je brže.
3. Tab **PDF** → **Preuzmi PDF**.

Zaustavi program u terminalu sa Ctrl+C.

Sajt na Netlifyju i dalje koristi Gemini. Lokalno dugme ide kroz Pix2Text.

## Netlify

1. Besplatan ključ: [Google AI Studio](https://aistudio.google.com/apikey).
2. Site configuration → Environment variables → `GEMINI_API_KEY`.
   Nemoj `NEXT_PUBLIC_` — ključ ostaje na serveru.
3. Model je `gemini-3.5-flash-lite`. Mijenja se samo ako staviš `GEMINI_MODEL`.
4. Ponovo objavi sajt. Poslije toga „Pretvori u LaTeX” radi u browseru.

Besplatni nivo ima dnevni limit. Kad se napuni, dugme javi da se proba kasnije.

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
