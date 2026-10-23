import { ChatExchange, MAX_CHAT_MESSAGE } from './chat-exchange.js';
import { MARKETING_CATALOG, MARKETING_TYPES, MarketingGeneration } from './marketing-generation.js';

describe('ChatExchange', () => {
  const at = new Date('2026-03-15T10:00:00Z');

  it('validates the message size (legacy bug #18)', () => {
    expect(ChatExchange.assertValidMessage('  hola ')).toBe('hola');
    expect(() => ChatExchange.assertValidMessage('  ')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    expect(() => ChatExchange.assertValidMessage('x'.repeat(MAX_CHAT_MESSAGE + 1))).toThrow(
      expect.objectContaining({ code: 'MAX_LENGTH' }),
    );
  });

  it('records an exchange with the role of the user', () => {
    const exchange = ChatExchange.record({ userId: 2, role: 'student', userMessage: '¿Notas?', aiResponse: 'Ok' }, at);
    expect(exchange).toMatchObject({
      userId: 2,
      role: 'student',
      userMessage: '¿Notas?',
      aiResponse: 'Ok',
      createdAt: at,
    });
  });
});

describe('MarketingGeneration', () => {
  it('has one catalog entry per type', () => {
    expect(MARKETING_CATALOG.map((entry) => entry.type)).toEqual([...MARKETING_TYPES]);
  });

  it('validates type and context length', () => {
    expect(MarketingGeneration.assertValidRequest('email', '  Campaña de matrículas 2027 ')).toBe(
      'Campaña de matrículas 2027',
    );
    expect(() => MarketingGeneration.assertValidRequest('tiktok' as never, 'contexto válido')).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
    expect(() => MarketingGeneration.assertValidRequest('email', 'corto')).toThrow(
      expect.objectContaining({ code: 'OUT_OF_RANGE' }),
    );
  });

  it('records the CRM snapshot used', () => {
    const generation = MarketingGeneration.record(
      {
        userId: 1,
        type: 'estrategia',
        contextInput: 'Captar estudiantes de primaria',
        crmData: { total_estudiantes_activos: 300, fecha_actual: '2026-03-15' },
        aiResponse: 'Plan',
      },
      new Date(),
    );
    expect(generation.crmData).toEqual({ total_estudiantes_activos: 300, fecha_actual: '2026-03-15' });
  });
});
