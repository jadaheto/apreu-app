import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { detectFileType, FILE_TYPE_INFO, type DetectedFileType } from '../../domain/common/file-signature.js';
import type { UploadedFile } from '../../domain/email/email-attachment.js';
import { FILE_STORAGE, type FileStoragePort } from '../ports/file-storage.port.js';
import { CommunicationSettings, type EmailImageKind } from '../services/communication-settings.js';

export const MAX_EMAIL_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: readonly DetectedFileType[] = ['png', 'jpeg', 'gif', 'webp'];

export interface UploadEmailImageInput {
  kind: EmailImageKind;
  file: UploadedFile | undefined;
}

export interface UploadEmailImageOutput {
  kind: EmailImageKind;
  path: string;
  contentType: string;
  size: number;
}

/**
 * Stores the logo or promotional image used in e-mails (legacy
 * `api/upload_email_image.php`).
 *
 * Fixes the critical RCE (bug #1): the endpoint now requires an
 * administrator, the type is detected from the file content (PNG, JPEG,
 * GIF or WebP only; SVG and anything else is rejected) and the stored name
 * is fixed by the server (`email/email_<kind>.<ext>`), never taken from the
 * client. Images are embedded in e-mails as inline attachments.
 */
@Injectable()
export class UploadEmailImageUseCase implements UseCase<UploadEmailImageInput, UploadEmailImageOutput> {
  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly settings: CommunicationSettings,
  ) {}

  async execute({ kind, file }: UploadEmailImageInput): Promise<UploadEmailImageOutput> {
    Guard.oneOf(kind, ['logo', 'promo'] as const, 'tipo de imagen');
    if (!file || file.content.length === 0) {
      throw new BusinessRuleViolationError('No se recibió una imagen válida.', 'IMAGE_REQUIRED');
    }
    if (file.content.length > MAX_EMAIL_IMAGE_BYTES) {
      throw new BusinessRuleViolationError('La imagen es muy grande (máx 2MB).', 'IMAGE_TOO_LARGE');
    }
    const type = detectFileType(file.content);
    if (!type || !IMAGE_TYPES.includes(type)) {
      throw new BusinessRuleViolationError('Formato no permitido. Usa PNG, JPG, GIF o WebP.', 'IMAGE_TYPE_NOT_ALLOWED');
    }

    const { extension, mime } = FILE_TYPE_INFO[type];
    const path = `email/email_${kind}.${extension}`;
    await this.storage.save(path, file.content);
    await this.settings.saveEmailImagePath(kind, path);
    return { kind, path, contentType: mime, size: file.content.length };
  }
}
