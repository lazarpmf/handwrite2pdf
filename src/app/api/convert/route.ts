import { NextResponse } from "next/server";
import { FREE_PAGE_LIMIT } from "@/lib/constants";
import { validateLicense } from "@/lib/license";

type ImagePayload = {
  mimeType: string;
  data: string;
};

const SYSTEM_PROMPT = `You are an expert at reading handwritten STEM notes (mathematics, physics, CS theory) and converting them into clean, compilable LaTeX.

Rules:
- Output ONLY a complete LaTeX document. No markdown fences, no commentary.
- Start with \\documentclass{article}, include amsmath, amssymb, amsthm, geometry.
- Define theorem environments when useful (definition, theorem, lemma, proof, example).
- Preserve structure: titles, definitions, proofs, equations, lists.
- Use \\[ \\] or equation environments for displayed math; $ $ for inline.
- If multiple page images are provided, merge them into ONE coherent document in reading order.
- Fix obvious spelling only when unambiguous; keep mathematical meaning faithful to the handwriting.
- If something is illegible, insert \\textbf{[?}...{]} with your best guess and a short note.
- Language of the notes: keep the same language as the handwriting (often Serbian/Bosnian/Croatian or English).`;

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-gemini-api-key")?.trim() ||
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Nedostaje Gemini API ključ. Unesi svoj besplatni ključ u Postavkama.",
        },
        { status: 401 },
      );
    }

    const licenseHeader = request.headers.get("x-inktex-license")?.trim() || "";
    const isPro = licenseHeader ? await validateLicense(licenseHeader) : false;

    const body = (await request.json()) as {
      images?: ImagePayload[];
      extraInstructions?: string;
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
      // rough size guard (~12MB base64)
      if (img.data.length > 16_000_000) {
        return NextResponse.json(
          { error: "Slika je prevelika. Kompresuj ili snimi ponovo." },
          { status: 400 },
        );
      }
    }

    const parts: Array<Record<string, unknown>> = [
      {
        text:
          SYSTEM_PROMPT +
          (body.extraInstructions
            ? `\n\nAdditional user instructions:\n${body.extraInstructions}`
            : ""),
      },
    ];

    images.forEach((img, index) => {
      parts.push({
        text: `Page ${index + 1} of ${images.length}:`,
      });
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data.replace(/^data:[^;]+;base64,/, ""),
        },
      });
    });

    const model =
      process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    const geminiJson = (await geminiRes.json()) as {
      error?: { message?: string };
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    if (!geminiRes.ok) {
      const msg =
        geminiJson.error?.message ||
        "Gemini API greška. Provjeri API ključ i kvotu.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let latex =
      geminiJson.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim() || "";

    if (!latex) {
      return NextResponse.json(
        { error: "Model nije vratio LaTeX. Pokušaj s jasnijom fotografijom." },
        { status: 502 },
      );
    }

    // Strip accidental markdown fences
    latex = latex
      .replace(/^```(?:latex|tex)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json({ latex, isPro });
  } catch (err) {
    console.error("convert error", err);
    return NextResponse.json(
      { error: "Interna greška pri konverziji." },
      { status: 500 },
    );
  }
}
