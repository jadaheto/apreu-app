import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  BusinessRuleViolationError,
  ExternalServiceError,
  NotFoundError,
} from '../../../../shared/domain/domain-error.js';
import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import { detectFileType, FILE_TYPE_INFO } from '../../domain/common/file-signature.js';
import { INVOICE_LOOKUP, type InvoiceLookupPort } from '../../domain/directory/invoice-lookup.port.js';
import type { EmailAttachment } from '../../domain/email/email-attachment.js';
import { FILE_STORAGE, type FileStoragePort } from '../ports/file-storage.port.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { EmailTemplates } from '../services/email-templates.js';

/** Published after an electronic invoice was e-mailed to the buyer. */
export const INVOICE_EMAIL_SENT = 'communications.invoice-email-sent';

export interface InvoiceEmailSentPayload {
  dianInvoiceId: number;
  number: string;
  to: string;
  sentAt: string;
}

export interface SendInvoiceEmailInput {
  dianInvoiceId: number;
  /** User who requested it; `null` for the automatic delivery. */
  userId: number | null;
}

export interface SendInvoiceEmailOutput {
  to: string;
  number: string;
}

const LOGO_CID = 'logo@apreu';
const PROMO_CID = 'promo@apreu';

/**
 * E-mails an accepted electronic invoice to the buyer (legacy
 * `api/dian/send_invoice_email.php`) using the invoicing SMTP profile.
 *
 * Attaches the signed XML; the branded logo/promo images are embedded as
 * inline attachments. The attempt is logged as `factura_dian` and, on
 * success, `communications.invoice-email-sent` is published so e-invoicing
 * can mark `dian_invoices.email_sent` (this context never writes that table).
 */
@Injectable()
export class SendInvoiceEmailUseCase implements UseCase<SendInvoiceEmailInput, SendInvoiceEmailOutput> {
  constructor(
    @Inject(INVOICE_LOOKUP) private readonly invoices: InvoiceLookupPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly settings: CommunicationSettings,
    private readonly delivery: EmailDelivery,
  ) {}

  async execute({ dianInvoiceId, userId }: SendInvoiceEmailInput): Promise<SendInvoiceEmailOutput> {
    const invoice = await this.invoices.findById(dianInvoiceId);
    if (!invoice) throw new NotFoundError('Factura electrónica', dianInvoiceId);
    if (!invoice.customerEmail) {
      throw new BusinessRuleViolationError('El cliente no tiene email configurado.', 'CUSTOMER_WITHOUT_EMAIL');
    }
    const to = Email.create(invoice.customerEmail).toString();
    const account = await this.settings.requireSmtp('invoicing');
    const branding = await this.settings.branding();

    const logo = await this.inlineImage(branding.logoPath, LOGO_CID);
    const promo = await this.inlineImage(branding.promoPath, PROMO_CID);
    const attachments: EmailAttachment[] = [logo, promo].filter((item): item is EmailAttachment => item !== null);
    if (invoice.xmlContent) {
      attachments.push({
        filename: `${invoice.number}.xml`,
        contentType: 'application/xml',
        content: Buffer.from(invoice.xmlContent, 'utf8'),
      });
    }

    const content = EmailTemplates.invoice({
      number: invoice.number,
      customerName: invoice.customerName,
      total: invoice.total,
      issueDate: invoice.issueDate,
      businessName: branding.businessName,
      nit: branding.nit,
      resolutionNumber: branding.resolutionNumber,
      brandColor: branding.invoiceBrandColor,
      logoCid: logo ? LOGO_CID : null,
      promoCid: promo ? PROMO_CID : null,
    });
    const outcome = await this.delivery.deliver(account, {
      to: { email: to, name: invoice.customerName },
      content,
      attachments,
      type: 'factura_dian',
      createdBy: userId,
    });
    if (!outcome.sent) throw new ExternalServiceError('SMTP', outcome.error ?? 'Error desconocido');

    const sentAt = this.clock.now();
    await this.events.publish({
      name: INVOICE_EMAIL_SENT,
      occurredAt: sentAt,
      payload: {
        dianInvoiceId,
        number: invoice.number,
        to,
        sentAt: sentAt.toISOString(),
      } satisfies InvoiceEmailSentPayload,
    });
    return { to, number: invoice.number };
  }

  private async inlineImage(path: string | null, contentId: string): Promise<EmailAttachment | null> {
    if (!path) return null;
    const content = await this.storage.read(path);
    const type = content ? detectFileType(content) : null;
    if (!content || !type || !['png', 'jpeg', 'gif', 'webp'].includes(type)) return null;
    const { mime, extension } = FILE_TYPE_INFO[type];
    return { filename: `${contentId.split('@')[0]}.${extension}`, contentType: mime, content, contentId };
  }
}
