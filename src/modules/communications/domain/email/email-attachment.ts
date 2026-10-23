import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { type DetectedFileType, detectFileType } from '../common/file-signature.js';

/** A file attached to an e-mail. `contentId` marks inline images referenced as `cid:` from the HTML. */
export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  contentId?: string;
}

/** A file as uploaded by the user, before validation. */
export interface UploadedFile {
  originalName: string;
  size: number;
  content: Buffer;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Allowed extensions and the binary signature each one must have. */
const ALLOWED: Record<string, { type: DetectedFileType; mime: string }> = {
  pdf: { type: 'pdf', mime: 'application/pdf' },
  doc: { type: 'ole', mime: 'application/msword' },
  xls: { type: 'ole', mime: 'application/vnd.ms-excel' },
  docx: { type: 'zip', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { type: 'zip', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  jpg: { type: 'jpeg', mime: 'image/jpeg' },
  jpeg: { type: 'jpeg', mime: 'image/jpeg' },
  png: { type: 'png', mime: 'image/png' },
  gif: { type: 'gif', mime: 'image/gif' },
};

export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.keys(ALLOWED);

/**
 * Server-side validation of notice attachments (legacy bug #7: the 5 files /
 * 10 MB / extension limits were only enforced by the browser). The content
 * must match the extension's binary signature and the file name is reduced to
 * a safe subset of characters (no header injection, no paths).
 */
export const toEmailAttachments = (files: readonly UploadedFile[]): EmailAttachment[] => {
  if (files.length > MAX_ATTACHMENTS) {
    throw new BusinessRuleViolationError(`Máximo ${MAX_ATTACHMENTS} archivos adjuntos.`, 'TOO_MANY_ATTACHMENTS');
  }
  return files.map((file) => {
    const filename = safeFileName(file.originalName);
    if (file.size > MAX_ATTACHMENT_BYTES || file.content.length > MAX_ATTACHMENT_BYTES) {
      throw new BusinessRuleViolationError(`El archivo "${filename}" supera 10 MB.`, 'ATTACHMENT_TOO_LARGE');
    }
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    const rule = ALLOWED[extension];
    if (!rule || filename.indexOf('.') <= 0 || detectFileType(file.content) !== rule.type) {
      throw new BusinessRuleViolationError(
        `El archivo "${filename}" no es un ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')} válido.`,
        'ATTACHMENT_TYPE_NOT_ALLOWED',
      );
    }
    return { filename, contentType: rule.mime, content: file.content };
  });
};

/** Keeps letters, digits, dot, dash, underscore and spaces; strips any path. */
export const safeFileName = (name: string): string => {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(-120);
  return cleaned || 'archivo';
};
