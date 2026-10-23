import { createPrivateKey, type KeyObject, X509Certificate } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import type { CertificateInfo, CertificateStorePort } from '../../../application/ports/certificate-store.port.js';

/** Key material used by the XAdES signer and the WS-Security envelope. */
export interface SigningCredentials {
  privateKey: KeyObject;
  certificate: X509Certificate;
  /** DER of the leaf certificate, base64 in one line. */
  certificateBase64: string;
}

/** Infrastructure-side access to the key material (never exposed to the application layer). */
export interface SigningCredentialsSource {
  credentials(): Promise<SigningCredentials>;
}

export interface PemCertificateStoreOptions {
  /** Absolute directory holding the certificates (env `E_INVOICING_CERTS_DIR`). `null` = not configured. */
  directory: string | null;
  /** Slug of the school whose certificate is requested. */
  tenantSlug: () => string;
  /** Application root; the directory must be outside it (never in the repository). */
  applicationRoot?: string;
}

interface CacheEntry {
  modifiedAt: number;
  credentials: SigningCredentials;
}

const PEM_BLOCK = /-----BEGIN ([A-Z ]+)-----[\s\S]+?-----END \1-----/g;

/**
 * Reads each school's signing certificate from `<E_INVOICING_CERTS_DIR>/<slug>.pem`
 * (PEM with the private key — PKCS#8, optionally encrypted — and the
 * certificate chain) and the optional passphrase from `<slug>.passphrase`.
 *
 * PKCS#12 (`.p12`) is not parsed: Node's `crypto` has no PKCS#12 reader and no
 * extra library may be installed. Convert it once, outside the repository:
 * `openssl pkcs12 -in cert.p12 -nocerts | openssl pkcs8 -topk8 -v2 aes-256-cbc > slug.pem`
 * followed by `openssl pkcs12 -in cert.p12 -nokeys >> slug.pem`.
 *
 * Fixes the legacy storage in `config/certs/` (inside the web root, PEM key
 * unencrypted, password in clear in `settings`).
 */
export class PemCertificateStore implements CertificateStorePort, SigningCredentialsSource {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly options: PemCertificateStoreOptions) {}

  async describe(): Promise<CertificateInfo | null> {
    const credentials = await this.load();
    if (!credentials) return null;
    const { certificate } = credentials;
    return {
      subject: certificate.subject.split('\n').join(', '),
      issuer: certificate.issuer.split('\n').join(', '),
      serialNumber: BigInt(`0x${certificate.serialNumber}`).toString(),
      validFrom: new Date(certificate.validFrom),
      validTo: new Date(certificate.validTo),
    };
  }

  async credentials(): Promise<SigningCredentials> {
    const credentials = await this.load();
    if (!credentials)
      throw new ExternalServiceError('Certificado', 'no hay un certificado de firma digital configurado.');
    return credentials;
  }

  private async load(): Promise<SigningCredentials | null> {
    const directory = this.directory();
    if (!directory) return null;
    const slug = this.options.tenantSlug();
    const pemPath = join(directory, `${slug}.pem`);
    const modifiedAt = await stat(pemPath).then(
      (info) => info.mtimeMs,
      () => null,
    );
    if (modifiedAt === null) return null;

    const cached = this.cache.get(slug);
    if (cached && cached.modifiedAt === modifiedAt) return cached.credentials;
    const passphrase = await readFile(join(directory, `${slug}.passphrase`), 'utf8').then(
      (value) => value.trim(),
      () => undefined,
    );
    const credentials = parsePem(await readFile(pemPath, 'utf8'), passphrase);
    this.cache.set(slug, { modifiedAt, credentials });
    return credentials;
  }

  private directory(): string | null {
    const configured = this.options.directory?.trim();
    if (!configured) return null;
    if (!isAbsolute(configured)) {
      throw new ExternalServiceError('Certificado', 'E_INVOICING_CERTS_DIR debe ser una ruta absoluta.');
    }
    const root = resolve(this.options.applicationRoot ?? process.cwd());
    const fromRoot = relative(root, resolve(configured));
    if (!fromRoot.startsWith('..') && !isAbsolute(fromRoot)) {
      throw new ExternalServiceError(
        'Certificado',
        'los certificados no pueden guardarse dentro del directorio de la aplicación.',
      );
    }
    return configured;
  }
}

/** Extracts the private key and the certificate that matches it from a PEM bundle. */
export function parsePem(pem: string, passphrase?: string): SigningCredentials {
  const blocks = [...pem.matchAll(PEM_BLOCK)].map((match) => ({ label: match[1], text: match[0] }));
  const keyBlock = blocks.find((block) => block.label.endsWith('PRIVATE KEY'));
  if (!keyBlock) throw new ExternalServiceError('Certificado', 'el archivo PEM no contiene la clave privada.');

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: keyBlock.text, format: 'pem', passphrase });
  } catch {
    throw new ExternalServiceError('Certificado', 'no se pudo leer la clave privada (¿contraseña incorrecta?).');
  }
  const certificate = blocks
    .filter((block) => block.label === 'CERTIFICATE')
    .map((block) => new X509Certificate(block.text))
    .find((candidate) => candidate.checkPrivateKey(privateKey));
  if (!certificate) {
    throw new ExternalServiceError('Certificado', 'ningún certificado del archivo corresponde a la clave privada.');
  }
  return { privateKey, certificate, certificateBase64: certificate.raw.toString('base64') };
}
