import { NextResponse } from "next/server";
import { FREE_PAGE_LIMIT } from "@/lib/constants";
import { resolveLicense } from "@/lib/passes";

type ImagePayload = {
  mimeType: string;
  data: string;
};

export async function POST(request: Request) {
  try {
    const licenseHeader = request.headers.get("x-inktex-license")?.trim() || "";
    const isPro = licenseHeader ? (await resolveLicense(licenseHeader)).valid : false;

    const body = (await request.json()) as {
      images?: ImagePayload[];
    };

    const images = body.images || [];
    if (!images.length) {
      return NextResponse.json(
        { error: "Dodaj barem jednu fotografiju stranice." },
        { status: 400 },
      );
    }

    if (!isPro && images.length > FREE_PAGE_LIMIT) {
      return NextResponse.json(
        {
          error: `Besplatna verzija podržava do ${FREE_PAGE_LIMIT} stranice. Otključaj Pro za neograničeno.`,
          code: "FREE_LIMIT",
        },
        { status: 403 },
      );
    }

    for (const img of images) {
      if (!img?.data || !img?.mimeType?.startsWith("image/")) {
        return NextResponse.json(
          { error: "Neispravan format slike." },
          { status: 400 },
        );
      }
      if (img.data.length > 16_000_000) {
        return NextResponse.json(
          { error: "Slika je prevelika. Kompresuj ili snimi ponovo." },
          { status: 400 },
        );
      }
    }

    const ocrUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8765";
    let ocrRes: Response;
    try {
      ocrRes = await fetch(`${ocrUrl}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({
            mimeType: img.mimeType,
            data: img.data.replace(/^data:[^;]+;base64,/, ""),
          })),
        }),
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "OCR servis nije pokrenut. U drugom terminalu: npm run ocr",
        },
        { status: 503 },
      );
    }

    const payload = (await ocrRes.json()) as {
      latex?: string;
      detail?: string;
      error?: string;
    };

    if (!ocrRes.ok) {
      return NextResponse.json(
        { error: payload.detail || payload.error || "Pix2Text greška." },
        { status: 502 },
      );
    }

    const latex = payload.latex?.trim() || "";
    if (!latex) {
      return NextResponse.json(
        { error: "Pix2Text nije vratio tekst. Pokušaj jasniju fotografiju." },
        { status: 502 },
      );
    }

    return NextResponse.json({ latex, isPro, engine: "pix2text" });
  } catch (err) {
    console.error("convert error", err);
    return NextResponse.json(
      { error: "Interna greška pri konverziji." },
      { status: 500 },
    );
  }
}
