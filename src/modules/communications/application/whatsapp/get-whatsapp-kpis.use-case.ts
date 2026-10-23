import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  WHATSAPP_LOG_REPOSITORY,
  type WhatsAppKpis,
  type WhatsAppLogRepository,
} from '../../domain/whatsapp/whatsapp-log.repository.js';
import { CommunicationSettings } from '../services/communication-settings.js';

export interface WhatsAppDashboard {
  /** Token and phone id are configured ("API Conectada"). */
  configured: boolean;
  totals: WhatsAppKpis;
}

/** Counters by status and configuration state of the WhatsApp dashboard. */
@Injectable()
export class GetWhatsAppKpisUseCase implements UseCase<void, WhatsAppDashboard> {
  constructor(
    @Inject(WHATSAPP_LOG_REPOSITORY) private readonly logs: WhatsAppLogRepository,
    private readonly settings: CommunicationSettings,
  ) {}

  async execute(): Promise<WhatsAppDashboard> {
    const [{ credentials }, totals] = await Promise.all([this.settings.whatsapp(), this.logs.kpis()]);
    return { configured: credentials !== null, totals };
  }
}
