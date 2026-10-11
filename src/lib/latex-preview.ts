import katex from "katex";

const blocks: string[] = [];
const inlines: string[] = [];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMath(tex: string, displayMode: boolean): string {
  const cleaned = tex.replace(/\\label\{[^{}]*\}/g, "").trim();
  try {
    return katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
      output: "html",
    });
  } catch {
    return `<code>${escapeHtml(cleaned)}</code>`;
  }
}

function block(html: string): string {
  const id = blocks.length;
  blocks.push(html);
  return `\u0000B${id}\u0000`;
}

function inline(html: string): string {
  const id = inlines.length;
  inlines.push(html);
  return `\u0000I${id}\u0000`;
}

function restore(src: string): string {
  let current = src;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current
      .replace(/\u0000I(\d+)\u0000/g, (_, id: string) => inlines[Number(id)] ?? "")
      .replace(/\u0000B(\d+)\u0000/g, (_, id: string) => blocks[Number(id)] ?? "");
  }
  return current;
}

function matchBrace(src: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceCommand(
  src: string,
  name: string,
  render: (arg: string) => string,
): string {
  const token = `\\${name}`;
  let out = "";
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf(token, i);
    if (at < 0) {
      out += src.slice(i);
      break;
    }
    const afterName = at + token.length;
    if (/[a-zA-Z]/.test(src[afterName] || "")) {
      out += src.slice(i, afterName);
      i = afterName;
      continue;
    }
    out += src.slice(i, at);
    let j = afterName;
    if (src[j] === "*") j += 1;
    while (src[j] === " " || src[j] === "\n") j += 1;
    while (src[j] === "[") {
      const end = src.indexOf("]", j);
      if (end < 0) break;
      j = end + 1;
      while (src[j] === " " || src[j] === "\n") j += 1;
    }
    if (src[j] !== "{") {
      i = j;
      continue;
    }
    const end = matchBrace(src, j);
    if (end < 0) {
      i = j;
      continue;
    }
    out += render(src.slice(j + 1, end));
    i = end + 1;
  }
  return out;
}

function findEnvBegin(
  src: string,
  name: string,
  from: number,
): { index: number; length: number; starred: boolean } | null {
  const needle = `\\begin{${name}`;
  let i = from;
  while (i < src.length) {
    const at = src.indexOf(needle, i);
    if (at < 0) return null;
    let j = at + needle.length;
    const starred = src[j] === "*";
    if (starred) j += 1;
    if (src[j] === "}") return { index: at, length: j + 1 - at, starred };
    i = at + needle.length;
  }
  return null;
}

function replaceEnvironment(
  src: string,
  name: string,
  render: (inner: string) => string,
): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const begin = findEnvBegin(src, name, i);
    if (!begin) {
      out += src.slice(i);
      break;
    }
    const endToken = `\\end{${name}${begin.starred ? "*" : ""}}`;
    out += src.slice(i, begin.index);
    let depth = 1;
    let j = begin.index + begin.length;
    let closeAt = -1;
    while (j < src.length && depth > 0) {
      const nextBegin = findEnvBegin(src, name, j);
      const nextEnd = src.indexOf(endToken, j);
      if (nextEnd < 0) break;
      if (nextBegin && nextBegin.index < nextEnd) {
        depth += 1;
        j = nextBegin.index + nextBegin.length;
      } else {
        depth -= 1;
        if (depth === 0) closeAt = nextEnd;
        j = nextEnd + endToken.length;
      }
    }
    if (closeAt < 0) {
      out += src.slice(begin.index);
      break;
    }
    out += render(src.slice(begin.index + begin.length, closeAt));
    i = closeAt + endToken.length;
  }
  return out;
}

function stripPreamble(src: string): string {
  let body = src;
  const beginDoc = body.search(/\\begin\{document\}/);
  if (beginDoc >= 0) body = body.slice(beginDoc + "\\begin{document}".length);
  body = body.replace(/\\end\{document\}[\s\S]*$/, "");
  body = body.replace(/\\documentclass(\[[^\]]*\])?\{[^}]+\}/g, "");
  body = body.replace(/\\usepackage(\[[^\]]*\])?\{[^}]+\}/g, "");
  body = body.replace(/\\title\{([^{}]*)\}/g, "\\section*{$1}");
  body = body.replace(/\\author\{[^{}]*\}/g, "");
  body = body.replace(/\\date\{[^{}]*\}/g, "");
  body = body.replace(/\\maketitle/g, "");
  return body.trim();
}

function absorbHtml(src: string): string {
  return src
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/?\s*p\s*>/gi, "\n\n")
    .replace(/<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, _tag: string, inner: string) => `\\textbf{${inner}}`)
    .replace(/<\s*(em|i)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, _tag: string, inner: string) => `\\emph{${inner}}`)
    .replace(/<[^>]+>/g, "");
}

function stripComments(src: string): string {
  return src.replace(/(^|[^\\])%.*$/gm, "$1");
}

function plainText(src: string): string {
  let text = src;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/\\(?:textbf|emph|textit|underline|textrm|texttt|textsc)\{([^{}]*)\}/g, "$1");
    text = text.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "");
    text = text.replace(/[{}]/g, "");
  }
  return text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

