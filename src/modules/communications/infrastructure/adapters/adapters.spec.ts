import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExternalServiceError } from '../../../../shared/domain/domain-error.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import { PNG_BYTES } from '../../testing/fakes.js';
import { AllowlistHtmlSanitizer } from './allowlist-html-sanitizer.js';
import { LocalFileStorage } from './local-file-storage.js';
import { N8nWebhookClient } from './n8n/n8n-webhook.client.js';
import { TimerDelay } from './timer-delay.js';
import { HmacWebhookSignature } from './whatsapp/hmac-webhook-signature.js';
import { GRAPH_API_URL, MetaCloudApiGateway } from './whatsapp/meta-cloud-api.gateway.js';

const jsonResponse = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('MetaCloudApiGateway', () => {
  const credentials = { token: 'tok', phoneNumberId: '1234' };
  const message = {
    name: 'cobro_mensual',
    language: 'es_CO',
    bodyParameters: ['Ana', '$1'],
    headerImageUrl: 'https://cdn.co/a.png',
  };

  it('posts the template with header and body components to Graph v21.0', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.X' }] }));
    await expect(new MetaCloudApiGateway(fetchFn).sendTemplate(credentials, '573001234567', message)).resolves.toBe(
      'wamid.X',
    );

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`${GRAPH_API_URL}/1234/messages`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '573001234567',
      type: 'template',
      template: {
        name: 'cobro_mensual',
        language: { code: 'es_CO' },
        components: [
          { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.co/a.png' } }] },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ana' },
              { type: 'text', text: '$1' },
            ],
          },
        ],
      },
    });
  });

  it('omits empty components', () => {
    const payload = MetaCloudApiGateway.payload('57', { ...message, bodyParameters: [], headerImageUrl: null });
    expect((payload.template as { components: unknown[] }).components).toEqual([]);
  });

  it.each([
    [
      jsonResponse(400, { error: { message: 'Template name does not exist', error_data: { details: 'cobro' } } }),
      /Template name does not exist: cobro/,
    ],
    [jsonResponse(500, 'oops'), /código HTTP 500/],
    [jsonResponse(200, {}), /código HTTP 200/],
  ])('reports Meta errors %#', async (response, message_) => {
    const gateway = new MetaCloudApiGateway(vi.fn().mockResolvedValue(response));
    await expect(gateway.sendTemplate(credentials, '57', message)).rejects.toThrow(message_);
  });

  it('reports network errors', async () => {
    const gateway = new MetaCloudApiGateway(vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    await expect(gateway.sendTemplate(credentials, '57', message)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('HmacWebhookSignature', () => {
  const body = Buffer.from('{"entry":[]}');
  const valid = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
  const verifier = new HmacWebhookSignature();

  it('accepts the signature of the exact body only', () => {
    expect(verifier.isValid(body, valid, 'secret')).toBe(true);
    expect(verifier.isValid(Buffer.from('{"entry":[1]}'), valid, 'secret')).toBe(false);
    expect(verifier.isValid(body, valid, 'otro')).toBe(false);
    expect(verifier.isValid(body, undefined, 'secret')).toBe(false);
    expect(verifier.isValid(body, 'sha1=abc', 'secret')).toBe(false);
  });
});

describe('N8nWebhookClient', () => {
  const endpoint = { url: 'https://n8n.co/webhook/apreu-ai', authToken: 'tok' };
  const request = {
    sessionId: 't:1',
    chatInput: 'hola',
    role: 'admin',
    userName: 'A',
    tenant: 't',
    userId: 1,
    documento: null,
  };

  it('posts JSON with the bearer token and extracts the answer', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, [{ output: ' Hola, soy Apreu AI ' }]));
    await expect(new N8nWebhookClient(fetchFn).ask(endpoint, request)).resolves.toBe('Hola, soy Apreu AI');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(endpoint.url);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(request);
  });

  it.each([
    ['{"response":"r"}', ['output', 'response'], 'r'],
    ['{"mensaje":{"a":1}}', ['output', 'mensaje'], '{"a":1}'],
    ['{"otro":1}', ['output'], '{"otro":1}'],
    ['texto plano', ['output'], 'texto plano'],
    ['"cadena"', ['output'], 'cadena'],
  ])('extracts %s', (raw, fields, expected) => {
    expect(N8nWebhookClient.extract(raw, fields)).toBe(expected);
  });

  it('reports HTTP, network and empty answers as external errors', async () => {
    const marketing = {
      tipo: 'email' as const,
      contexto: 'c',
      institucion: 'I',
      datos_crm: { total_estudiantes_activos: 1, fecha_actual: 'x' },
      userId: 1,
      tenant: 't',
    };
    await expect(
      new N8nWebhookClient(vi.fn().mockResolvedValue(jsonResponse(404, {}))).generate(endpoint, marketing),
    ).rejects.toThrow(/HTTP 404/);
    await expect(
      new N8nWebhookClient(vi.fn().mockRejectedValue(new Error('timeout'))).ask(endpoint, request),
    ).rejects.toThrow(/timeout/);
    await expect(
      new N8nWebhookClient(vi.fn().mockResolvedValue(jsonResponse(200, ''))).ask(endpoint, request),
    ).rejects.toThrow(/vacía/);
  });
});

describe('AllowlistHtmlSanitizer', () => {
  const sanitize = (html: string) => new AllowlistHtmlSanitizer().sanitize(html);

  it('keeps editor formatting', () => {
    const html =
      '<p style="color: red">Hola <strong>padres</strong></p><ul><li>uno</li></ul><a href="https://colegio.co" target="_blank">ver</a>';
    expect(sanitize(html)).toBe(
      '<p style="color: red">Hola <strong>padres</strong></p><ul><li>uno</li></ul><a href="https://colegio.co" target="_blank" rel="noopener noreferrer">ver</a>',
    );
  });

  it.each([
    ['<script>alert(1)</script><p>ok</p>', '<p>ok</p>'],
    ['<img src=x onerror=alert(1)>', '<img>'],
    ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
    ['<a href="&#106;avascript:alert(1)">x</a>', '<a>x</a>'],
    ['<a href="java\tscript:alert(1)">x</a>', '<a>x</a>'],
    ['<iframe src="https://evil.co"></iframe>fin', 'fin'],
    ['<svg onload=alert(1)><circle/></svg>ok', 'ok'],
    ['<div style="background:url(javascript:alert(1))">x</div>', '<div>x</div>'],
    ['<!-- comentario --><p>a</p>', '<p>a</p>'],
    ['<form action="x"><input name="p"></form>texto', 'texto'],
    ['1 < 2 y <b>negrita', '1 &lt; 2 y <b>negrita</b>'],
    ['<p><b>sin cerrar</p>', '<p><b>sin cerrar</b></p>'],
    ['</div>huérfano', 'huérfano'],
    ['<img src="cid:logo@apreu" alt="Logo">', '<img src="cid:logo@apreu" alt="Logo">'],
    ['<img src="data:image/svg+xml;base64,PHN2Zz4=">', '<img>'],
    ['<p title="a&quot; onmouseover=&quot;x">t</p>', '<p title="a&quot; onmouseover=&quot;x">t</p>'],
    ['<scr<script>ipt>alert(1)</script>', 'ipt>alert(1)'],
  ])('sanitizes %s', (input, expected) => {
    expect(sanitize(input)).toBe(expected);
  });
});

describe('LocalFileStorage', () => {
  let root: string;
  const tenants = new TenantContext();
  const tenant = { id: 1, slug: 'colegio-a', name: 'A', status: 'active' as const, databaseName: 'x' };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apreu-storage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('stores files inside the tenant folder and reads them back', async () => {
    const storage = new LocalFileStorage(tenants, { storage: { uploadsDir: root } });
    await tenants.run(tenant, () => storage.save('email/email_logo.png', PNG_BYTES));
    await expect(tenants.run(tenant, () => storage.read('email/email_logo.png'))).resolves.toEqual(PNG_BYTES);
    await expect(tenants.run(tenant, () => storage.read('email/no-existe.png'))).resolves.toBeNull();
  });

  it('never escapes the tenant folder', async () => {
    const storage = new LocalFileStorage(tenants, { storage: { uploadsDir: root } });
    await expect(tenants.run(tenant, () => storage.save('../colegio-b/x.png', PNG_BYTES))).rejects.toThrow(
      /fuera del directorio/,
    );
  });
});

describe('TimerDelay', () => {
  it('waits the requested time', async () => {
    const started = Date.now();
    await new TimerDelay().wait(20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
