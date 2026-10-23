import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { truncate } from '../common/text.js';

export const WHATSAPP_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const;
export type WhatsAppStatus = (typeof WHATSAPP_STATUSES)[number];

const PROGRESS: Record<Exclude<WhatsAppStatus, 'failed'>, number> = { sent: 1, delivered: 2, read: 3 };

export interface WhatsAppLogProps {
  studentId: number | null;
  templateName: string | null;
  /** Normalized digits (legacy bug #27 stored the raw input). */
  phone: string;
  status: WhatsAppStatus;
  waMessageId: string | null;
  /** Error text or provider response. */
  response: string | null;
  createdBy: number | null;
  createdAt: Date | null;
}

export interface RecordWhatsAppInput {
  studentId: number | null;
  templateName: string;
  phone: string;
  createdBy: number | null;
}

/**
 * One WhatsApp delivery attempt (`whatsapp_log`, RN-COM-13). Its status moves
 * forward with the delivery receipts sent by Meta's webhook
 * (`sent → delivered → read`, or `failed`); the legacy system had no webhook
 * so `delivered/read` were never reached (bug #16).
 */
export class WhatsAppLog extends Entity<WhatsAppLogProps> {
  private constructor(id: EntityId, props: WhatsAppLogProps) {
    super(id, props);
  }

  static sent(input: RecordWhatsAppInput, messageId: string, at: Date): WhatsAppLog {
    return WhatsAppLog.build(input, 'sent', messageId, null, at);
  }

  static failed(input: RecordWhatsAppInput, error: string, at: Date): WhatsAppLog {
    return WhatsAppLog.build(input, 'failed', null, truncate(error || 'Error desconocido', 1000), at);
  }

  static restore(id: number, props: WhatsAppLogProps): WhatsAppLog {
    return new WhatsAppLog(id, { ...props });
  }

  private static build(
    input: RecordWhatsAppInput,
    status: WhatsAppStatus,
    messageId: string | null,
    response: string | null,
    at: Date,
  ): WhatsAppLog {
    return new WhatsAppLog(null, {
      studentId: input.studentId,
      templateName: truncate(input.templateName, 100),
      phone: truncate(input.phone, 20),
      status,
      waMessageId: messageId,
      response,
      createdBy: input.createdBy,
      createdAt: at,
    });
  }

  /**
   * Applies a delivery receipt. Receipts may arrive out of order, so the
   * status never moves backwards and `failed` is final.
   * @returns true when the status changed.
   */
  applyReceipt(status: WhatsAppStatus, error?: string | null): boolean {
    if (this.props.status === 'failed') return false;
    if (status === 'failed') {
      this.props.status = 'failed';
      this.props.response = truncate(error || 'Meta reportó la entrega como fallida.', 1000);
      return true;
    }
    if (PROGRESS[status] <= PROGRESS[this.props.status]) return false;
    this.props.status = status;
    return true;
  }

  get studentId(): number | null {
    return this.props.studentId;
  }
  get templateName(): string | null {
    return this.props.templateName;
  }
  get phone(): string {
    return this.props.phone;
  }
  get status(): WhatsAppStatus {
    return this.props.status;
  }
  get waMessageId(): string | null {
    return this.props.waMessageId;
  }
  get response(): string | null {
    return this.props.response;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
