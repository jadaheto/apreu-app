import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/** Maximum photo size: 2 MB (legacy hint "JPG/PNG máx 2MB"). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

interface ImageFormat {
  mimeType: string;
  extension: string;
  aliases: readonly string[];
  matches(bytes: Uint8Array): boolean;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const FORMATS: readonly ImageFormat[] = [
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    aliases: ['jpg', 'jpeg'],
    matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    mimeType: 'image/png',
    extension: 'png',
    aliases: ['png'],
    matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    aliases: ['webp'],
    // "RIFF" .... "WEBP"
    matches: (bytes) => startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  },
];

export interface PhotoUpload {
  originalName: string;
  mimeType: string;
  content: Uint8Array;
}

/**
 * A validated student photo.
 *
 * Fixes security issue S4 (`students/create.php:47-59`): legacy trusted the
 * client file name, so a `.php` file could be uploaded into the public
 * folder. Now the declared MIME type, the extension **and** the file
 * signature (magic bytes) must agree on JPEG, PNG or WebP, the size is capped
 * at {@link MAX_PHOTO_BYTES} and the stored extension is chosen by the server.
 */
export class StudentPhoto {
  private constructor(
    readonly mimeType: string,
    readonly extension: string,
    readonly content: Uint8Array,
  ) {}

  static from(upload: PhotoUpload): StudentPhoto {
    const size = upload.content?.byteLength ?? 0;
    if (size === 0) {
      throw new BusinessRuleViolationError('Debe adjuntar una imagen.', 'PHOTO_REQUIRED');
    }
    if (size > MAX_PHOTO_BYTES) {
      throw new BusinessRuleViolationError('La foto no puede superar 2 MB.', 'PHOTO_TOO_LARGE', {
        maxBytes: MAX_PHOTO_BYTES,
      });
    }
    const extension = upload.originalName?.split('.').pop()?.toLowerCase() ?? '';
    const format = FORMATS.find((candidate) => candidate.mimeType === upload.mimeType?.toLowerCase());
    if (!format || !format.aliases.includes(extension) || !format.matches(upload.content)) {
      throw new BusinessRuleViolationError(
        'La foto debe ser una imagen JPG, PNG o WebP válida.',
        'INVALID_PHOTO_TYPE',
        { allowed: FORMATS.map((f) => f.mimeType) },
      );
    }
    return new StudentPhoto(format.mimeType, format.extension, upload.content);
  }

  /** MIME type of a stored photo, inferred from its server-chosen extension. */
  static mimeTypeFor(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    return FORMATS.find((format) => format.aliases.includes(extension))?.mimeType ?? 'application/octet-stream';
  }
}
