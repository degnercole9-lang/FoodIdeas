const maxDimension = 1600;
const jpegQuality = 0.82;

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = URL.createObjectURL(file);
  });
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to image blob."));
          return;
        }
        resolve(
          new File([blob], fileName.replace(/\.(heic|heif)$/i, ".jpg"), {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      jpegQuality,
    );
  });
}

async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const module = await import("heic2any");
    const heic2any = module.default;
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: jpegQuality,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!(blob instanceof Blob)) {
      return file;
    }
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export async function normalizeImageForUpload(file: File): Promise<File> {
  const maybeConverted = isHeicFile(file)
    ? await convertHeicToJpeg(file)
    : file;
  const image = await loadImage(maybeConverted);

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(image.src);
    throw new Error("Could not create image processing context.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const normalized = await canvasToFile(canvas, maybeConverted.name);
  URL.revokeObjectURL(image.src);
  return normalized;
}

export async function normalizeImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => normalizeImageForUpload(file)));
}
