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

1. Postavi `PRO_LICENSE_SEED`.
2. `npm run gen-license`
3. Prodaj Pro preko `NEXT_PUBLIC_PAYMENT_LINK`.
4. Kupac unese ključ u **Postavke**.

**Free:** do 3 stranice, watermark na PDF.  
**Pro:** neograničeno, bez watermarka.
