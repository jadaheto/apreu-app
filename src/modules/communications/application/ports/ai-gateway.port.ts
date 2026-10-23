import type { CrmSnapshot, MarketingType } from '../../domain/ai/marketing-generation.js';

/** Webhook (n8n) endpoint of an AI flow. */
export interface AiEndpoint {
  url: string;
  /** Optional bearer token sent to n8n (legacy bug #18: the webhook was open). */
  authToken: string | null;
}

/**
 * Chat payload. Keeps the legacy contract (`sessionId`, `chatInput`, `role`,
 * `userName`) and adds the tenant and document (legacy bug #17).
 */
export interface AssistantRequest {
  /** `<tenant>:<userId>`, so memories of different schools never collide. */
  sessionId: string;
  chatInput: string;
  role: string;
  userName: string;
  tenant: string;
  userId: number;
  documento: string | null;
}

/** AI assistant behind the floating chat widget. Returns the answer text. */
export interface AiAssistantPort {
  ask(endpoint: AiEndpoint, request: AssistantRequest): Promise<string>;
}

/** Marketing generator payload (legacy `marketing/generate.php`). */
export interface MarketingRequest {
  tipo: MarketingType;
  contexto: string;
  institucion: string;
  datos_crm: CrmSnapshot;
  userId: number;
  tenant: string;
}

/** Marketing content generator. Returns the generated text. */
export interface MarketingGeneratorPort {
  generate(endpoint: AiEndpoint, request: MarketingRequest): Promise<string>;
}

export const AI_ASSISTANT = Symbol('AiAssistantPort');
export const MARKETING_GENERATOR = Symbol('MarketingGeneratorPort');
