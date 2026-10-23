import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ExternalServiceError } from '../../../../shared/domain/domain-error.js';
import { PhoneNumber } from '../../domain/whatsapp/phone-number.js';
import {
  WHATSAPP_TEMPLATE_REPOSITORY,
  type WhatsAppTemplateRepository,
} from '../../domain/whatsapp/whatsapp-template.repository.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import { requireUsableTemplate } from './usable-template.js';

export interface SendSingleWhatsAppInput {
  actor: AuthenticatedActor;
  phone: string;
  templateName: string;
  variables: string[];
}

export interface SendSingleWhatsAppOutput {
  phone: string;
  messageId: string;
}

/**
 * Sends one template message to a number (legacy `whatsapp/index.php`
 * `action=send_single`). The number and the variables are validated before
 * calling Meta; the attempt is logged either way.
 */
@Injectable()
export class SendSingleWhatsAppUseCase implements UseCase<SendSingleWhatsAppInput, SendSingleWhatsAppOutput> {
  constructor(
    @Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository,
    private readonly settings: CommunicationSettings,
    private readonly delivery: WhatsAppDelivery,
  ) {}

  async execute(input: SendSingleWhatsAppInput): Promise<SendSingleWhatsAppOutput> {
    const phone = PhoneNumber.create(input.phone);
    const credentials = await this.settings.requireWhatsApp();
    const template = await requireUsableTemplate(this.templates, input.templateName);
    template.compose(input.variables); // validates the variables before sending

    const outcome = await this.delivery.deliver(credentials, {
      phone: phone.digits,
      template,
      values: input.variables,
      studentId: null,
      createdBy: input.actor.userId,
    });
    if (!outcome.sent) throw new ExternalServiceError('WhatsApp', outcome.error ?? 'Error desconocido');
    return { phone: outcome.phone, messageId: outcome.messageId as string };
  }
}
