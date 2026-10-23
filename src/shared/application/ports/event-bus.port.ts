/**
 * Integration event exchanged between bounded contexts, e.g.
 * `finance.payment-registered`. Payloads must be plain serializable data
 * (ids, amounts, dates) — never entities of another context.
 */
export interface IntegrationEvent<TPayload = Record<string, unknown>> {
  /** `<context>.<past-tense-fact>` */
  readonly name: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type EventHandler<TPayload = any> = (event: IntegrationEvent<TPayload>) => Promise<void> | void;

/**
 * Publish/subscribe between contexts without compile-time coupling.
 * Handlers run after the publisher's transaction work, sequentially; a failing
 * handler is logged and does not break the publisher or other handlers.
 */
export interface EventBusPort {
  publish(event: IntegrationEvent): Promise<void>;
  subscribe(eventName: string, handler: EventHandler): void;
}

export const EVENT_BUS = Symbol('EventBusPort');
