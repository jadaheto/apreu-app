import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';

export interface FakeSmtpOptions {
  starttls?: boolean;
  auth?: string;
  password?: string;
  rejectRecipient?: boolean;
  silent?: boolean;
}

/**
 * Scripted SMTP server on 127.0.0.1 for tests. Records the commands and the
 * DATA payload it receives. STARTTLS is acknowledged but the connection stays
 * in clear text (the test transport "upgrades" by returning the same socket).
 */
export class FakeSmtpServer {
  readonly commands: string[] = [];
  data = '';
  private readonly server: Server;

  constructor(private readonly options: FakeSmtpOptions = {}) {
    this.server = createServer((socket) => this.session(socket));
  }

  async start(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return (this.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private session(socket: Socket): void {
    const {
      starttls = false,
      auth = 'LOGIN PLAIN',
      password = 'secreta',
      rejectRecipient = false,
      silent = false,
    } = this.options;
    if (silent) return;
    let buffer = '';
    let inData = false;
    let authStep = 0;
    const reply = (text: string) => socket.write(`${text}\r\n`);
    reply('220 fake.smtp ESMTP');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end < 0) return;
          this.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          reply('250 2.0.0 Ok: queued');
          continue;
        }
        const index = buffer.indexOf('\r\n');
        if (index < 0) return;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        this.commands.push(line);
        const verb = line.split(' ')[0].toUpperCase();

        if (authStep === 1) {
          authStep = 2;
          reply('334 UGFzc3dvcmQ6');
        } else if (authStep === 2) {
          authStep = 0;
          reply(
            Buffer.from(line, 'base64').toString() === password
              ? '235 2.7.0 Authenticated'
              : '535 5.7.8 Bad credentials',
          );
        } else if (verb === 'EHLO') {
          const lines = [
            '250-fake.smtp',
            '250-SIZE 10485760',
            ...(starttls ? ['250-STARTTLS'] : []),
            `250 AUTH ${auth}`,
          ];
          socket.write(lines.map((item) => `${item}\r\n`).join(''));
        } else if (verb === 'STARTTLS') {
          reply('220 2.0.0 Ready to start TLS');
        } else if (line === 'AUTH LOGIN') {
          authStep = 1;
          reply('334 VXNlcm5hbWU6');
        } else if (verb === 'AUTH') {
          const [, , encoded] = line.split(' ');
          const [, , secret] = Buffer.from(encoded, 'base64').toString().split('\0');
          reply(secret === password ? '235 2.7.0 Authenticated' : '535 5.7.8 Bad credentials');
        } else if (verb === 'MAIL') {
          reply('250 2.1.0 Ok');
        } else if (verb === 'RCPT') {
          reply(rejectRecipient ? '550 5.1.1 User unknown' : '250 2.1.5 Ok');
        } else if (verb === 'DATA') {
          inData = true;
          reply('354 End data with <CR><LF>.<CR><LF>');
        } else if (verb === 'QUIT') {
          reply('221 2.0.0 Bye');
          socket.end();
        } else {
          reply('502 5.5.2 Command not recognized');
        }
      }
    });
    socket.on('error', () => undefined);
  }
}
