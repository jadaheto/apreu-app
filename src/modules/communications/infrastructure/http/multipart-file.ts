import type { UploadedFile } from '../../domain/email/email-attachment.js';

/** Shape of a file parsed by Multer (`@nestjs/platform-express`); `@types/multer` is not installed. */
export interface MultipartFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export const toUploadedFile = (file: MultipartFile): UploadedFile => ({
  originalName: file.originalname,
  size: file.size,
  content: file.buffer,
});

/** Upload limits applied by Multer before the domain validation (defence in depth). */
export const ATTACHMENT_UPLOAD_LIMITS = { limits: { fileSize: 10 * 1024 * 1024, files: 5 } };
export const IMAGE_UPLOAD_LIMITS = { limits: { fileSize: 2 * 1024 * 1024, files: 1 } };
