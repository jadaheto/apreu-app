/**
 * Detects a file type from its leading "magic bytes", never from the name or
 * the MIME type declared by the client (fix of the legacy RCE in
 * `api/upload_email_image.php`, which trusted the client extension).
 */
export type DetectedFileType = 'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'ole' | 'zip';

interface Signature {
  type: DetectedFileType;
  matches: (bytes: Uint8Array) => boolean;
}

const startsWith = (bytes: Uint8Array, prefix: number[], offset = 0): boolean =>
  bytes.length >= offset + prefix.length && prefix.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));

const SIGNATURES: readonly Signature[] = [
  { type: 'png', matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { type: 'jpeg', matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { type: 'gif', matches: (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')) },
  { type: 'webp', matches: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8) },
  { type: 'pdf', matches: (b) => startsWith(b, ascii('%PDF-')) },
  // Legacy Office documents (.doc/.xls) use the OLE2 compound file format.
  { type: 'ole', matches: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  // Office Open XML (.docx/.xlsx) are ZIP containers.
  { type: 'zip', matches: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
];

export const detectFileType = (bytes: Uint8Array): DetectedFileType | null =>
  SIGNATURES.find((signature) => signature.matches(bytes))?.type ?? null;

/** Canonical MIME type and extension of each detectable type. */
export const FILE_TYPE_INFO: Record<DetectedFileType, { mime: string; extension: string }> = {
  png: { mime: 'image/png', extension: 'png' },
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  gif: { mime: 'image/gif', extension: 'gif' },
  webp: { mime: 'image/webp', extension: 'webp' },
  pdf: { mime: 'application/pdf', extension: 'pdf' },
  ole: { mime: 'application/octet-stream', extension: 'bin' },
  zip: { mime: 'application/zip', extension: 'zip' },
};
