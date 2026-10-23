import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import type {
  AiAssistantPort,
  AiEndpoint,
  AssistantRequest,
  MarketingGeneratorPort,
  MarketingRequest,
} from '../../../application/ports/ai-gateway.port.js';

type FetchFn = typeof fetch;

const CHAT_TIMEOUT_MS = 30_000;
const MARKETING_TIMEOUT_MS = 60_000;
/** Answer fields tried in order (legacy `api_ai_handler.php` / `marketing/generate.php`). */
const CHAT_FIELDS = ['output', 'response', 'text', 'message'];
const MARKETING_FIELDS = ['output', 'response', 'text', 'mensaje'];

/**
 * Proxy to the n8n flows that host the LLM, memory and prompts (analysis
 * §1.1). Sends JSON, optionally with a bearer token, and extracts the text
 * answer with the legacy rules: first array element, then the first present
 * field, otherwise the raw body.
 */
export class N8nWebhookClient implements AiAssistantPort, MarketingGeneratorPort {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  ask(endpoint: AiEndpoint, request: AssistantRequest): Promise<string> {
    return this.post(endpoint, request, CHAT_TIMEOUT_MS, CHAT_FIELDS, 'Asistente IA');
  }

  generate(endpoint: AiEndpoint, request: MarketingRequest): Promise<string> {
    return this.post(endpoint, request, MARKETING_TIMEOUT_MS, MARKETING_FIELDS, 'Marketing IA');
  }

  private async post(
    endpoint: AiEndpoint,
    payload: object,
    timeoutMs: number,
    fields: string[],
    service: string,
  ): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (endpoint.authToken) headers.Authorization = `Bearer ${endpoint.authToken}`;

    let response: Response;
    try {
      response = await this.fetchFn(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ExternalServiceError(service, `Error de conexión con n8n: ${(error as Error).message}`);
    }
    if (!response.ok) {
      throw new ExternalServiceError(
        service,
        `El webhook respondió con código HTTP ${response.status}. Intenta más tarde o verifica la URL en Configuración.`,
      );
    }
    const answer = N8nWebhookClient.extract(await response.text(), fields);
    if (!answer) throw new ExternalServiceError(service, 'El webhook devolvió una respuesta vacía.');
    return answer;
  }

  /** Applies the legacy extraction rules to the response body. */
  static extract(raw: string, fields: string[]): string {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return raw.trim();
    }
    if (Array.isArray(data) && data.length > 0) data = data[0];
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const field = fields.find((name) => record[name] !== undefined && record[name] !== null);
      if (field === undefined) return JSON.stringify(data);
      const value = record[field];
      return typeof value === 'string' ? value.trim() : JSON.stringify(value);
    }
    return typeof data === 'string' ? data.trim() : raw.trim();
  }
}
