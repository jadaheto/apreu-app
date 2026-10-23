import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import type { Duplex } from 'node:stream';
import type { SmtpSecurity } from '../../../application/ports/email-sender.port.js';
import { assertAddress } from './mime-message.js';

/** Error reported by the SMTP server or the connection. */
export class SmtpError extends Error {
  constructor(
    message: string,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = 'SmtpError';
  }
}

/** Opens and upgrades the raw connections. Replaced by an in-memory double in tests. */
export interface SmtpTransport {
  /** Plain TCP (`secure=false`) or implicit TLS (`secure=true`, port 465). */
  connect(host: string, port: number, secure: boolean): Promise<Duplex>;
  /** STARTTLS: wraps an established plain connection in TLS. */
  upgrade(socket: Duplex, host: string): Promise<Duplex>;
}

/** Real transport over `node:net` / `node:tls` with certificate validation. */
export class NodeSmtpTransport implements SmtpTransport {
  constructor(private readonly connectTimeoutMs = 15_000) {}

  connect(host: string, port: number, secure: boolean): Promise<Duplex> {
    return new Promise((resolve, reject) => {
      const socket: Socket = secure
        ? tlsConnect({ host, port, servername: host, minVersion: 'TLSv1.2' })
        : netConnect({ host, port });
      const timer = setTimeout(
        () => socket.destroy(new SmtpError(`No fue posible conectar con ${host}:${port}.`)),
        this.connectTimeoutMs,
      );
      socket.once(secure ? 'secureConnect' : 'connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(new SmtpError(`Conexión SMTP fallida: ${error.message}`));
      });
    });
  }

  upgrade(socket: Duplex, host: string): Promise<Duplex> {
    return new Promise((resolve, reject) => {
      const secure = tlsConnect({ socket: socket as Socket, servername: host, minVersion: 'TLSv1.2' });
      secure.once('secureConnect', () => resolve(secure));
      secure.once('error', (error) => reject(new SmtpError(`Negociación STARTTLS fallida: ${error.message}`)));
    });
  }
}

interface SmtpReply {
  code: number;
  lines: string[];
}

/**
 * Line-oriented reader/writer over one socket. Parses multi-line replies
 * (`250-…` continued until `250 …`).
 */
class SmtpConnection {
  private buffer = '';
  private readonly replies: SmtpReply[] = [];
  private pendingLines: string[] = [];
  private waiter: { resolve: (reply: SmtpReply) => void; reject: (error: Error) => void } | null = null;
  private failure: Error | null = null;
  private readonly onData = (chunk: Buffer | string) => this.consume(chunk.toString());
  private readonly onError = (error: Error) => this.fail(new SmtpError(`Conexión SMTP interrumpida: ${error.message}`));
  private readonly onClose = () => this.fail(new SmtpError('El servidor SMTP cerró la conexión.'));

  constructor(
    private socket: Duplex,
    private readonly timeoutMs: number,
  ) {
    this.attach();
  }

  /** Switches to a new (TLS) socket after STARTTLS. */
  async replaceSocket(upgrade: (socket: Duplex) => Promise<Duplex>): Promise<void> {
    this.detach();
    // Errors of the wrapped plain socket surface on the TLS socket; never leave it without a listener.
    this.socket.on('error', () => undefined);
    this.buffer = '';
    this.socket = await upgrade(this.socket);
    this.attach();
  }

  read(): Promise<SmtpReply> {
    const queued = this.replies.shift();
    if (queued) return Promise.resolve(queued);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new SmtpError('Tiempo de espera agotado esperando respuesta del servidor SMTP.'));
      }, this.timeoutMs);
      this.waiter = {
        resolve: (reply) => {
          clearTimeout(timer);
          resolve(reply);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  write(data: string): void {
    this.socket.write(data);
  }

  /** Sends a command and checks the reply code. `secret` hides the command in errors. */
  async command(line: string, expected: number[], secret = false): Promise<SmtpReply> {
    this.write(`${line}\r\n`);
    return this.expect(expected, secret ? '[credenciales]' : line);
  }

  async expect(expected: number[], context: string): Promise<SmtpReply> {
    const reply = await this.read();
    if (!expected.includes(reply.code)) {
      throw new SmtpError(
        `El servidor rechazó "${context.split(' ')[0]}": ${reply.code} ${reply.lines.join(' ')}`,
        reply.code,
      );
    }
    return reply;
  }

  close(): void {
    this.detach();
    this.socket.end();
    this.socket.destroy();
  }

  private attach(): void {
    this.socket.on('data', this.onData);
    this.socket.on('error', this.onError);
    this.socket.on('close', this.onClose);
  }

  private detach(): void {
    this.socket.off('data', this.onData);
    this.socket.off('error', this.onError);
    this.socket.off('close', this.onClose);
  }

  private consume(text: string): void {
    this.buffer += text;
    let index: number;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, '');
      this.buffer = this.buffer.slice(index + 1);
      const match = /^(\d{3})([ -]?)(.*)$/.exec(line);
      if (!match) continue;
      this.pendingLines.push(match[3]);
      if (match[2] !== '-') {
        this.push({ code: Number(match[1]), lines: this.pendingLines });
        this.pendingLines = [];
      }
    }
  }

  private push(reply: SmtpReply): void {
    if (this.waiter) {
      const { resolve } = this.waiter;
      this.waiter = null;
      resolve(reply);
    } else {
      this.replies.push(reply);
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    if (this.waiter) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(error);
    }
  }
}

