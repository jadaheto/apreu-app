import { ExternalServiceError } from '../../../shared/domain/domain-error.js';
import type {
  AiAssistantPort,
  AiEndpoint,
  AssistantRequest,
  MarketingGeneratorPort,
  MarketingRequest,
} from '../application/ports/ai-gateway.port.js';
import type { DelayPort } from '../application/ports/delay.port.js';
import type { EmailSenderPort, OutgoingEmail, SmtpSettings } from '../application/ports/email-sender.port.js';
import type { FileStoragePort } from '../application/ports/file-storage.port.js';
import type { HtmlSanitizerPort } from '../application/ports/html-sanitizer.port.js';
import type { SettingsStorePort } from '../application/ports/settings-store.port.js';
import type { WhatsAppCredentials, WhatsAppGatewayPort } from '../application/ports/whatsapp-gateway.port.js';
import type { ComposedTemplateMessage } from '../domain/whatsapp/whatsapp-template.js';

/** Settings table in memory. */
export class InMemorySettingsStore implements SettingsStorePort {
  constructor(readonly values: Record<string, string> = {}) {}

  async read(keys: readonly string[]): Promise<Record<string, string>> {
    return Object.fromEntries(keys.filter((key) => key in this.values).map((key) => [key, this.values[key]]));
  }

  async write(key: string, value: string): Promise<void> {
    this.values[key] = value;
  }
}

/** Settings with a working SMTP account and WhatsApp number. */
export const configuredSettings = (overrides: Record<string, string> = {}) =>
  new InMemorySettingsStore({
    smtp_general_password: 'secreta',
    whatsapp_token: 'token',
    whatsapp_phone_id: '123',
    school_name: 'Colegio Prueba',
    ...overrides,
  });

/** Records sent e-mails; addresses listed in `failFor` are rejected. */
export class FakeEmailSender implements EmailSenderPort {
  readonly sent: { account: SmtpSettings; message: OutgoingEmail }[] = [];
  readonly failFor = new Set<string>();

  async send(account: SmtpSettings, message: OutgoingEmail): Promise<void> {
    if (this.failFor.has(message.to.email))
      throw new ExternalServiceError('SMTP', `buzón ${message.to.email} rechazado`);
    this.sent.push({ account, message });
  }
}

/** Records template messages; numbers listed in `failFor` are rejected by "Meta". */
export class FakeWhatsAppGateway implements WhatsAppGatewayPort {
  readonly sent: { to: string; message: ComposedTemplateMessage }[] = [];
  readonly failFor = new Set<string>();

  async sendTemplate(_credentials: WhatsAppCredentials, to: string, message: ComposedTemplateMessage): Promise<string> {
    if (this.failFor.has(to)) throw new ExternalServiceError('WhatsApp', 'número no registrado');
    this.sent.push({ to, message });
    return `wamid.${this.sent.length}`;
  }
}

/** Returns immediately and records the requested pauses. */
export class InstantDelay implements DelayPort {
  readonly waits: number[] = [];
  async wait(ms: number): Promise<void> {
    this.waits.push(ms);
  }
}

/** Removes `<script>` blocks only; enough for use-case tests. */
export class FakeSanitizer implements HtmlSanitizerPort {
  sanitize(html: string): string {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
}

export class InMemoryFileStorage implements FileStoragePort {
  readonly files = new Map<string, Buffer>();
  async save(path: string, content: Buffer): Promise<void> {
    this.files.set(path, content);
  }
  async read(path: string): Promise<Buffer | null> {
    return this.files.get(path) ?? null;
  }
}

/** Answers with a fixed text and records the requests. */
export class FakeAi implements AiAssistantPort, MarketingGeneratorPort {
  readonly requests: { endpoint: AiEndpoint; payload: AssistantRequest | MarketingRequest }[] = [];
  answer = 'Respuesta IA';

  async ask(endpoint: AiEndpoint, payload: AssistantRequest): Promise<string> {
    this.requests.push({ endpoint, payload });
    return this.answer;
  }

  async generate(endpoint: AiEndpoint, payload: MarketingRequest): Promise<string> {
    this.requests.push({ endpoint, payload });
    return this.answer;
  }
}

/** 1x1 PNG. */
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake\n');
