export type PageImage = {
  id: string;
  file: File;
  previewUrl: string;
  mimeType: string;
};

export async function fileToBase64Payload(
  file: File,
): Promise<{ mimeType: string; data: string }> {
  const dataUrl = await readAsDataURL(file);
  const [header, data] = dataUrl.split(",");
  const mimeMatch = /data:([^;]+);base64/.exec(header);
  return {
    mimeType: mimeMatch?.[1] || file.type || "image/jpeg",
    data,
  };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Downscale large photos so local OCR stays fast. */
export async function compressImageFile(
  file: File,
  maxSide = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1 && file.size < 1_200_000) {
    bitmap.close();
    return file;
  }

  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
