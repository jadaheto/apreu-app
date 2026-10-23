import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EVENT_BUS,
  type EventBusPort,
  type IntegrationEvent,
} from '../../../../shared/application/ports/event-bus.port.js';
import { NotifyBulletinsGeneratedUseCase } from '../../application/events/notify-bulletins-generated.use-case.js';
import { SendInvoiceEmailUseCase } from '../../application/events/send-invoice-email.use-case.js';
import { CommunicationSettings } from '../../application/services/communication-settings.js';

/** `e-invoicing.invoice-accepted` payload (docs/eventos-integracion.md). */
export interface InvoiceAcceptedPayload {
  dianInvoiceId: number;
  number: string;
  cufe: string;
  paymentId: number | null;
  total: number;
}

/** `academic.bulletins-generated` payload. */
export interface BulletinsGeneratedPayload {
  periodId: number;
  studentIds: number[];
}

export const INVOICE_ACCEPTED = 'e-invoicing.invoice-accepted';
export const BULLETINS_GENERATED = 'academic.bulletins-generated';

/**
 * Optional reactions of this context to other contexts' events. They never
 * break the publisher: missing configuration (SMTP) or contact data simply
 * skips the delivery, and any error is logged as a warning.
 */
@Injectable()
export class CommunicationsEventSubscriber {
  private readonly logger = new Logger(CommunicationsEventSubscriber.name);

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
    private readonly settings: CommunicationSettings,
    private readonly sendInvoice: SendInvoiceEmailUseCase,
    private readonly bulletins: NotifyBulletinsGeneratedUseCase,
  ) {}

  register(): void {
    this.bus.subscribe(INVOICE_ACCEPTED, (event: IntegrationEvent<InvoiceAcceptedPayload>) =>
      this.onInvoiceAccepted(event.payload),
    );
    this.bus.subscribe(BULLETINS_GENERATED, (event: IntegrationEvent<BulletinsGeneratedPayload>) =>
      this.onBulletinsGenerated(event.payload),
    );
  }

  /** E-mails the accepted invoice to the buyer when an SMTP account is configured. */
  async onInvoiceAccepted(payload: InvoiceAcceptedPayload): Promise<void> {
    await this.safely(INVOICE_ACCEPTED, async () => {
      if (!(await this.settings.smtp('invoicing'))) {
        this.logger.log(`Factura ${payload.number}: SMTP no configurado, no se envía por correo.`);
        return;
      }
      await this.sendInvoice.execute({ dianInvoiceId: payload.dianInvoiceId, userId: null });
    });
  }

  /** Notifies students (in-app) and guardians (e-mail, if configured) that report cards are available. */
  async onBulletinsGenerated(payload: BulletinsGeneratedPayload): Promise<void> {
    await this.safely(BULLETINS_GENERATED, () =>
      this.bulletins
        .execute({ periodId: payload.periodId, studentIds: payload.studentIds ?? [] })
        .then(() => undefined),
    );
  }

  private async safely(eventName: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(`No se pudo procesar "${eventName}": ${(error as Error).message}`);
    }
  }
}
