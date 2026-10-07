import katex from "katex";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

function renderInlineMath(text: string): string {
  // Protect display math first with placeholders
  const blocks: string[] = [];
  let s = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    const i = blocks.length;
    blocks.push(renderMath(tex.trim(), true));
    return `\u0000B${i}\u0000`;
  });

  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => {
    const i = blocks.length;
    blocks.push(renderMath(tex.trim(), true));
    return `\u0000B${i}\u0000`;
  });

  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => {
    const i = blocks.length;
    blocks.push(renderMath(tex.trim(), false));
    return `\u0000B${i}\u0000`;
  });

  s = s.replace(/\$([^$\n]+?)\$/g, (_, tex: string) => {
    const i = blocks.length;
    blocks.push(renderMath(tex.trim(), false));
    return `\u0000B${i}\u0000`;
  });

  s = escapeHtml(s);
  s = s.replace(/\u0000B(\d+)\u0000/g, (_, i: string) => blocks[Number(i)] || "");
  return s;
}

function stripPreamble(src: string): string {
  let body = src;
  const beginDoc = body.search(/\\begin\{document\}/);
  if (beginDoc >= 0) {
    body = body.slice(beginDoc + "\\begin{document}".length);
  }
  body = body.replace(/\\end\{document\}[\s\S]*$/, "");
  body = body.replace(/\\documentclass[\s\S]*?\{[^}]+\}/g, "");
  body = body.replace(/\\usepackage(\[[^\]]*\])?\{[^}]+\}/g, "");
  body = body.replace(/\\title\{([^}]*)\}/g, "\\section*{$1}");
  body = body.replace(/\\author\{([^}]*)\}/g, "");
  body = body.replace(/\\date\{([^}]*)\}/g, "");
  body = body.replace(/\\maketitle/g, "");
  return body.trim();
}

function transformEnvs(body: string): string {
  return body
    .replace(
      /\\begin\{(definition|theorem|lemma|proposition|corollary|example|remark|proof)\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{\1\}/g,
      (_, env: string, title: string | undefined, content: string) => {
        const label = title
          ? `${env[0].toUpperCase()}${env.slice(1)} (${title})`
          : `${env[0].toUpperCase()}${env.slice(1)}`;
        return `\n\n<strong class="env-title">${label}.</strong> ${content.trim()}\n\n`;
      },
    )
    .replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, inner: string) => {
      const items = inner
        .split(/\\item\s*/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((item) => `<li>${renderInlineMath(item)}</li>`)
        .join("");
      return `<ol>${items}</ol>`;
    })
    .replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, inner: string) => {
      const items = inner
        .split(/\\item\s*/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((item) => `<li>${renderInlineMath(item)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    });
}

export function latexToPreviewHtml(latex: string): string {
  if (!latex.trim()) {
    return `<p class="muted">PDF pregled će se pojaviti ovdje nakon konverzije.</p>`;
  }

  let body = stripPreamble(latex);
  body = transformEnvs(body);

  body = body.replace(/\\section\*\{([^}]*)\}/g, (_, t: string) => `\n\n<h1>${escapeHtml(t)}</h1>\n\n`);
  body = body.replace(/\\section\{([^}]*)\}/g, (_, t: string) => `\n\n<h1>${escapeHtml(t)}</h1>\n\n`);
  body = body.replace(/\\subsection\{([^}]*)\}/g, (_, t: string) => `\n\n<h2>${escapeHtml(t)}</h2>\n\n`);
  body = body.replace(/\\subsubsection\{([^}]*)\}/g, (_, t: string) => `\n\n<h3>${escapeHtml(t)}</h3>\n\n`);
  body = body.replace(/\\textbf\{([^}]*)\}/g, (_, t: string) => `<strong>${escapeHtml(t)}</strong>`);
  body = body.replace(/\\emph\{([^}]*)\}/g, (_, t: string) => `<em>${escapeHtml(t)}</em>`);
  body = body.replace(/\\textit\{([^}]*)\}/g, (_, t: string) => `<em>${escapeHtml(t)}</em>`);
  body = body.replace(/\\\\/g, "<br/>");
  body = body.replace(/\\newline/g, "<br/>");
  body = body.replace(/\\par\b/g, "\n\n");

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("<h") || p.startsWith("<ol") || p.startsWith("<ul") || p.startsWith("<div")) {
        return p;
      }
      return `<p>${renderInlineMath(p)}</p>`;
    })
    .join("\n");

  return paragraphs;
}
