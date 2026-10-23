import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { CHAT_EXCHANGE_REPOSITORY, type ChatExchangeRepository } from '../../domain/ai/chat-exchange.repository.js';
import { ChatExchange } from '../../domain/ai/chat-exchange.js';
import { AI_CONTEXT, type AiContextPort } from '../../domain/directory/ai-context.port.js';
import { AI_ASSISTANT, type AiAssistantPort } from '../ports/ai-gateway.port.js';
import { CommunicationSettings } from '../services/communication-settings.js';

export interface AskAssistantInput {
  actor: AuthenticatedActor;
  message: string;
}

/**
 * Chat with the AI assistant (legacy `api_ai_handler.php`, RN-COM-16).
 *
 * The question is forwarded to the n8n flow with the legacy payload plus the
 * tenant, the user id and the identity document (bug #17); the session id
 * is `<tenant>:<userId>` so schools sharing a webhook never share memory.
 * Only successful exchanges are stored in `ai_chat_logs`.
 */
@Injectable()
export class AskAssistantUseCase implements UseCase<AskAssistantInput, { response: string }> {
  constructor(
    @Inject(AI_ASSISTANT) private readonly assistant: AiAssistantPort,
    @Inject(CHAT_EXCHANGE_REPOSITORY) private readonly exchanges: ChatExchangeRepository,
    @Inject(AI_CONTEXT) private readonly context: AiContextPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly settings: CommunicationSettings,
  ) {}

  async execute({ actor, message }: AskAssistantInput): Promise<{ response: string }> {
    const question = ChatExchange.assertValidMessage(message);
    const { chat } = await this.settings.ai();
    if (!chat) {
      throw new BusinessRuleViolationError(
        'El webhook de n8n no está configurado. Ve a Configuración → Apreu AI.',
        'AI_NOT_CONFIGURED',
      );
    }

    const response = await this.assistant.ask(chat, {
      sessionId: `${actor.tenant}:${actor.userId}`,
      chatInput: question,
      role: actor.role,
      userName: actor.name || 'Usuario',
      tenant: actor.tenant,
      userId: actor.userId,
      documento: await this.context.documentNumberOf(actor.userId),
    });

    await this.exchanges.save(
      ChatExchange.record(
        { userId: actor.userId, role: actor.role, userMessage: question, aiResponse: response },
        this.clock.now(),
      ),
    );
    return { response };
  }
}
