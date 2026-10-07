# InkTeX

Fotografiraj stranice iz sveske → AI pretvori u **LaTeX** → pregledaj i eksportuj **PDF** / `.tex` / Overleaf.

## Zašto je tebi besplatno

- Korisnici (i ti) unose **vlastiti Gemini API ključ** ([besplatni ključ](https://aistudio.google.com/apikey)).
- Hostovanje na Vercelu / sličnom može biti u free tieru.
- Ti **ne plaćaš** Gemini za tuđe korisnike.

## Kako da unovčiš

1. Postavi `PRO_LICENSE_SEED` u produkciji.
2. Generiši ključ:

```bash
PRO_LICENSE_SEED=tvoj-secret npm run gen-license
```

3. Prodaj Pro (Stripe Payment Link → `NEXT_PUBLIC_PAYMENT_LINK`) i pošalji kupcu ključ.
4. Kupac ga unese u **Postavke**.

**Free:** do 3 stranice, watermark na PDF.  
**Pro:** neograničeno, bez watermarka — i dalje BYOK.

## Pokretanje

```bash
cd inktex
npm install
cp .env.example .env.local
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000).

## Deploy

```bash
npm run build
```

Deploy folder `inktex` na Vercel. Obavezno postavi `PRO_LICENSE_SEED`.
