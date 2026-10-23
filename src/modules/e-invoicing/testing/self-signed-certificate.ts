import { generateKeyPairSync, type KeyObject, sign, X509Certificate } from 'node:crypto';

/**
 * Builds a throw-away self-signed X.509 v3 certificate in memory (DER encoded
 * by hand: Node's `crypto` generates keys but not certificates). Used only by
 * tests; nothing is written to the repository.
 */
export interface TestCertificate {
  privateKey: KeyObject;
  certificate: X509Certificate;
  /** PEM bundle: PKCS#8 private key followed by the certificate. */
  pem: string;
  keyPem: string;
  certificatePem: string;
}

const der = (tag: number, content: Buffer): Buffer =>
  Buffer.concat([Buffer.from([tag]), length(content.length), content]);

function length(value: number): Buffer {
  if (value < 0x80) return Buffer.from([value]);
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

const sequence = (...items: Buffer[]) => der(0x30, Buffer.concat(items));
const set = (...items: Buffer[]) => der(0x31, Buffer.concat(items));
const integer = (bytes: Buffer) => der(0x02, bytes[0] & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes);
const utf8 = (value: string) => der(0x0c, Buffer.from(value, 'utf8'));
const printable = (value: string) => der(0x13, Buffer.from(value, 'ascii'));
const utcTime = (date: Date) =>
  der(0x17, Buffer.from(`${date.toISOString().slice(2, 19).replace(/[-:T]/g, '')}Z`, 'ascii'));

function oid(dotted: string): Buffer {
  const [first, second, ...rest] = dotted.split('.').map(Number);
  const bytes = [first * 40 + second];
  for (const part of rest) {
    const chunk = [part & 0x7f];
    for (let value = part >> 7; value > 0; value >>= 7) chunk.unshift((value & 0x7f) | 0x80);
    bytes.push(...chunk);
  }
  return der(0x06, Buffer.from(bytes));
}

const NAME_OIDS: Record<string, string> = {
  C: '2.5.4.6',
  ST: '2.5.4.8',
  L: '2.5.4.7',
  O: '2.5.4.10',
  OU: '2.5.4.11',
  CN: '2.5.4.3',
};

function name(attributes: [string, string][]): Buffer {
  return sequence(
    ...attributes.map(([type, value]) =>
      set(sequence(oid(NAME_OIDS[type]), type === 'C' ? printable(value) : utf8(value))),
    ),
  );
}

const toPem = (label: string, body: Buffer): string =>
  `-----BEGIN ${label}-----\n${body
    .toString('base64')
    .match(/.{1,64}/g)!
    .join('\n')}\n-----END ${label}-----\n`;

export function createTestCertificate(
  options: {
    subject?: [string, string][];
    /** Hex serial; the default has 160 bits to exercise the decimal conversion. */
    serialHex?: string;
    notBefore?: Date;
    notAfter?: Date;
  } = {},
): TestCertificate {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const subject = options.subject ?? [
    ['C', 'CO'],
    ['ST', 'Sucre'],
    ['L', 'Sincelejo'],
    ['O', 'Colegio de Pruebas'],
    ['OU', 'FE'],
    ['CN', 'Prueba'],
  ];
  const signatureAlgorithm = sequence(oid('1.2.840.113549.1.1.11'), der(0x05, Buffer.alloc(0)));
  const tbs = sequence(
    der(0xa0, integer(Buffer.from([2]))),
    integer(Buffer.from(options.serialHex ?? '4f1c2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b', 'hex')),
    signatureAlgorithm,
    name(subject),
    sequence(
      utcTime(options.notBefore ?? new Date('2025-01-01T00:00:00Z')),
      utcTime(options.notAfter ?? new Date('2030-01-01T00:00:00Z')),
    ),
    name(subject),
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const signature = sign('sha256', tbs, privateKey);
  const certificateDer = sequence(tbs, signatureAlgorithm, der(0x03, Buffer.concat([Buffer.from([0]), signature])));
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const certificatePem = toPem('CERTIFICATE', certificateDer);
  return {
    privateKey,
    certificate: new X509Certificate(certificateDer),
    pem: keyPem + certificatePem,
    keyPem,
    certificatePem,
  };
}
