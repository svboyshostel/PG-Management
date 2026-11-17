export const DOCUMENT_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as const;

export function validateDocumentInputFile(file: { type: string; size: number }) {
  if (!(file.type in DOCUMENT_TYPES)) throw new Error("Choose a JPEG, PNG or PDF file.");
  if (!file.size || file.size > DOCUMENT_INPUT_MAX_BYTES) throw new Error("Choose a JPEG, PNG or PDF up to 5 MB.");
}

export function validateDocumentFile(file: { type: string; size: number }) {
  if (!(file.type in DOCUMENT_TYPES)) throw new Error("Choose a JPEG, PNG or PDF file.");
  if (!file.size || file.size > DOCUMENT_MAX_BYTES) throw new Error("Choose a JPEG, PNG or PDF up to 4 MB.");
}

export function validateDocument(type: string, bytes: Uint8Array) {
  if (!(type in DOCUMENT_TYPES)) throw new Error("Choose a JPEG, PNG or PDF file.");
  if (!bytes.length || bytes.length > DOCUMENT_MAX_BYTES) throw new Error("Document must be between 1 byte and 4 MB.");
  const valid = type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : type === "image/png" ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
    : new TextDecoder().decode(bytes.slice(0,5)) === "%PDF-";
  if (!valid) throw new Error("File contents do not match the selected file type.");
}

/**
 * Compresses an image File using HTML5 Canvas in the browser.
 * Reduces raw camera captures (3–10 MB) to ~200–400 KB before upload to respect Vercel payload limits.
 * Leaves non-image files (like PDFs) or non-browser environments untouched.
 */
export async function compressImageFile(file: File, maxDimension = 1600, quality = 0.8): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
            } else {
              const ext = file.name.split(".").pop() || "jpg";
              const baseName = file.name.replace(/\.[^.]+$/, "");
              const compressedFile = new File([blob], `${baseName}.${ext}`, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
