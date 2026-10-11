export type PageImage = {
  mimeType: string;
  data: string;
};

export class ConvertFailure extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConvertFailure";
    this.status = status;
  }
}

const INSTRUCTION = `You convert photos of handwritten or printed notebook pages into one LaTeX document. Redraw every figure as SVG.

Output rules:
- Reply with LaTeX source only. No markdown fences and no commentary.
- One complete document: \\documentclass{article}, \\usepackage{amsmath,amssymb}, then \\begin{document} ... \\end{document}.
- Keep the language written on the page. Do not translate. Do not invent sentences. An unreadable word becomes [?].
- The page title and each theorem or named block are \\section*{Title}.
- Bullet lists are itemize. Numbered lists are enumerate.
- A two-column proof is a table with a header row, one fact per row:
\\begin{tabular}{l|l}
statements & reasons \\\\
1) $\\square EFGH$ & 1) given \\\\
\\end{tabular}
Every symbol in a cell is inside $...$.
- A stack of formulas is align*, one formula per line:
\\begin{align*}
(a+b)^2 &= a^2 + 2ab + b^2 \\\\
(a-b)^2 &= a^2 - 2ab + b^2 \\\\
\\end{align*}
Never leave &= or \\\\\\\\ outside align*.
- Every hand-drawn figure is redrawn, not described. Put this immediately after the text it belongs to:
\\begin{inkfig}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180">...</svg>
\\end{inkfig}
SVG rules: white background, black stroke, stroke-width 2, vertex letters and angle numbers as <text>, only line, polygon, polyline, rect, circle, text. No images, scripts, or style blocks. Match the shape, labels, and angle numbers on the page.
- Do not write "Figura:" instead of the drawing.
- \\\\newpage between photographed pages.
- No HTML except the SVG inside inkfig. No center, huge, setcounter, or TikZ.`;

export async function pagesToLatex(images: PageImage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvertFailure(
      "Čitanje rukopisa nije podešeno. Na Netlifyu dodaj GEMINI_API_KEY i ponovo objavi sajt.",
      503,
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const parts: Array<Record<string, unknown>> = [
    {
      text: `There are ${images.length} page images. Image order is document order.`,
    },
  ];

  images.forEach((image, index) => {
    parts.push({ text: `Stranica ${index + 1}.` });
    parts.push({
      inline_data: {
        mime_type: normalizeMime(image.mimeType),
        data: image.data.replace(/^data:[^;]+;base64,/, ""),
      },
    });
  });

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCTION }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 16384,
          },
        }),
        signal: AbortSignal.timeout(22_000),
      },
    );
  } catch {
    throw new ConvertFailure(
      "Čitanje rukopisa se nije javilo. Pokušaj ponovo za koji trenutak.",
      502,
    );
  }

  const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
  if (!response.ok) {
    throw new ConvertFailure(messageForStatus(response.status, payload), statusFor(response.status));
  }

  const text = extractText(payload);
  if (!text) {
    throw new ConvertFailure(
      "Rukopis nije pročitan. Snimi stranicu bliže, uspravno i sa više svjetla.",
      502,
    );
  }

  return ensureDocument(text);
}

function normalizeMime(mimeType: string): string {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpg") return "image/jpeg";
  if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/heic" ||
    mime === "image/heif"
  ) {
    return mime;
  }
  return "image/jpeg";
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

function extractText(payload: GeminiResponse | null): string {
  if (payload?.promptFeedback?.blockReason) return "";
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function ensureDocument(raw: string): string {
  const fenced = raw.trim().match(/^```(?:latex|tex)?\s*([\s\S]*?)```$/i);
  const text = (fenced?.[1] ?? raw).trim();
  if (text.includes("\\documentclass")) return text;
  return [
    "\\documentclass{article}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage[margin=2.2cm]{geometry}",
    "\\begin{document}",
    "",
    text,
    "",
    "\\end{document}",
    "",
  ].join("\n");
}

function messageForStatus(status: number, payload: GeminiResponse | null): string {
  const googleStatus = payload?.error?.status || "";
  if (status === 400 || googleStatus === "INVALID_ARGUMENT") {
    return "Fotografija nije prihvaćena. Snimi je ponovo kao JPEG ili PNG.";
  }
  if (status === 401 || status === 403 || googleStatus === "PERMISSION_DENIED") {
    return "Gemini nije prihvatio ključ. Provjeri GEMINI_API_KEY na Netlifyu.";
  }
  if (status === 404 || googleStatus === "NOT_FOUND") {
    return "Model za čitanje nije pronađen. Na Netlifyu ostavi GEMINI_MODEL prazan ili stavi gemini-3.5-flash-lite.";
  }
  if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    return "Dnevni besplatni limit za čitanje je pun. Pokušaj ponovo kasnije.";
  }
  return "Čitanje rukopisa trenutno ne radi. Pokušaj ponovo.";
}

function statusFor(status: number): number {
  if (status === 400) return 400;
  if (status === 401 || status === 403) return 502;
  if (status === 429) return 429;
  return 502;
}
