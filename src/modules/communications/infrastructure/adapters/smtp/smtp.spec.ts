import type { Duplex } from 'node:stream';
import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import { FakeSmtpServer } from '../../../testing/fake-smtp-server.js';
import { buildMimeMessage, encodeHeaderText, formatMailbox, MimeInjectionError } from './mime-message.js';
import { dotStuff, NodeSmtpTransport, SmtpClient, SmtpError, type SmtpTransport } from './smtp-client.js';
import { SmtpEmailSender } from './smtp-email-sender.js';
import { PDF_BYTES, PNG_BYTES } from '../../../testing/fakes.js';

/** Real TCP connection, but STARTTLS keeps the plain socket and implicit TLS is only recorded. */
class RecordingTransport implements SmtpTransport {
  readonly connections: { host: string; port: number; secure: boolean }[] = [];
  upgrades = 0;
  private readonly tcp = new NodeSmtpTransport(2_000);

  connect(host: string, port: number, secure: boolean): Promise<Duplex> {
    this.connections.push({ host, port, secure });
    return this.tcp.connect(host, port, false);
  }

  async upgrade(socket: Duplex): Promise<Duplex> {
    this.upgrades++;
    return socket;
  }
}

const decodeBase64Parts = (message: string): string =>
  [...message.matchAll(/Content-Transfer-Encoding: base64\r\n(?:[^\r\n]+\r\n)*\r\n([A-Za-z0-9+/=\r\n]+)/g)]
    .map((match) => Buffer.from(match[1].replace(/\r\n/g, ''), 'base64').toString('utf8'))
    .join('\n');

describe('MIME message', () => {
  const base = {
    from: { email: 'noreply@apreu.co', name: 'Apreu ERP' },
    to: { email: 'padre@mail.co', name: 'José Pérez' },
    subject: 'Reunión de padres',
    html: '<p>Hola</p>',
    text: 'Hola',
    attachments: [],
    date: new Date('2026-03-15T15:00:00Z'),
    messageIdDomain: 'apreu.co',
  };

  it('builds headers with encoded words and an alternative body', () => {
    const message = buildMimeMessage(base);
    expect(message).toContain('From: "Apreu ERP" <noreply@apreu.co>');
    expect(message).toContain(`To: ${encodeHeaderText('José Pérez')} <padre@mail.co>`);
    expect(message).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(message).toContain('Date: Sun, 15 Mar 2026 15:00:00 +0000');
    expect(message).toMatch(/Message-ID: <[0-9a-f]{32}@apreu\.co>/);
    expect(message).toContain('Content-Type: multipart/alternative');
    expect(message).not.toContain('multipart/mixed');
    expect(decodeBase64Parts(message)).toContain('<p>Hola</p>');
  });

  it('nests inline images in related and files in mixed', () => {
    const message = buildMimeMessage({
      ...base,
      attachments: [
        { filename: 'logo.png', contentType: 'image/png', content: PNG_BYTES, contentId: 'logo@apreu' },
        { filename: 'factura.pdf', contentType: 'application/pdf', content: PDF_BYTES },
      ],
    });
    expect(message.indexOf('multipart/mixed')).toBeLessThan(message.indexOf('multipart/related'));
    expect(message).toContain('Content-ID: <logo@apreu>');
    expect(message).toContain('Content-Disposition: inline; filename="logo.png"');
    expect(message).toContain('Content-Disposition: attachment; filename="factura.pdf"');
  });

  it('splits long non-ASCII headers without cutting characters', () => {
    const encoded = encodeHeaderText('ñ'.repeat(40));
    const words = encoded.split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    expect(words.map((word) => Buffer.from(word.slice(10, -2), 'base64').toString()).join('')).toBe('ñ'.repeat(40));
  });

  it('prevents header injection', () => {
    expect(() => buildMimeMessage({ ...base, subject: 'Hola\r\nBcc: todos@x.co' })).toThrow(MimeInjectionError);
    expect(() => formatMailbox({ email: 'a@x.co>\r\nBcc: b@x.co' })).toThrow(MimeInjectionError);
    expect(formatMailbox({ email: 'a@x.co', name: 'Dice "hola"' })).toBe('"Dice \\"hola\\"" <a@x.co>');
  });

  it('dot-stuffs lines starting with a dot', () => {
    expect(dotStuff('a\n.b\r\n..c')).toBe('a\r\n..b\r\n...c');
  });
});

