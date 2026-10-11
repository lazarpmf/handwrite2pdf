import { NextResponse } from "next/server";
import { FREE_PAGE_LIMIT } from "@/lib/constants";
import { ConvertFailure, pagesToLatex } from "@/lib/gemini";
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

    let total = 0;
    for (const img of images) {
      if (!img?.data || !img?.mimeType?.startsWith("image/")) {
        return NextResponse.json(
          { error: "Neispravan format slike." },
          { status: 400 },
        );
      }
      const payload = img.data.replace(/^data:[^;]+;base64,/, "");
      total += payload.length;
      if (payload.length > 6_000_000) {
        return NextResponse.json(
          { error: "Slika je prevelika. Približi se stranici i snimi ponovo." },
          { status: 400 },
        );
      }
    }
    if (total > 5_500_000) {
      return NextResponse.json(
        { error: "Previše stranica odjednom. Pošalji ih u manjim grupama." },
        { status: 400 },
      );
    }

    const latex = await pagesToLatex(images);
    return NextResponse.json({ latex, isPro, engine: "gemini" });
  } catch (err) {
    if (err instanceof ConvertFailure) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("convert error", err);
    return NextResponse.json(
      { error: "Interna greška pri konverziji." },
      { status: 500 },
    );
  }
}
