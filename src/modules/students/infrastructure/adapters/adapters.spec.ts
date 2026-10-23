import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { DocumentBrandingProvider } from '../../../../shared/infrastructure/documents/document-branding.js';
import type { CertificateDocumentView } from '../../application/get-certificate-document.use-case.js';
import { certificateDefinition, PdfCertificateRenderer } from './pdf-certificate.renderer.js';
import { CryptoSecretGenerator } from './crypto-secret-generator.js';
import { HmacQrSigner } from './hmac-qr-signer.js';
import { LocalDiskFileStorage } from './local-disk-file-storage.js';

describe('CryptoSecretGenerator', () => {
  const generator = new CryptoSecretGenerator();

  it('generates unpredictable 12-character passwords with letters and digits', () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generator.temporaryPassword()));
    expect(passwords.size).toBe(200);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z2-9]{12}$/);
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it('generates URL-safe verification codes', () => {
    expect(generator.verificationCode()).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(generator.verificationCode()).not.toBe(generator.verificationCode());
  });
});

describe('HmacQrSigner', () => {
  it('signs with the dedicated secret and verifies in constant time', () => {
    const signer = HmacQrSigner.create('secreto-qr', 'jwt');
    const signature = signer.sign('APREU1|colegio|1|2026');
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(signer.verify('APREU1|colegio|1|2026', signature)).toBe(true);
    expect(signer.verify('APREU1|colegio|2|2026', signature)).toBe(false);
    expect(signer.verify('APREU1|colegio|1|2026', 'short')).toBe(false);
  });

  it('derives a key from the JWT secret when no dedicated secret is configured', () => {
    const derived = HmacQrSigner.create(undefined, 'jwt-secret');
    expect(derived.sign('m')).toBe(HmacQrSigner.create('  ', 'jwt-secret').sign('m'));
    expect(derived.sign('m')).not.toBe(HmacQrSigner.create('jwt-secret', 'x').sign('m'));
  });
});

describe('LocalDiskFileStorage', () => {
  let root: string;
  let storage: LocalDiskFileStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apreu-uploads-'));
    storage = new LocalDiskFileStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('saves, reads and removes files inside the root', async () => {
    const path = await storage.save('students', 'student_1_1.jpg', new Uint8Array([1, 2, 3]));
    expect(path).toBe('students/student_1_1.jpg');
    expect([...(await readFile(join(root, path)))]).toEqual([1, 2, 3]);
    expect((await stat(join(root, path))).mode & 0o777).toBe(0o640);
    expect([...(await storage.read(path))]).toEqual([1, 2, 3]);
    await storage.remove(path);
    await storage.remove(path);
    await expect(storage.read(path)).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    ['../etc', 'a.jpg'],
    ['students', '../a.jpg'],
    ['students', 'a.php.'],
    ['stu/dents', 'a.jpg'],
  ])('rejects unsafe names %s/%s', async (directory, fileName) => {
    await expect(storage.save(directory, fileName, new Uint8Array([1]))).rejects.toMatchObject({
      code: 'INVALID_FILE_NAME',
    });
  });

  it('rejects path traversal on read and remove', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toMatchObject({
      code: 'INVALID_FILE_PATH',
    });
    await expect(storage.remove('../x')).rejects.toMatchObject({
      code: 'INVALID_FILE_PATH',
    });
  });
});

describe('PdfCertificateRenderer', () => {
  const BRANDING = { institutionName: null, nit: null, logo: null, primaryColor: '#123456', contact: [] };
  const doc: CertificateDocumentView = {
    certificate: {
      id: 1,
      studentId: 3,
      type: 'certificado_estudiantil',
      status: 'generated',
      paymentId: null,
      notes: null,
      verificationCode: 'Abc123',
      issuedAt: new Date('2026-03-15T15:00:00Z'),
      snapshot: {
        studentName: 'Sofía Gómez',
        studentCode: 'E1',
        documentType: 'TI',
        documentNumber: '1',
        gradeName: 'Quinto',
        classroomName: 'A',
        academicYear: 2026,
        studentStatus: 'active',
        enrollmentDate: null,
      },
    },
    institution: {
      name: 'Colegio Demo',
      nit: '900123',
      city: 'Sincelejo',
      logo: null,
      signature: null,
      rectorName: 'Ana Rectora',
    },
    text: {
      title: 'EL RECTOR CERTIFICA QUE',
      paragraphs: ['El/la estudiante Sofía Gómez…'],
      issuedOn: '15 de marzo de 2026',
    },
  };

  it('renders a PDF with letterhead, text, signature and verification QR', async () => {
    const branding = {
      load: vi.fn().mockResolvedValue(BRANDING),
      verificationTarget: vi.fn().mockReturnValue('https://apreu.co/demo/verificar/Abc123'),
    } as unknown as DocumentBrandingProvider;
    const file = await new PdfCertificateRenderer(branding).render(doc);
    expect(file).toMatchObject({ fileName: 'Certificado_Sofia_Gomez_Abc123.pdf', contentType: 'application/pdf' });
    expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(branding.verificationTarget).toHaveBeenCalledWith('estudiantil', 'Abc123');

    const definition = certificateDefinition(doc, BRANDING, 'QR');
    const content = JSON.stringify(definition.content);
    expect(content).toContain('NIT 900123');
    expect(content).toContain('EL RECTOR CERTIFICA QUE');
    expect(content).toContain('Expedido en Sincelejo el 15 de marzo de 2026.');
    expect(content).toContain('Ana Rectora');
    expect(JSON.stringify((definition.footer as (a: number, b: number) => unknown)(1, 1))).toContain('"qr":"QR"');
  });
});
