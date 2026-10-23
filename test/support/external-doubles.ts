import type {
  AiAssistantPort,
  AiEndpoint,
  AssistantRequest,
  MarketingGeneratorPort,
  MarketingRequest,
} from '../../src/modules/communications/application/ports/ai-gateway.port.js';
import type {
  EmailSenderPort,
  OutgoingEmail,
  SmtpSettings,
} from '../../src/modules/communications/application/ports/email-sender.port.js';
import type {
  WhatsAppCredentials,
  WhatsAppGatewayPort,
} from '../../src/modules/communications/application/ports/whatsapp-gateway.port.js';
import type { ComposedTemplateMessage } from '../../src/modules/communications/domain/whatsapp/whatsapp-template.js';
import type { DianGatewayPort } from '../../src/modules/e-invoicing/application/ports/dian-gateway.port.js';
import type { DianEnvironment } from '../../src/modules/e-invoicing/domain/catalogs.js';
import type { DianResponse } from '../../src/modules/e-invoicing/domain/dian-response.js';

/** DIAN web service double: accepts every document and records the calls. */
export class FakeDianGateway implements DianGatewayPort {
  readonly calls: { operation: string; zipFileName: string }[] = [];

  private accepted(trackId: string | null): DianResponse {
    return {
      statusCode: '00',
      statusDescription: 'Procesado Correctamente.',
      isValid: true,
      messages: [],
      trackId,
      applicationResponse: null,
      applicationResponseCode: '02',
    };
  }

  async sendBillSync(_environment: DianEnvironment, zipFileName: string): Promise<DianResponse> {
    this.calls.push({ operation: 'SendBillSync', zipFileName });
    return this.accepted(null);
  }

  async sendTestSetAsync(_environment: DianEnvironment, zipFileName: string): Promise<DianResponse> {
    this.calls.push({ operation: 'SendTestSetAsync', zipFileName });
    return { ...this.accepted('e2e-zip-key'), statusCode: null, isValid: null, applicationResponseCode: null };
  }

  async getStatusZip(_environment: DianEnvironment, trackId: string): Promise<DianResponse> {
    this.calls.push({ operation: 'GetStatusZip', zipFileName: trackId });
    return this.accepted(trackId);
  }
}

/** SMTP double: keeps the messages instead of sending them. */
export class FakeEmailSender implements EmailSenderPort {
  readonly sent: { account: SmtpSettings; message: OutgoingEmail }[] = [];

  async send(account: SmtpSettings, message: OutgoingEmail): Promise<void> {
    this.sent.push({ account, message });
  }
}

/** WhatsApp Cloud API double. */
export class FakeWhatsAppGateway implements WhatsAppGatewayPort {
  readonly sent: { to: string; message: ComposedTemplateMessage }[] = [];

  async sendTemplate(_credentials: WhatsAppCredentials, to: string, message: ComposedTemplateMessage): Promise<string> {
    this.sent.push({ to, message });
    return `wamid.e2e.${this.sent.length}`;
  }
}

/** n8n (AI assistant and marketing generator) double. */
export class FakeAiGateway implements AiAssistantPort, MarketingGeneratorPort {
  readonly questions: AssistantRequest[] = [];

  async ask(_endpoint: AiEndpoint, request: AssistantRequest): Promise<string> {
    this.questions.push(request);
    return `Respuesta de prueba a: ${request.chatInput}`;
  }

  async generate(_endpoint: AiEndpoint, request: MarketingRequest): Promise<string> {
    return `Contenido de prueba (${request.tipo})`;
  }
}
