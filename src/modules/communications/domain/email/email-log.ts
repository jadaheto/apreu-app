import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { htmlToPlainText, truncate } from '../common/text.js';

export const EMAIL_TYPES = ['aviso', 'factura_cobro', 'factura_dian', 'otro'] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMAIL_STATUSES = ['sent', 'failed', 'pending'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Characters of plain text kept in `body_preview` (RN-COM-06). */
export const EMAIL_PREVIEW_LENGTH = 200;

export interface EmailLogProps {
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyPreview: string | null;
  type: EmailType;
  status: EmailStatus;
  errorMessage: string | null;
  createdBy: number | null;
  createdAt: Date | null;
}

export interface RecordEmailInput {
  toEmail: string;
  toName?: string | null;
  subject: string;
  /** HTML or text body; only a plain-text preview is stored. */
  body: string;
  type: EmailType;
  createdBy: number | null;
}

/**
 * One delivery attempt of an e-mail (`email_log`, RN-COM-06). Every notice,
 * billing notice, invoice and transactional e-mail produces an entry, also
 * those sent from the WhatsApp screen (legacy bug #13).
 */
export class EmailLog extends Entity<EmailLogProps> {
  private constructor(id: EntityId, props: EmailLogProps) {
    super(id, props);
  }

  /** Successful delivery. */
  static sent(input: RecordEmailInput, at: Date): EmailLog {
    return EmailLog.build(input, 'sent', null, at);
  }

  /**
   * Failed delivery with the error of *this* attempt (legacy bug #6 logged
   * the exception of a previous iteration).
   */
  static failed(input: RecordEmailInput, error: string, at: Date): EmailLog {
    return EmailLog.build(input, 'failed', truncate(error || 'Error desconocido', 1000), at);
  }

  static restore(id: number, props: EmailLogProps): EmailLog {
    return new EmailLog(id, { ...props });
  }

  private static build(input: RecordEmailInput, status: EmailStatus, error: string | null, at: Date): EmailLog {
    Guard.againstEmpty(input.toEmail, 'destinatario');
    Guard.oneOf(input.type, EMAIL_TYPES, 'tipo de correo');
    return new EmailLog(null, {
      toEmail: truncate(input.toEmail.trim(), 200),
      toName: input.toName ? truncate(input.toName.trim(), 200) : null,
      subject: truncate(input.subject.trim(), 255),
      bodyPreview: truncate(htmlToPlainText(input.body), EMAIL_PREVIEW_LENGTH) || null,
      type: input.type,
      status,
      errorMessage: error,
      createdBy: input.createdBy,
      createdAt: at,
    });
  }

  get toEmail(): string {
    return this.props.toEmail;
  }
  get toName(): string | null {
    return this.props.toName;
  }
  get subject(): string {
    return this.props.subject;
  }
  get bodyPreview(): string | null {
    return this.props.bodyPreview;
  }
  get type(): EmailType {
    return this.props.type;
  }
  get status(): EmailStatus {
    return this.props.status;
  }
  get errorMessage(): string | null {
    return this.props.errorMessage;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
