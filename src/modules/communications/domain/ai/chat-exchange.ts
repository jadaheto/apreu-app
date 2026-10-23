import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

/** Maximum characters of a chat message (legacy bug #18: no limit). */
export const MAX_CHAT_MESSAGE = 2000;

export interface ChatExchangeProps {
  userId: number;
  role: string;
  userMessage: string;
  aiResponse: string | null;
  createdAt: Date | null;
}

/**
 * One question/answer exchange with the AI assistant (`ai_chat_logs`,
 * RN-COM-16). Only successful exchanges are stored.
 */
export class ChatExchange extends Entity<ChatExchangeProps> {
  private constructor(id: EntityId, props: ChatExchangeProps) {
    super(id, props);
  }

  /** Validates the question before it is sent to the assistant. */
  static assertValidMessage(message: string): string {
    const trimmed = message?.trim() ?? '';
    Guard.againstEmpty(trimmed, 'mensaje');
    Guard.againstMaxLength(trimmed, MAX_CHAT_MESSAGE, 'mensaje');
    return trimmed;
  }

  static record(
    input: { userId: number; role: string; userMessage: string; aiResponse: string },
    at: Date,
  ): ChatExchange {
    return new ChatExchange(null, {
      userId: input.userId,
      role: input.role.slice(0, 30),
      userMessage: ChatExchange.assertValidMessage(input.userMessage),
      aiResponse: input.aiResponse,
      createdAt: at,
    });
  }

  static restore(id: number, props: ChatExchangeProps): ChatExchange {
    return new ChatExchange(id, { ...props });
  }

  get userId(): number {
    return this.props.userId;
  }
  get role(): string {
    return this.props.role;
  }
  get userMessage(): string {
    return this.props.userMessage;
  }
  get aiResponse(): string | null {
    return this.props.aiResponse;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
