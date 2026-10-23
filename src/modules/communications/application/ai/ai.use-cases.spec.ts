import { ExternalServiceError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { FixedClock } from '../../../../shared/testing/fakes.js';
import { ChatExchange } from '../../domain/ai/chat-exchange.js';
import { FakeDirectory } from '../../testing/fake-directory.js';
import { FakeAi, InMemorySettingsStore } from '../../testing/fakes.js';
import { actor } from '../../testing/fixtures.js';
import {
  InMemoryChatExchangeRepository,
  InMemoryMarketingGenerationRepository,
} from '../../testing/in-memory-repositories.js';
import { CommunicationSettings } from '../services/communication-settings.js';
import { AskAssistantUseCase } from './ask-assistant.use-case.js';
import { ListChatLogsUseCase, ListMyChatHistoryUseCase } from './list-chat-history.use-cases.js';
import {
  GenerateMarketingContentUseCase,
  ListMarketingTypesUseCase,
  ListMyMarketingGenerationsUseCase,
} from './marketing.use-cases.js';

describe('AI use cases', () => {
  let ai: FakeAi;
  let exchanges: InMemoryChatExchangeRepository;
  let generations: InMemoryMarketingGenerationRepository;
  let directory: FakeDirectory;
  let settings: CommunicationSettings;
  const clock = new FixedClock(new Date('2026-03-16T02:00:00Z'));

  beforeEach(() => {
    ai = new FakeAi();
    exchanges = new InMemoryChatExchangeRepository();
    generations = new InMemoryMarketingGenerationRepository();
    directory = new FakeDirectory();
    settings = new CommunicationSettings(
      new InMemorySettingsStore({
        n8n_webhook_url: 'https://n8n.co/webhook/apreu-ai',
        n8n_marketing_url: 'https://n8n.co/webhook/marketing',
        n8n_auth_token: 'tok',
        school_name: 'Colegio Andino',
      }),
    );
  });

  describe('AskAssistantUseCase', () => {
    const ask = (message = '  ¿Cuál es mi promedio? ', who = actor({ userId: 8, role: Role.STUDENT, name: 'Ana' })) =>
      new AskAssistantUseCase(ai, exchanges, directory, clock, settings).execute({ actor: who, message });

    it('sends the legacy payload plus tenant and document, and stores the exchange (RN-COM-16)', async () => {
      directory.documents.set(8, '1012345678');
      await expect(ask()).resolves.toEqual({ response: 'Respuesta IA' });

      expect(ai.requests[0]).toEqual({
        endpoint: { url: 'https://n8n.co/webhook/apreu-ai', authToken: 'tok' },
        payload: {
          sessionId: 'colegio-a:8',
          chatInput: '¿Cuál es mi promedio?',
          role: 'student',
          userName: 'Ana',
          tenant: 'colegio-a',
          userId: 8,
          documento: '1012345678',
        },
      });
      expect(exchanges.store.all()[0]).toMatchObject({
        userId: 8,
        role: 'student',
        userMessage: '¿Cuál es mi promedio?',
      });
    });

    it('validates the message and the configuration', async () => {
      await expect(ask(' ')).rejects.toMatchObject({ code: 'REQUIRED_FIELD' });
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(ask()).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    });

    it('does not store failed exchanges', async () => {
      vi.spyOn(ai, 'ask').mockRejectedValueOnce(new ExternalServiceError('Asistente IA', 'caído'));
      await expect(ask()).rejects.toBeInstanceOf(ExternalServiceError);
      expect(exchanges.store.all()).toHaveLength(0);
    });
  });

  describe('chat history', () => {
    beforeEach(async () => {
      await exchanges.save(
        ChatExchange.record({ userId: 1, role: 'admin', userMessage: 'hola', aiResponse: 'r' }, clock.now()),
      );
      await exchanges.save(
        ChatExchange.record({ userId: 2, role: 'student', userMessage: 'notas', aiResponse: 'r' }, clock.now()),
      );
    });

    it('shows each user only their conversations (RN-COM-17)', async () => {
      const page = await new ListMyChatHistoryUseCase(exchanges).execute({ userId: 2, page: { page: 1, limit: 15 } });
      expect(page).toMatchObject({ total: 1, items: [{ userMessage: 'notas', role: 'student' }] });
    });

    it('filters the global monitor and validates the date range', async () => {
      const monitor = new ListChatLogsUseCase(exchanges);
      const page = await monitor.execute({ criteria: { role: 'student' }, page: { page: 1, limit: 20 } });
      expect(page.items).toEqual([expect.objectContaining({ userId: 2, userName: 'Usuario 2', userMessage: 'notas' })]);
      await expect(
        monitor.execute({ criteria: { from: '2026-03-10', to: '2026-03-01' }, page: { page: 1, limit: 20 } }),
      ).rejects.toMatchObject({
        code: 'INVERTED_DATES',
      });
      await expect(
        monitor.execute({ criteria: { from: '2026-13-01' }, page: { page: 1, limit: 20 } }),
      ).rejects.toMatchObject({
        code: 'INVALID_DATE',
      });
    });
  });

  describe('marketing', () => {
    const generate = (context = 'Campaña de matrículas para primaria 2027') =>
      new GenerateMarketingContentUseCase(ai, generations, directory, clock, settings).execute({
        actor: actor({ userId: 3, role: Role.EMPLOYEE }),
        type: 'sociales',
        context,
      });

    it('lists the six generators', async () => {
      await expect(new ListMarketingTypesUseCase().execute()).resolves.toHaveLength(6);
    });

    it('sends the documented payload and stores the generation (RN-COM-15)', async () => {
      directory.activeStudents = 420;
      const view = await generate();

      expect(ai.requests[0].payload).toEqual({
        tipo: 'sociales',
        contexto: 'Campaña de matrículas para primaria 2027',
        institucion: 'Colegio Andino',
        datos_crm: { total_estudiantes_activos: 420, fecha_actual: '2026-03-15' },
        userId: 3,
        tenant: 'colegio-a',
      });
      expect(view).toMatchObject({
        type: 'sociales',
        aiResponse: 'Respuesta IA',
        crmData: { total_estudiantes_activos: 420 },
      });
    });

    it('validates the context and the configuration', async () => {
      await expect(generate('corto')).rejects.toMatchObject({ code: 'OUT_OF_RANGE' });
      settings = new CommunicationSettings(new InMemorySettingsStore());
      await expect(generate()).rejects.toMatchObject({ code: 'MARKETING_AI_NOT_CONFIGURED' });
    });

    it('lists only the author generations', async () => {
      await generate();
      const history = new ListMyMarketingGenerationsUseCase(generations);
      await expect(history.execute({ userId: 3, page: { page: 1, limit: 10 } })).resolves.toMatchObject({ total: 1 });
      await expect(history.execute({ userId: 4, page: { page: 1, limit: 10 } })).resolves.toMatchObject({ total: 0 });
      await expect(
        history.execute({ userId: 3, date: '15/03/2026', page: { page: 1, limit: 10 } }),
      ).rejects.toMatchObject({
        code: 'INVALID_DATE',
      });
    });
  });
});