describe('SmtpClient', () => {
  let server: FakeSmtpServer;
  let port: number;
  const account = (overrides = {}) => ({
    host: '127.0.0.1',
    port,
    security: 'none' as const,
    username: 'noreply@apreu.co',
    password: 'secreta',
    ...overrides,
  });
  const envelope = { from: 'noreply@apreu.co', to: 'padre@mail.co' };
  const start = async (options = {}) => {
    server = new FakeSmtpServer(options);
    port = await server.start();
  };

  afterEach(async () => {
    await server?.stop();
  });

  it('runs EHLO, AUTH LOGIN, MAIL, RCPT, DATA and QUIT', async () => {
    await start();
    await new SmtpClient(new NodeSmtpTransport()).send(account(), envelope, 'Subject: x\r\n\r\nLínea\r\n.punto');

    expect(server.commands).toEqual([
      'EHLO apreu.co',
      'AUTH LOGIN',
      Buffer.from('noreply@apreu.co').toString('base64'),
      Buffer.from('secreta').toString('base64'),
      'MAIL FROM:<noreply@apreu.co>',
      'RCPT TO:<padre@mail.co>',
      'DATA',
      'QUIT',
    ]);
    expect(server.data).toContain('\r\n..punto');
  });

  it('falls back to AUTH PLAIN', async () => {
    await start({ auth: 'PLAIN' });
    await new SmtpClient(new NodeSmtpTransport()).send(account(), envelope, 'x');
    expect(server.commands[1]).toMatch(/^AUTH PLAIN /);
  });

  it('upgrades with STARTTLS and repeats EHLO (legacy bug #8)', async () => {
    await start({ starttls: true });
    const transport = new RecordingTransport();
    await new SmtpClient(transport).send(account({ security: 'starttls' }), envelope, 'x');

    expect(transport.upgrades).toBe(1);
    expect(server.commands.slice(0, 3)).toEqual(['EHLO apreu.co', 'STARTTLS', 'EHLO apreu.co']);
  });

  it('refuses to authenticate in clear text when STARTTLS is not offered', async () => {
    await start({ starttls: false });
    await expect(
      new SmtpClient(new RecordingTransport()).send(account({ security: 'starttls' }), envelope, 'x'),
    ).rejects.toThrow(/no ofrece STARTTLS/);
    expect(server.commands.some((command) => command.startsWith('AUTH'))).toBe(false);
  });

  it('opens implicit TLS connections for the ssl mode', async () => {
    await start();
    const transport = new RecordingTransport();
    await new SmtpClient(transport).send(account({ security: 'ssl' }), envelope, 'x');
    expect(transport.connections).toEqual([{ host: '127.0.0.1', port, secure: true }]);
  });

  it.each([
    [{ rejectRecipient: true }, 550, /RCPT/],
    [{ password: 'otra' }, 535, /\[credenciales\]/],
  ])('reports server rejections %o', async (options, code, message) => {
    await start(options);
    const error = await new SmtpClient(new NodeSmtpTransport()).send(account(), envelope, 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SmtpError);
    expect(error).toMatchObject({ code, message: expect.stringMatching(message) });
    expect((error as Error).message).not.toContain('secreta');
  });

  it('times out when the server does not answer', async () => {
    await start({ silent: true });
    await expect(new SmtpClient(new NodeSmtpTransport(), 200).send(account(), envelope, 'x')).rejects.toThrow(
      /Tiempo de espera/,
    );
  });

  it('reports unreachable servers', async () => {
    await start();
    await server.stop();
    await expect(new SmtpClient(new NodeSmtpTransport()).send(account(), envelope, 'x')).rejects.toThrow(
      /Conexión SMTP fallida/,
    );
    server = new FakeSmtpServer();
    await server.start();
  });

  it('rejects malformed envelope addresses before connecting', async () => {
    await start();
    await expect(
      new SmtpClient(new NodeSmtpTransport()).send(account(), { ...envelope, to: 'x@y.co>\r\nRCPT TO:<z@w.co' }, 'x'),
    ).rejects.toBeInstanceOf(MimeInjectionError);
    expect(server.commands).toEqual([]);
  });
});

describe('SmtpEmailSender', () => {
  let server: FakeSmtpServer;

  afterEach(async () => {
    await server.stop();
  });

  it('delivers a MIME message through the client', async () => {
    server = new FakeSmtpServer();
    const port = await server.start();
    const sender = new SmtpEmailSender(new SmtpClient(new NodeSmtpTransport()));

    await sender.send(
      {
        host: '127.0.0.1',
        port,
        security: 'none',
        username: 'u@apreu.co',
        password: 'secreta',
        fromEmail: 'noreply@apreu.co',
        fromName: 'Colegio',
      },
      {
        to: { email: 'padre@mail.co', name: 'Padre' },
        subject: 'Aviso',
        html: '<p>Hola</p>',
        text: 'Hola',
        attachments: [],
      },
    );

    expect(server.data).toContain('To: "Padre" <padre@mail.co>');
    expect(server.data).toContain('Subject: Aviso');
  });

  it('wraps failures as external service errors', async () => {
    server = new FakeSmtpServer({ rejectRecipient: true });
    const port = await server.start();
    const sender = new SmtpEmailSender(new SmtpClient(new NodeSmtpTransport()));
    await expect(
      sender.send(
        {
          host: '127.0.0.1',
          port,
          security: 'none',
          username: '',
          password: '',
          fromEmail: 'noreply@apreu.co',
          fromName: 'C',
        },
        { to: { email: 'nadie@mail.co', name: null }, subject: 'A', html: 'h', text: 't', attachments: [] },
      ),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
