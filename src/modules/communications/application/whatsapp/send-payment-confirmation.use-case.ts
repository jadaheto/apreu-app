import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  BusinessRuleViolationError,
  ExternalServiceError,
  NotFoundError,
} from '../../../../shared/domain/domain-error.js';
import { formatCop } from '../../domain/common/format.js';
import { PAYMENT_LOOKUP, type PaymentLookupPort } from '../../domain/directory/payment-lookup.port.js';
import {
  WHATSAPP_TEMPLATE_REPOSITORY,
  type WhatsAppTemplateRepository,
} from '../../domain/whatsapp/whatsapp-template.repository.js';
import { BUILT_IN_TEMPLATES } from '../../domain/whatsapp/whatsapp-template.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import { requireUsableTemplate } from './usable-template.js';

export interface SendPaymentConfirmationInput {
  paymentId: number;
  /** User who requested the confirmation. */
  userId: number | null;
}

export interface SendPaymentConfirmationOutput {
  phone: string;
  messageId: string;
}

/**
 * Confirms a payment to the primary guardian by WhatsApp (legacy
 * `action=send_payment_confirm`, RN-COM-09) with the `pago_confirmado`
 * template `[guardian, amount, student, receipt | "#id"]`. The legacy action
 * had no UI (bug #14); here it is exposed as an endpoint.
 */
@Injectable()
export class SendPaymentConfirmationUseCase implements UseCase<
  SendPaymentConfirmationInput,
  SendPaymentConfirmationOutput
> {
  constructor(
    @Inject(PAYMENT_LOOKUP) private readonly payments: PaymentLookupPort,
    @Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository,
    private readonly settings: CommunicationSettings,
    private readonly delivery: WhatsAppDelivery,
  ) {}

  async execute({ paymentId, userId }: SendPaymentConfirmationInput): Promise<SendPaymentConfirmationOutput> {
    const payment = await this.payments.findForConfirmation(paymentId);
    if (!payment) throw new NotFoundError('Pago', paymentId);
    if (!payment.guardianMobile) {
      throw new BusinessRuleViolationError('Acudiente sin número móvil.', 'GUARDIAN_WITHOUT_MOBILE');
    }
    const credentials = await this.settings.requireWhatsApp();
    const template = await requireUsableTemplate(this.templates, BUILT_IN_TEMPLATES.paymentConfirmation, 4);

    const outcome = await this.delivery.deliver(credentials, {
      phone: payment.guardianMobile,
      template,
      values: [
        payment.guardianName || 'Acudiente',
        formatCop(payment.amount),
        payment.studentName,
        payment.receiptNumber || `#${payment.paymentId}`,
      ],
      studentId: payment.studentId,
      createdBy: userId,
    });
    if (!outcome.sent) throw new ExternalServiceError('WhatsApp', outcome.error ?? 'Error desconocido');
    return { phone: outcome.phone, messageId: outcome.messageId as string };
  }
}
