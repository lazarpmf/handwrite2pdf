import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Open Overleaf with a hosted snip — falls back to downloading .tex for manual upload. */
export function openOverleaf(latex: string): void {
  // Overleaf snip_uri needs a public URL; provide data via clipboard + open blank project.
  void navigator.clipboard.writeText(latex).catch(() => undefined);
  window.open("https://www.overleaf.com/project", "_blank", "noopener,noreferrer");
}

export async function exportPreviewToPdf(
  element: HTMLElement,
  opts: { filename?: string; watermark?: string } = {},
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  if (opts.watermark) {
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(opts.watermark, pageWidth / 2, pageHeight - 6, {
        align: "center",
      });
    }
  }

  pdf.save(opts.filename || "inktex-notes.pdf");
}
