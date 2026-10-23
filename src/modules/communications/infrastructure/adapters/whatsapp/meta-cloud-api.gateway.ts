import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import type { WhatsAppCredentials, WhatsAppGatewayPort } from '../../../application/ports/whatsapp-gateway.port.js';
import type { ComposedTemplateMessage } from '../../../domain/whatsapp/whatsapp-template.js';

export const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 15_000;

type FetchFn = typeof fetch;

interface MetaResponse {
  messages?: { id?: string }[];
  error?: { message?: string; error_data?: { details?: string } };
}

/**
 * WhatsApp Cloud API adapter (Graph v21.0), replacing the cURL code of
 * `whatsapp/send.php`. Sends the template in its own language and adds the
 * image header component when the template has one (legacy bug #10).
 */
export class MetaCloudApiGateway implements WhatsAppGatewayPort {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async sendTemplate(credentials: WhatsAppCredentials, to: string, message: ComposedTemplateMessage): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFn(`${GRAPH_API_URL}/${encodeURIComponent(credentials.phoneNumberId)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(MetaCloudApiGateway.payload(to, message)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new ExternalServiceError('WhatsApp', `No fue posible conectar con Meta: ${(error as Error).message}`);
    }

    const body = (await response.json().catch(() => ({}))) as MetaResponse;
    const messageId = body.messages?.[0]?.id;
    if (!response.ok || !messageId) {
      const detail = [body.error?.message, body.error?.error_data?.details].filter(Boolean).join(': ');
      throw new ExternalServiceError('WhatsApp', detail || `Meta respondió con código HTTP ${response.status}.`);
    }
    return messageId;
  }

  /** Request body of `POST /{phone-number-id}/messages`. */
  static payload(to: string, message: ComposedTemplateMessage): Record<string, unknown> {
    const components: Record<string, unknown>[] = [];
    if (message.headerImageUrl) {
      components.push({ type: 'header', parameters: [{ type: 'image', image: { link: message.headerImageUrl } }] });
    }
    if (message.bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: message.bodyParameters.map((text) => ({ type: 'text', text })),
      });
    }
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name: message.name, language: { code: message.language }, components },
    };
  }
}
