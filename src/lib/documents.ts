export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const DOCUMENT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as const;
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