function unwrapSizeGroups(src: string): string {
  const re = /\{\s*\\(Huge|huge|LARGE|Large|large)\s+/g;
  let out = "";
  let last = 0;
  for (const match of src.matchAll(re)) {
    const open = match.index ?? 0;
    const end = matchBrace(src, open);
    if (end < 0) continue;
    const inner = src.slice(open + match[0].length, end).trim();
    out += src.slice(last, open);
    out += `\\section*{${inner}}`;
    last = end + 1;
  }
  out += src.slice(last);
  return out;
}

function sanitizeSvg(src: string): string | null {
  const match = src.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  let svg = match[0];
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  svg = svg.replace(/\s(?:href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  svg = svg.replace(/javascript:/gi, "");
  if (!/^<svg[\s>]/i.test(svg.trim())) return null;
  return `<div class="note-figure">${svg}</div>`;
}

function extractFigures(src: string): string {
  let text = replaceEnvironment(src, "inkfig", (inner) => {
    const svg = sanitizeSvg(inner);
    return svg ? `\n\n${block(svg)}\n\n` : "\n\n";
  });
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, (svg) => {
    const clean = sanitizeSvg(svg);
    return clean ? `\n\n${block(clean)}\n\n` : "";
  });
  return text;
}

function promoteFormulaBlocks(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let group: string[] = [];
  let depth = 0;
  const flush = () => {
    const body = group.join("\n").trim();
    if (body) out.push(`\\begin{align*}\n${body}\n\\end{align*}`);
    group = [];
  };
  for (const line of lines) {
    const begins = line.match(/\\begin\{/g)?.length ?? 0;
    const ends = line.match(/\\end\{/g)?.length ?? 0;
    const trimmed = line.trim();
    const formula =
      depth === 0 &&
      Boolean(trimmed) &&
      !trimmed.startsWith("\\") &&
      trimmed.includes("&=");
    if (formula) group.push(line);
    else {
      flush();
      out.push(line);
    }
    depth = Math.max(0, depth + begins - ends);
  }
  flush();
  return out.join("\n");
}

function renderDisplay(inner: string): string {
  const body = inner.trim();
  if (!body) return "";
  const tex = /\\begin\{/.test(body) ? body : `\\begin{aligned}${body}\\end{aligned}`;
  return `\n\n${block(renderMath(tex, true))}\n\n`;
}

function splitLatexRows(src: string): string[] {
  const rows: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === "\\" && src[i + 1] === "\\" && depth === 0) {
      rows.push(current);
      current = "";
      i += 1;
      continue;
    }
    if (src[i] === "\\" && i + 1 < src.length) {
      current += src[i] + src[i + 1];
      i += 1;
      continue;
    }
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") depth -= 1;
    current += src[i];
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function splitCells(src: string): string[] {
  const cells: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === "\\" && i + 1 < src.length) {
      current += src[i] + src[i + 1];
      i += 1;
      continue;
    }
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") depth -= 1;
    else if (src[i] === "&" && depth === 0) {
      cells.push(current);
      current = "";
      continue;
    }
    current += src[i];
  }
  cells.push(current);
  return cells;
}

function renderCell(cell: string): string {
  let text = cell.replace(/\\hline/g, "").trim();
  if (!text) return "";
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => inline(renderMath(tex, false)));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => inline(renderMath(tex, false)));
  return finalizeInline(text);
}

function renderTabular(raw: string): string {
  let inner = raw.trim();
  if (inner.startsWith("[")) {
    const end = inner.indexOf("]");
    if (end >= 0) inner = inner.slice(end + 1).trim();
  }
  if (inner.startsWith("{")) {
    const end = matchBrace(inner, 0);
    if (end > 0) inner = inner.slice(end + 1);
  }
  const rows = splitLatexRows(inner)
    .map((row) => row.replace(/\\hline/g, "").trim())
    .filter(Boolean)
    .map((row) => {
      const cells = splitCells(row).map((cell) => `<td>${renderCell(cell)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  if (!rows) return "";
  return `\n\n${block(`<table class="note-table"><tbody>${rows}</tbody></table>`)}\n\n`;
}

function extractMath(src: string): string {
  let text = src;
  for (const name of ["align", "flalign", "eqnarray", "gather", "aligned", "gathered", "split", "multline", "equation"]) {
    text = replaceEnvironment(text, name, renderDisplay);
  }
  text = replaceEnvironment(text, "tabular", renderTabular);
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    const body = String(tex).trim();
    const wrapped = /\\\\|&=/.test(body) && !/\\begin\{/.test(body) ? `\\begin{aligned}${body}\\end{aligned}` : body;
    return block(renderMath(wrapped, true));
  });
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => block(renderMath(tex, true)));
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => inline(renderMath(tex, false)));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => inline(renderMath(tex, false)));
  return text;
}

function transformCenter(inner: string): string {
  const trimmed = inner.trim();
  if (/^\\section\*?\{[\s\S]*\}$/.test(trimmed)) return `\n\n${trimmed}\n\n`;
  const text = plainText(trimmed);
  if (text && text.length <= 90 && !trimmed.includes("\n\n")) return `\n\n\\section*{${text}}\n\n`;
  return `\n\n${trimmed}\n\n`;
}

function listHtml(tag: "ol" | "ul", inner: string): string {
  const items = inner
    .split(/\\item\s*/)
    .map((item) => finalizeInline(item.trim()))
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join("");
  return block(`<${tag}>${items}</${tag}>`);
}

function applyInlineFormatting(src: string): string {
  let text = src;
  const tags: Record<string, string> = {
    textbf: "strong",
    emph: "em",
    textit: "em",
    underline: "u",
  };
  let previous = "";
  while (text !== previous) {
    previous = text;
    for (const [name, tag] of Object.entries(tags)) {
      text = replaceCommand(text, name, (inner) => inline(`<${tag}>${escapeHtml(plainText(inner))}</${tag}>`));
    }
  }
  return text;
}

function applyHeadings(src: string): string {
  let text = src;
  const levels: Array<[string, string]> = [
    ["section", "h1"],
    ["subsection", "h2"],
    ["subsubsection", "h3"],
  ];
  for (const [name, tag] of levels) {
    text = replaceCommand(text, name, (inner) => {
      const title = escapeHtml(plainText(inner));
      if (!title) return "";
      return `\n\n${block(`<${tag}>${title}</${tag}>`)}\n\n`;
    });
  }
  return text;
}

const NOISE =
  "setcounter|addtocounter|vspace|hspace|noindent|thispagestyle|pagestyle|label|cite|ref|footnote|quad|qquad|hfill|vfill|linebreak|tableofcontents|centering|raggedright|raggedleft|normalsize|footnotesize|scriptsize|tiny|Huge|huge|LARGE|Large|large";

function dropNoise(src: string): string {
  const re = new RegExp(`\\\\(?:${NOISE})\\*?(?:\\[[^\\]]*\\])?(?:\\{[^{}]*\\})*`, "g");
  let text = src;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(re, "");
  }
  return text;
}

function stripUnknown(src: string): string {
  let text = src;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, "$1");
    text = text.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "");
  }
  return text.replace(/[{}]/g, "");
}

function latexEscapes(src: string): string {
  return src
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/~/g, " ")
    .replace(/\\,/g, " ")
    .replace(/---/g, "—")
    .replace(/--/g, "–");
}

function finalizeInline(src: string): string {
  let text = dropNoise(src);
  text = stripUnknown(text);
  text = latexEscapes(text);
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  text = text.replace(/[ \t]{2,}/g, " ").trim();
  if (!text) return "";
  return escapeTextPreservingSlots(text);
}

function escapeTextPreservingSlots(src: string): string {
  return src
    .split(/(\u0000[IB]\d+\u0000|<br\/>)/)
    .map((part) => {
      if (part.startsWith("\u0000") || part === "<br/>") return part;
      return escapeHtml(part);
    })
    .join("");
}

function paragraphs(src: string): string {
  const chunks = src.split(/(\u0000B\d+\u0000)/);
  return chunks
    .map((chunk) => {
      if (/^\u0000B\d+\u0000$/.test(chunk)) return chunk;
      return chunk
        .split(/\n{2,}/)
        .map((part) => {
          const html = finalizeInline(part.replace(/[ \t]*\n[ \t]*/g, "<br/>"));
          return html ? `<p>${html}</p>` : "";
        })
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");
}

export function latexToPreviewHtml(latex: string): string {
  blocks.length = 0;
  inlines.length = 0;

  if (!latex.trim()) {
    return `<p class="muted">PDF pregled će se pojaviti ovdje nakon konverzije.</p>`;
  }

  let body = stripPreamble(latex);
  body = extractFigures(body);
  body = absorbHtml(body);
  body = stripComments(body);
  body = promoteFormulaBlocks(body);
  body = extractMath(body);
  body = unwrapSizeGroups(body);
  body = replaceEnvironment(body, "center", transformCenter);
  body = replaceEnvironment(body, "flushleft", (inner) => `\n\n${inner.trim()}\n\n`);
  body = replaceEnvironment(body, "flushright", (inner) => `\n\n${inner.trim()}\n\n`);
  body = replaceEnvironment(body, "tikzpicture", () => block(`<p class="figure-note">[Figura]</p>`));
  body = applyHeadings(body);
  body = applyInlineFormatting(body);
  body = replaceEnvironment(body, "quote", (inner) => block(`<blockquote>${finalizeInline(inner)}</blockquote>`));
  body = replaceEnvironment(body, "quotation", (inner) => block(`<blockquote>${finalizeInline(inner)}</blockquote>`));
  body = replaceEnvironment(body, "enumerate", (inner) => listHtml("ol", inner));
  body = replaceEnvironment(body, "itemize", (inner) => listHtml("ul", inner));
  body = body.replace(/\\(?:newpage|clearpage|cleardoublepage|pagebreak)\b/g, () => `\n\n${block('<hr class="sheet-break"/>')}\n\n`);
  body = body.replace(/\\\\|\\newline|\\par\b/g, "\n");

  return restore(paragraphs(body));
}
