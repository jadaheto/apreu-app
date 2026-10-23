import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  BusinessRuleViolationError,
  ForbiddenError,
  UnauthorizedError,
} from '../../../../shared/domain/domain-error.js';
import { WHATSAPP_LOG_REPOSITORY, type WhatsAppLogRepository } from '../../domain/whatsapp/whatsapp-log.repository.js';
import { WHATSAPP_STATUSES, type WhatsAppStatus } from '../../domain/whatsapp/whatsapp-log.js';
import { WEBHOOK_SIGNATURE, type WebhookSignaturePort } from '../ports/webhook-signature.port.js';
import { CommunicationSettings } from '../services/communication-settings.js';

export interface VerifyWebhookInput {
  mode: string | undefined;
  token: string | undefined;
  challenge: string | undefined;
}

/**
 * Subscription handshake of Meta's webhook: echoes `hub.challenge` when
 * `hub.mode=subscribe` and the verify token matches the tenant setting
 * `whatsapp_webhook_verify_token`.
 */
@Injectable()
export class VerifyWhatsAppWebhookUseCase implements UseCase<VerifyWebhookInput, string> {
  constructor(private readonly settings: CommunicationSettings) {}

  async execute({ mode, token, challenge }: VerifyWebhookInput): Promise<string> {
    const { verifyToken } = await this.settings.whatsapp();
    if (mode !== 'subscribe' || !verifyToken || !token || token !== verifyToken || !challenge) {
      throw new ForbiddenError('Verificación del webhook de WhatsApp rechazada.');
    }
    return challenge;
  }
}

export interface StatusWebhookInput {
  /** Exact bytes received; required to verify the signature. */
  rawBody: Buffer | undefined;
  signature: string | undefined;
}

export interface StatusWebhookResult {
  receipts: number;
  updated: number;
}

interface MetaStatus {
  id?: unknown;
  status?: unknown;
  errors?: { title?: string; message?: string; error_data?: { details?: string } }[];
}

/**
 * Applies the delivery receipts sent by Meta (`statuses[]` of the
 * `messages` field) to `whatsapp_log` (analysis §6.2; legacy bug #16 had no
 * webhook so `delivered/read` never happened).
 *
 * Requests must be signed with the app secret (`X-Hub-Signature-256`);
 * unsigned or tampered requests are rejected.
 */
@Injectable()
export class HandleWhatsAppStatusWebhookUseCase implements UseCase<StatusWebhookInput, StatusWebhookResult> {
  constructor(
    @Inject(WHATSAPP_LOG_REPOSITORY) private readonly logs: WhatsAppLogRepository,
    @Inject(WEBHOOK_SIGNATURE) private readonly signatures: WebhookSignaturePort,
    private readonly settings: CommunicationSettings,
  ) {}

  async execute({ rawBody, signature }: StatusWebhookInput): Promise<StatusWebhookResult> {
    const { appSecret } = await this.settings.whatsapp();
    if (!appSecret) throw new ForbiddenError('El webhook de WhatsApp no está configurado.');
    if (!rawBody || !this.signatures.isValid(rawBody, signature, appSecret)) {
      throw new UnauthorizedError('Firma del webhook de WhatsApp inválida.');
    }

    const receipts = this.extractStatuses(rawBody);
    let updated = 0;
    for (const receipt of receipts) {
      const log = await this.logs.findByMessageId(receipt.messageId);
      if (log?.applyReceipt(receipt.status, receipt.error)) {
        await this.logs.save(log);
        updated++;
      }
    }
    return { receipts: receipts.length, updated };
  }

  private extractStatuses(rawBody: Buffer): { messageId: string; status: WhatsAppStatus; error: string | null }[] {
    let payload: { entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[] };
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BusinessRuleViolationError('Cuerpo del webhook inválido.', 'INVALID_WEBHOOK_PAYLOAD');
    }
    const statuses = (payload.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []),
    );
    return statuses.flatMap((item) => {
      const status = item.status as WhatsAppStatus;
      if (typeof item.id !== 'string' || !WHATSAPP_STATUSES.includes(status)) return [];
      const error = item.errors?.[0];
      const detail = error
        ? [error.title ?? error.message, error.error_data?.details].filter(Boolean).join(': ')
        : null;
      return [{ messageId: item.id, status, error: detail || null }];
    });
  }
}
