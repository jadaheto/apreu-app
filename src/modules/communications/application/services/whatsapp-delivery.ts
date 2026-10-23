import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { PhoneNumber } from '../../domain/whatsapp/phone-number.js';
import { WhatsAppLog } from '../../domain/whatsapp/whatsapp-log.js';
import { WHATSAPP_LOG_REPOSITORY, type WhatsAppLogRepository } from '../../domain/whatsapp/whatsapp-log.repository.js';
import type { WhatsAppTemplate } from '../../domain/whatsapp/whatsapp-template.js';
import {
  WHATSAPP_GATEWAY,
  type WhatsAppCredentials,
  type WhatsAppGatewayPort,
} from '../ports/whatsapp-gateway.port.js';

/** One template message to deliver and log. */
export interface WhatsAppJob {
  phone: string;
  template: WhatsAppTemplate;
  values: string[];
  studentId: number | null;
  createdBy: number | null;
}

export interface WhatsAppOutcome {
  phone: string;
  sent: boolean;
  messageId: string | null;
  error: string | null;
}

/**
 * Sends one template message and records it in `whatsapp_log` (RN-COM-11,
 * RN-COM-13). Invalid numbers and provider errors become `failed` entries;
 * nothing is thrown.
 */
@Injectable()
export class WhatsAppDelivery {
  constructor(
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(WHATSAPP_LOG_REPOSITORY) private readonly logs: WhatsAppLogRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async deliver(credentials: WhatsAppCredentials, job: WhatsAppJob): Promise<WhatsAppOutcome> {
    let phone = job.phone.trim();
    const entry = () => ({
      studentId: job.studentId,
      templateName: job.template.name,
      phone,
      createdBy: job.createdBy,
    });
    try {
      phone = PhoneNumber.create(job.phone).digits;
      const messageId = await this.gateway.sendTemplate(credentials, phone, job.template.compose(job.values));
      await this.logs.save(WhatsAppLog.sent(entry(), messageId, this.clock.now()));
      return { phone, sent: true, messageId, error: null };
    } catch (error) {
      const message = (error as Error).message;
      await this.logs.save(WhatsAppLog.failed(entry(), message, this.clock.now()));
      return { phone, sent: false, messageId: null, error: message };
    }
  }
}
