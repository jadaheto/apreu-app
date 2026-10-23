import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestCertificate, type TestCertificate } from '../../../testing/self-signed-certificate.js';
import { parsePem, PemCertificateStore } from './pem-certificate-store.js';

describe('PemCertificateStore', () => {
  let directory: string;
  let certificate: TestCertificate;

  beforeAll(() => {
    certificate = createTestCertificate();
  });

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'e-invoicing-certs-'));
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  const store = (dir: string | null = directory, slug = 'colegio-a') =>
    new PemCertificateStore({ directory: dir, tenantSlug: () => slug });

  it('describes the certificate of the tenant with a decimal serial', async () => {
    writeFileSync(join(directory, 'colegio-a.pem'), certificate.pem);
    const info = await store().describe();
    expect(info).toMatchObject({
      serialNumber: BigInt('0x4f1c2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b').toString(),
      validTo: new Date('2030-01-01T00:00:00Z'),
    });
    expect(info?.subject).toContain('CN=Prueba');
    expect((await store().credentials()).certificateBase64).toBe(certificate.certificate.raw.toString('base64'));
  });

  it('returns null when not configured or the tenant has no certificate', async () => {
    await expect(store(null).describe()).resolves.toBeNull();
    await expect(store(directory, 'otro').describe()).resolves.toBeNull();
    await expect(store(null).credentials()).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
  });

  it('never reads certificates from inside the application directory', async () => {
    await expect(store(join(process.cwd(), 'config/certs')).describe()).rejects.toThrow('dentro del directorio');
    await expect(store('relativo/certs').describe()).rejects.toThrow('ruta absoluta');
  });

  it('reads encrypted PKCS#8 keys with the passphrase file', async () => {
    const encrypted = certificate.privateKey
      .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 's3creta' })
      .toString();
    writeFileSync(join(directory, 'colegio-a.pem'), encrypted + certificate.certificatePem);
    writeFileSync(join(directory, 'colegio-a.passphrase'), 's3creta\n');
    await expect(store().describe()).resolves.not.toBeNull();
  });

  it('validates the PEM bundle', () => {
    expect(() => parsePem(certificate.certificatePem)).toThrow('clave privada');
    const other = createTestCertificate();
    expect(() => parsePem(certificate.keyPem + other.certificatePem)).toThrow('corresponde');
    expect(() =>
      parsePem(
        certificate.privateKey
          .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'x' })
          .toString() + certificate.certificatePem,
        'mala',
      ),
    ).toThrow('contraseña');
  });
});