export interface SmtpAccount {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
}

export interface SmtpEnvelope {
  from: string;
  to: string;
}

/**
 * Minimal SMTP client (RFC 5321) used because no mail library is installed:
 * `EHLO`, `STARTTLS` or implicit TLS, `AUTH LOGIN`/`AUTH PLAIN`,
 * `MAIL FROM`, `RCPT TO`, `DATA` (with dot-stuffing) and `QUIT`.
 *
 * With `starttls` the upgrade is mandatory: the client refuses to send
 * credentials in clear text when the server does not offer STARTTLS.
 */
export class SmtpClient {
  constructor(
    private readonly transport: SmtpTransport = new NodeSmtpTransport(),
    private readonly timeoutMs = 30_000,
  ) {}

  async send(account: SmtpAccount, envelope: SmtpEnvelope, message: string): Promise<void> {
    assertAddress(envelope.from);
    assertAddress(envelope.to);
    const socket = await this.transport.connect(account.host, account.port, account.security === 'ssl');
    const connection = new SmtpConnection(socket, this.timeoutMs);
    const clientName = envelope.from.split('@')[1] ?? 'localhost';
    try {
      await connection.expect([220], 'saludo');
      let extensions = await this.ehlo(connection, clientName);

      if (account.security === 'starttls') {
        if (!extensions.has('STARTTLS')) {
          throw new SmtpError('El servidor no ofrece STARTTLS; configure el cifrado SSL o el puerto 465.');
        }
        await connection.command('STARTTLS', [220]);
        await connection.replaceSocket((plain) => this.transport.upgrade(plain, account.host));
        extensions = await this.ehlo(connection, clientName);
      }

      if (account.username) await this.authenticate(connection, extensions, account);

      await connection.command(`MAIL FROM:<${envelope.from}>`, [250]);
      await connection.command(`RCPT TO:<${envelope.to}>`, [250, 251]);
      await connection.command('DATA', [354]);
      connection.write(`${dotStuff(message)}\r\n.\r\n`);
      await connection.expect([250], 'DATA');
      await connection.command('QUIT', [221]).catch(() => undefined);
    } finally {
      connection.close();
    }
  }

  private async ehlo(connection: SmtpConnection, clientName: string): Promise<Map<string, string>> {
    const reply = await connection.command(`EHLO ${clientName}`, [250]);
    const extensions = new Map<string, string>();
    for (const line of reply.lines.slice(1)) {
      const [keyword, ...params] = line.trim().split(/\s+/);
      extensions.set(keyword.toUpperCase(), params.join(' ').toUpperCase());
    }
    return extensions;
  }

  private async authenticate(
    connection: SmtpConnection,
    extensions: Map<string, string>,
    account: SmtpAccount,
  ): Promise<void> {
    const mechanisms = (extensions.get('AUTH') ?? '').split(' ');
    const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
    if (mechanisms.includes('LOGIN')) {
      await connection.command('AUTH LOGIN', [334]);
      await connection.command(encode(account.username), [334], true);
      await connection.command(encode(account.password), [235], true);
    } else if (mechanisms.includes('PLAIN')) {
      await connection.command(`AUTH PLAIN ${encode(`\0${account.username}\0${account.password}`)}`, [235], true);
    } else {
      throw new SmtpError('El servidor no admite AUTH LOGIN ni AUTH PLAIN.');
    }
  }
}

/** Normalizes line endings to CRLF and doubles leading dots (RFC 5321 §4.5.2). */
export const dotStuff = (message: string): string =>
  message
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
