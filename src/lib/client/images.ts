export type PreparedImage = { mimeType: "image/jpeg"; base64: string; previewUrl: string; name: string };

const MAX_SIDE = 2000;

export class ImageReadError extends Error {
  constructor(readonly fileName: string) {
    super(`Could not read ${fileName}`);
    this.name = "ImageReadError";
  }
}

/** Downscales a photo in the browser so uploads stay small and HEIC from iPhones becomes JPEG where supported. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageReadError(file.name);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageReadError(file.name);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mimeType: "image/jpeg", base64: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl, name: file.name };
}
