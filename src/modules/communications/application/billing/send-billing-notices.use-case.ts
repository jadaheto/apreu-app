import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { BillingMonth } from '../../domain/common/billing-month.js';
import { formatCop, formatDay } from '../../domain/common/format.js';
import {
  BILLING_CHARGES,
  type BillingChargesPort,
  type ChargeNotice,
} from '../../domain/directory/billing-charges.port.js';
import {
  WHATSAPP_TEMPLATE_REPOSITORY,
  type WhatsAppTemplateRepository,
} from '../../domain/whatsapp/whatsapp-template.repository.js';
import { BUILT_IN_TEMPLATES } from '../../domain/whatsapp/whatsapp-template.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { summarize } from '../services/delivery-summary.js';
import { EmailDelivery } from '../services/email-delivery.js';
import { EmailTemplates } from '../services/email-templates.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import type { DeliverySummary } from '../views.js';
import { requireUsableTemplate } from '../whatsapp/usable-template.js';

export const BILLING_CHANNELS = ['email', 'whatsapp'] as const;
export type BillingChannel = (typeof BILLING_CHANNELS)[number];

export interface SendBillingNoticesInput {
  actor: AuthenticatedActor;
  month: string;
  conceptId?: number;
  channels: BillingChannel[];
  /** WhatsApp template with 5 variables; defaults to `cobro_mensual` (legacy bug #12 ignored the selection). */
  templateName?: string;
}

export interface BillingNoticesResult {
  charges: number;
  email: DeliverySummary | null;
  whatsapp: DeliverySummary | null;
}

/**
 * Notifies every pending charge of a month by e-mail and/or WhatsApp
 * (legacy `email/send_billing.php` and `whatsapp/index.php?action=send_billing`,
 * RN-COM-07/08).
 *
 * - One message per charge; guardians without e-mail/mobile are skipped and counted.
 * - WhatsApp variables: `[guardian | "Acudiente", concept, amount, due d/m/Y, student code]`.
 * - E-mails are always logged in `email_log`, also when sent from the
 *   WhatsApp screen (bug #13). Each channel is rate limited.
 */
@Injectable()
export class SendBillingNoticesUseCase implements UseCase<SendBillingNoticesInput, BillingNoticesResult> {
  constructor(
    @Inject(BILLING_CHARGES) private readonly charges: BillingChargesPort,
    @Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository,
    private readonly settings: CommunicationSettings,
    private readonly emails: EmailDelivery,
    private readonly whatsapp: WhatsAppDelivery,
    private readonly dispatcher: RateLimitedDispatcher,
  ) {}

  async execute(input: SendBillingNoticesInput): Promise<BillingNoticesResult> {
    const channels = new Set(input.channels);
    if (channels.size === 0) {
      throw new BusinessRuleViolationError('Selecciona al menos un canal de envío.', 'CHANNEL_REQUIRED');
    }
    const month = BillingMonth.create(input.month);
    const charges = await this.charges.pendingCharges({
      from: month.firstDay,
      to: month.lastDay,
      conceptId: input.conceptId,
    });
    if (charges.length === 0) {
      throw new BusinessRuleViolationError(
        `No hay cargos pendientes para el mes ${month.toString()}.`,
        'NO_PENDING_CHARGES',
      );
    }

    return {
      charges: charges.length,
      email: channels.has('email') ? await this.sendEmails(charges, input.actor.userId) : null,
      whatsapp: channels.has('whatsapp')
        ? await this.sendWhatsApp(charges, input.actor.userId, input.templateName ?? BUILT_IN_TEMPLATES.billing)
        : null,
    };
  }

  private async sendEmails(charges: ChargeNotice[], userId: number): Promise<DeliverySummary> {
    const account = await this.settings.requireSmtp('general');
    const { schoolName } = await this.settings.branding();
    const reachable = charges.filter((charge) => charge.guardianEmail);
    const outcomes = await this.dispatcher.run(reachable, await this.settings.deliveryPolicy('email'), (charge) =>
      this.emails.deliver(account, {
        to: { email: charge.guardianEmail as string, name: charge.guardianName },
        content: EmailTemplates.billingNotice({
          studentName: charge.studentName,
          studentCode: charge.studentCode,
          conceptName: charge.conceptName,
          amount: charge.netAmount,
          dueDate: charge.dueDate,
          schoolName,
        }),
        type: 'factura_cobro',
        createdBy: userId,
      }),
    );
    return summarize(outcomes, (index) => reachable[index].guardianEmail as string, charges.length - reachable.length);
  }

  private async sendWhatsApp(charges: ChargeNotice[], userId: number, templateName: string): Promise<DeliverySummary> {
    const credentials = await this.settings.requireWhatsApp();
    const template = await requireUsableTemplate(this.templates, templateName, 5);
    const reachable = charges.filter((charge) => charge.guardianMobile);
    const outcomes = await this.dispatcher.run(reachable, await this.settings.deliveryPolicy('whatsapp'), (charge) =>
      this.whatsapp.deliver(credentials, {
        phone: charge.guardianMobile as string,
        template,
        values: [
          charge.guardianName || 'Acudiente',
          charge.conceptName || 'Mensualidad',
          formatCop(charge.netAmount),
          formatDay(charge.dueDate),
          charge.studentCode,
        ],
        studentId: charge.studentId,
        createdBy: userId,
      }),
    );
    return summarize(outcomes, (index) => reachable[index].guardianMobile as string, charges.length - reachable.length);
  }
}
