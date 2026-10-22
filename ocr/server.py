"""Local Pix2Text service: notebook photos -> LaTeX. No API key, no cloud."""

from __future__ import annotations

import base64
import io
import os
import re
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="InkTeX OCR")
_lock = threading.Lock()
_engine = None


class ImageIn(BaseModel):
    mimeType: str
    data: str


class ConvertIn(BaseModel):
    images: list[ImageIn]


def _patch_rapidocr() -> None:
    """rapidocr 3.10 renamed resolve_model_key; cnocr/cnstd still import the old name."""
    import rapidocr.utils.model_resolver as resolver

    if not hasattr(resolver, "resolve_model_key") and hasattr(
        resolver, "route_to_model_key"
    ):
        resolver.resolve_model_key = resolver.route_to_model_key


def get_engine():
    global _engine
    if _engine is None:
        _patch_rapidocr()
        from pix2text import Pix2Text

        device = os.environ.get("P2T_DEVICE", "cpu")
        _engine = Pix2Text.from_config(device=device)
    return _engine


def page_to_markdown(page) -> str:
    if isinstance(page, str):
        return page

    for name in ("to_markdown", "to_str"):
        fn = getattr(page, name, None)
        if not callable(fn):
            continue
        try:
            result = fn()
        except TypeError:
            result = None
        if isinstance(result, str) and result.strip():
            return result

    with tempfile.TemporaryDirectory() as folder:
        writer = getattr(page, "to_markdown", None)
        if not callable(writer):
            return str(page)
        writer(folder)
        chunks = [
            path.read_text(encoding="utf-8")
            for path in sorted(Path(folder).rglob("*.md"))
        ]
        return "\n\n".join(chunks).strip() or str(page)


def _is_table_row(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2


def _is_table_sep(line: str) -> bool:
    return bool(re.match(r"^\s*\|?\s*:?-{3,}.*\|?\s*$", line.strip()))


def _split_row(line: str) -> list[str]:
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return [cell.strip() for cell in inner.split("|")]


def _cell_latex(cell: str) -> str:
    if "$" in cell:
        return cell.replace("%", r"\%")
    return (
        cell.replace("\\", r"\textbackslash{}")
        .replace("&", r"\&")
        .replace("%", r"\%")
        .replace("_", r"\_")
    )


def _rows_to_tabular(rows: list[list[str]]) -> str:
    width = max((len(row) for row in rows), default=1)
    spec = "|".join(["l"] * width)
    lines = [rf"\begin{{tabular}}{{{spec}}}"]
    for index, row in enumerate(rows):
        padded = row + [""] * (width - len(row))
        lines.append(" & ".join(_cell_latex(cell) for cell in padded) + r" \\")
        if index == 0:
            lines.append(r"\hline")
    lines.append(r"\end{tabular}")
    return "\n".join(lines)


def convert_markdown_tables(markdown: str) -> str:
    lines = markdown.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    index = 0
    while index < len(lines):
        if (
            _is_table_row(lines[index])
            and index + 1 < len(lines)
            and _is_table_sep(lines[index + 1])
        ):
            rows = [_split_row(lines[index])]
            index += 2
            while index < len(lines) and _is_table_row(lines[index]):
                rows.append(_split_row(lines[index]))
                index += 1
            out.append(_rows_to_tabular(rows))
            continue
        out.append(lines[index])
        index += 1
    return "\n".join(out)


def markdown_to_latex_body(markdown: str) -> str:
    lines = convert_markdown_tables(markdown).replace("\r\n", "\n").split("\n")
    out: list[str] = []
    in_list = False
    index = 0

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append(r"\end{itemize}")
            in_list = False

    while index < len(lines):
        line = lines[index].rstrip()
        stripped = line.strip()
        if stripped.startswith(r"\begin{tabular}"):
            close_list()
            while index < len(lines):
                out.append(lines[index].rstrip())
                if r"\end{tabular}" in lines[index]:
                    index += 1
                    break
                index += 1
            continue
        if not stripped:
            close_list()
            out.append("")
            index += 1
            continue
        if stripped.startswith("### "):
            close_list()
            out.append(rf"\subsubsection{{{stripped[4:]}}}")
            index += 1
            continue
        if stripped.startswith("## "):
            close_list()
            out.append(rf"\subsection{{{stripped[3:]}}}")
            index += 1
            continue
        if stripped.startswith("# "):
            close_list()
            out.append(rf"\section{{{stripped[2:]}}}")
            index += 1
            continue
        if stripped.startswith(("- ", "* ")):
            if not in_list:
                out.append(r"\begin{itemize}")
                in_list = True
            out.append(r"\item " + apply_emphasis(stripped[2:]))
            index += 1
            continue
        close_list()
        out.append(apply_emphasis(stripped))
        index += 1

    close_list()
    return "\n".join(out).strip()


def apply_emphasis(text: str) -> str:
    pieces = text.split("$")
    rebuilt: list[str] = []
    for index, piece in enumerate(pieces):
        if index % 2 == 1:
            rebuilt.append("$" + piece + "$")
            continue
        piece = replace_wrapped(piece, "**", r"\textbf{", "}")
        piece = replace_wrapped(piece, "*", r"\emph{", "}")
        rebuilt.append(piece)
    return "".join(rebuilt)


def replace_wrapped(text: str, marker: str, left: str, right: str) -> str:
    parts = text.split(marker)
    if len(parts) < 3 or len(parts) % 2 == 0:
        return text
    merged: list[str] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            merged.append(left + part + right)
        else:
            merged.append(part)
    return "".join(merged)


def wrap_document(body: str) -> str:
    return (
        "\\documentclass{article}\n"
        "\\usepackage{amsmath,amssymb,amsthm}\n"
        "\\usepackage[margin=2.2cm]{geometry}\n"
        "\\begin{document}\n\n"
        f"{body}\n\n"
        "\\end{document}\n"
    )


@app.get("/health")
def health():
    return {"ok": True, "engine": "pix2text", "loaded": _engine is not None}


@app.post("/convert")
def convert(body: ConvertIn):
    if not body.images:
        raise HTTPException(status_code=400, detail="Dodaj barem jednu sliku.")

    try:
        engine = get_engine()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"Pix2Text se nije učitao: {exc}",
        ) from exc

    bodies: list[str] = []
    with _lock:
        for index, image in enumerate(body.images, start=1):
            try:
                raw = base64.b64decode(image.data)
                picture = Image.open(io.BytesIO(raw)).convert("RGB")
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(
                    status_code=400,
                    detail=f"Stranica {index} nije validna slika.",
                ) from exc
            page = engine.recognize(picture, file_type="page")
            markdown = page_to_markdown(page)
            if not markdown.strip():
                markdown = f"[prazno — stranica {index}]"
            bodies.append(
                f"% page {index}\n" + markdown_to_latex_body(markdown)
            )

    return {"latex": wrap_document("\n\n".join(bodies)), "engine": "pix2text"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("OCR_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)
