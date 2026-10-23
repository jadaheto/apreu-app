import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { assertDay, formatDay } from '../../domain/common/format.js';
import { RECIPIENT_DIRECTORY, type RecipientDirectoryPort } from '../../domain/directory/recipient-directory.port.js';
import {
  WHATSAPP_TEMPLATE_REPOSITORY,
  type WhatsAppTemplateRepository,
} from '../../domain/whatsapp/whatsapp-template.repository.js';
import { BUILT_IN_TEMPLATES } from '../../domain/whatsapp/whatsapp-template.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { summarize } from '../services/delivery-summary.js';
import { RateLimitedDispatcher } from '../services/rate-limited-dispatcher.js';
import { WhatsAppDelivery } from '../services/whatsapp-delivery.js';
import type { DeliverySummary } from '../views.js';
import { requireUsableTemplate } from './usable-template.js';

export interface NotifyEventInput {
  actor: AuthenticatedActor;
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
  details?: string | null;
}

/**
 * Announces a school event to every guardian with an active student and a
 * mobile number (legacy `action=send_event`, RN-COM-10), using the
 * `evento_colegio` template with `[date d/m/Y, name, details]`.
 */
@Injectable()
export class NotifyEventUseCase implements UseCase<NotifyEventInput, DeliverySummary> {
  constructor(
    @Inject(RECIPIENT_DIRECTORY) private readonly directory: RecipientDirectoryPort,
    @Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository,
    private readonly settings: CommunicationSettings,
    private readonly delivery: WhatsAppDelivery,
    private readonly dispatcher: RateLimitedDispatcher,
  ) {}

  async execute(input: NotifyEventInput): Promise<DeliverySummary> {
    const name = input.name?.trim() ?? '';
    if (!name || !input.date) {
      throw new BusinessRuleViolationError('Fecha y nombre del evento son requeridos.', 'EVENT_DATA_REQUIRED');
    }
    assertDay(input.date, 'fecha del evento');
    Guard.againstMaxLength(name, 200, 'nombre del evento');
    const details = input.details?.trim() || '-';
    Guard.againstMaxLength(details, 600, 'detalles');

    const credentials = await this.settings.requireWhatsApp();
    const template = await requireUsableTemplate(this.templates, BUILT_IN_TEMPLATES.event, 3);
    const guardians = await this.directory.guardianMobiles();
    if (guardians.length === 0) {
      throw new BusinessRuleViolationError('No hay acudientes con número móvil registrado.', 'NO_RECIPIENTS');
    }

    const values = [formatDay(input.date), name, details];
    const outcomes = await this.dispatcher.run(guardians, await this.settings.deliveryPolicy('whatsapp'), (guardian) =>
      this.delivery.deliver(credentials, {
        phone: guardian.mobile,
        template,
        values,
        studentId: null,
        createdBy: input.actor.userId,
      }),
    );
    return summarize(outcomes, (index) => outcomes[index].phone);
  }
}
