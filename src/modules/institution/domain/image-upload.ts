import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/** Raster formats accepted for brand images. SVG is excluded (it can carry scripts). */
export interface ImageFormat {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const MIN_SIDE = 16;
const MAX_SIDE = 4096;

const PNG: ImageFormat = { mimeType: 'image/png', extension: 'png' };
const JPEG: ImageFormat = { mimeType: 'image/jpeg', extension: 'jpg' };
const WEBP: ImageFormat = { mimeType: 'image/webp', extension: 'webp' };

/** Declared MIME types accepted for each detected format. */
const DECLARED_ALIASES: Record<ImageFormat['mimeType'], readonly string[]> = {
  'image/png': ['image/png'],
  'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  'image/webp': ['image/webp'],
};

/** Markers of scripts/markup hidden in an image (polyglot files, legacy S1/S2). */
const SUSPICIOUS = ['<?php', '<?=', '<script', '<html', '<svg'];

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));
const u16be = (b: Uint8Array, i: number) => ((b[i] as number) << 8) | (b[i + 1] as number);
const u16le = (b: Uint8Array, i: number) => (b[i] as number) | ((b[i + 1] as number) << 8);
const u24le = (b: Uint8Array, i: number) => u16le(b, i) | ((b[i + 2] as number) << 16);
const u32be = (b: Uint8Array, i: number) => ((u16be(b, i) << 16) >>> 0) + u16be(b, i + 2);

/** Identifies the format from the file signature (magic bytes), never from the name or the client MIME. */
export const detectImageFormat = (bytes: Uint8Array): ImageFormat | null => {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value))
    return PNG;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG;
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return WEBP;
  return null;
};

const jpegDimensions = (b: Uint8Array): ImageDimensions | null => {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    i += 2 + u16be(b, i + 2);
  }
  return null;
};

const webpDimensions = (b: Uint8Array): ImageDimensions | null => {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === 'VP8L') {
    const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]] as number[];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  return null;
};

/** Pixel size read from the image header; `null` when the header is malformed. */
export const readImageDimensions = (bytes: Uint8Array, format: ImageFormat): ImageDimensions | null => {
  switch (format.extension) {
    case 'png':
      return bytes.length >= 24 && ascii(bytes, 12, 4) === 'IHDR'
        ? { width: u32be(bytes, 16), height: u32be(bytes, 20) }
        : null;
    case 'jpg':
      return jpegDimensions(bytes);
    case 'webp':
      return webpDimensions(bytes);
  }
};

const reject = (message: string, code: string): never => {
  throw new BusinessRuleViolationError(message, code);
};

export interface ImageUploadInput {
  content: Uint8Array;
  /** MIME type sent by the client; must agree with the real content. */
  declaredMimeType?: string | null;
}

/**
 * Strict validation of an uploaded brand image (logo). Fixes the legacy
 * uploads that trusted the client MIME and kept the original extension
 * (remote code execution, S1/S2):
 * 1. size between 1 byte and 2 MB;
 * 2. PNG, JPEG or WebP detected from the magic bytes (no SVG/GIF);
 * 3. the declared MIME, when present, matches the detected format;
 * 4. readable header with 16–4096 px per side;
 * 5. no embedded script/markup markers.
 * The stored extension and the served content type derive from the detected format.
 */
export const validateImageUpload = ({ content, declaredMimeType }: ImageUploadInput): ImageFormat & ImageDimensions => {
  if (!content.length) reject('El archivo está vacío.', 'EMPTY_FILE');
  if (content.length > LOGO_MAX_BYTES) reject('El archivo supera el máximo de 2 MB.', 'FILE_TOO_LARGE');

  const format =
    detectImageFormat(content) ?? reject('Formato no permitido. Use PNG, JPG o WebP.', 'UNSUPPORTED_IMAGE');
  const declared = declaredMimeType?.trim().toLowerCase();
  if (declared && !DECLARED_ALIASES[format.mimeType].includes(declared)) {
    reject('El tipo declarado del archivo no coincide con su contenido.', 'MIME_MISMATCH');
  }

  const dimensions =
    readImageDimensions(content, format) ?? reject('La imagen está dañada o es inválida.', 'INVALID_IMAGE');
  if ([dimensions.width, dimensions.height].some((side) => side < MIN_SIDE || side > MAX_SIDE)) {
    reject(`La imagen debe medir entre ${MIN_SIDE} y ${MAX_SIDE} píxeles por lado.`, 'INVALID_IMAGE_SIZE');
  }

  const text = new TextDecoder('latin1').decode(content).toLowerCase();
  if (SUSPICIOUS.some((marker) => text.includes(marker)))
    reject('El archivo contiene código no permitido.', 'SUSPICIOUS_CONTENT');

  return { ...format, ...dimensions };
};
