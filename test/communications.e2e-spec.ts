import { createE2eApp, DIRECTOR, type E2eContext, uniqueSuffix } from './support/e2e-app.js';
import { createUser, type TestUser } from './support/fixtures.js';
import { expectStatus } from './support/http.js';

describe('communications (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let recipient: TestUser;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
    recipient = await createUser(ctx, director, 'finance', 'Tesorera E2E');
  });
  afterAll(() => ctx?.close());

  describe('notifications', () => {
    let ids: number[] = [];

    it('an admin notifies users; they list them, newest first and unread', async () => {
      for (const title of ['Primera', 'Segunda']) {
        const res = await ctx
          .api(director)
          .post('/api/notifications')
          .send({ userIds: [recipient.id], title: `${title} ${uniqueSuffix()}`, message: 'Mensaje E2E', type: 'info' });
        expectStatus(res, 201);
      }
      const list = await ctx.api(recipient.token).get('/api/notifications');
      expectStatus(list, 200);
      const items = list.body.items ?? list.body.notifications ?? list.body;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].title).toMatch(/^Segunda/);
      ids = items.map((n: { id: number }) => n.id);
      expect(JSON.stringify(list.body)).toMatch(/"unread(Count)?":\s*2|"isRead":false|"read":false/);
    });

    it('marks one and then all as read', async () => {
      expectStatus(await ctx.api(recipient.token).patch(`/api/notifications/${ids[0]}/read`), 200, 204);
      const other = await ctx.api(director).patch(`/api/notifications/${ids[1]}/read`);
      expectStatus(other, 403, 404); // someone else's notification
      expectStatus(await ctx.api(recipient.token).patch('/api/notifications/read-all'), 200, 204);
      const list = await ctx.api(recipient.token).get('/api/notifications');
      expect(JSON.stringify(list.body)).not.toMatch(/"isRead":false|"read":false/);
    });

    it('only staff can send notifications', async () => {
      const teacher = await createUser(ctx, director, 'teacher');
      expectStatus(
        await ctx
          .api(teacher.token)
          .post('/api/notifications')
          .send({ userIds: [recipient.id], title: 'x', message: 'y' }),
        403,
      );
    });
  });

  describe('logs and templates', () => {
    it('lists the e-mail and WhatsApp logs and KPIs', async () => {
      for (const path of [
        '/api/communications/email/logs',
        '/api/communications/email/kpis',
        '/api/communications/whatsapp/logs',
        '/api/communications/whatsapp/kpis',
      ]) {
        expectStatus(await ctx.api(director).get(path), 200);
      }
    });

    it('finds a WhatsApp template by name regardless of case', async () => {
      const name = `cobro_e2e_${uniqueSuffix()}`.toLowerCase();
      const created = await ctx
        .api(director)
        .post('/api/communications/whatsapp/templates')
        .send({
          name,
          language: 'es_CO',
          category: 'utility',
          body: 'Hola {{1}}, su saldo es {{2}}.',
          variables: ['nombre', 'saldo'],
          status: 'active',
          headerType: 'none',
        });
      expectStatus(created, 201);
      const found = await ctx.api(director).get(`/api/communications/whatsapp/templates/by-name/${name.toUpperCase()}`);
      expectStatus(found, 200);
      expect(found.body.name).toBe(name);
      const duplicate = await ctx
        .api(director)
        .post('/api/communications/whatsapp/templates')
        .send({ ...created.body, id: undefined, name: name.toUpperCase() });
      expectStatus(duplicate, 400, 409);
    });
  });

  describe('external gateways (test doubles)', () => {
    it('sends the SMTP test e-mail through the e-mail port', async () => {
      const settings = await ctx
        .api(director)
        .put('/api/institution/settings/integrations')
        .send({ values: { smtp_general_password: 'clave-smtp-e2e' } });
      expectStatus(settings, 200);
      const res = await ctx.api(director).post('/api/communications/email/smtp-test').send({ profile: 'general' });
      expectStatus(res, 200);
      expect(ctx.doubles.email.sent).toHaveLength(1);
      expect(ctx.doubles.email.sent[0].message.to).toMatchObject({ email: 'director@demo.co' });
      expect(ctx.doubles.email.sent[0].account).toMatchObject({
        host: 'smtp.hostinger.com',
        password: 'clave-smtp-e2e',
      });
    });

    it('answers the AI chat through the assistant port and keeps the history', async () => {
      const settings = await ctx
        .api(director)
        .put('/api/institution/settings/ai')
        .send({ values: { n8n_webhook_url: 'https://n8n.example.com/webhook/e2e' } });
      expectStatus(settings, 200);
      const res = await ctx.api(director).post('/api/ai/chat').send({ message: '¿Cuántos estudiantes hay?' });
      expectStatus(res, 200, 201);
      expect(JSON.stringify(res.body)).toContain('Respuesta de prueba a: ¿Cuántos estudiantes hay?');
      expect(ctx.doubles.ai.questions[0]).toMatchObject({ tenant: 'e2e-demo', chatInput: '¿Cuántos estudiantes hay?' });
      const history = await ctx.api(director).get('/api/ai/chat/history');
      expectStatus(history, 200);
      expect(JSON.stringify(history.body)).toContain('Cuántos estudiantes');
    });
  });
});
