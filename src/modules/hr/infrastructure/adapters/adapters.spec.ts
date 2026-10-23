import { TEST_INSTITUTION } from '../../testing/in-memory-misc.js';
import type { EmploymentCertificateContent, PayslipDocument } from '../../application/documents/document-models.js';
import { CryptoSecureRandom } from './crypto-secure-random.js';
import type { DocumentBrandingProvider } from '../../../../shared/infrastructure/documents/document-branding.js';
import {
  employmentCertificateDefinition,
  incomeCertificateDefinition,
  payslipDefinition,
  PdfDocumentRenderer,
} from './pdf-document-renderer.js';

const BRANDING = { institutionName: null, nit: null, logo: null, primaryColor: '#123456', contact: [] };
const brandingProvider = {
  load: vi.fn().mockResolvedValue(BRANDING),
  verificationTarget: vi.fn((kind: string, code: string) => `https://apreu.co/demo/${kind}/${code}`),
} as unknown as DocumentBrandingProvider;
const isPdf = (body: string | Buffer) => Buffer.isBuffer(body) && body.subarray(0, 5).toString() === '%PDF-';

describe('CryptoSecureRandom', () => {
  const random = new CryptoSecureRandom();

  it('creates temporary passwords that satisfy the password policy', () => {
    for (let i = 0; i < 20; i++) {
      const password = random.temporaryPassword();
      expect(password).toHaveLength(12);
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it('creates distinct grouped verification codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => random.verificationCode()));
    expect(codes.size).toBe(50);
    expect([...codes][0]).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  });
});

describe('PdfDocumentRenderer', () => {
  const renderer = new PdfDocumentRenderer(brandingProvider);
  const malicious = '<script>alert(1)</script>';

  it('renders a payslip PDF with totals', async () => {
    const doc: PayslipDocument = {
      institution: { ...TEST_INSTITUTION, name: malicious },
      paymentId: 1,
      status: 'paid',
      period: {
        id: 1,
        name: 'Nómina',
        label: 'marzo 2026',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        paymentDate: '2026-03-30',
      },
      employee: {
        fullName: 'Ana Pérez',
        code: 'EMP0001',
        document: 'CC 123',
        position: malicious,
        department: null,
        contract: 'término indefinido',
        bank: { name: 'Banco', type: 'ahorros', maskedAccount: '****1234' },
      },
      workedDays: 30,
      earnings: [{ label: 'Sueldo básico', amount: 2_000_000 }],
      deductions: [{ label: 'Salud (4 %)', amount: 80_000 }],
      grossTotal: 2_000_000,
      deductionsTotal: 80_000,
      net: 1_920_000,
      netInWords: 'un millón novecientos veinte mil pesos m/cte.',
      employerContributions: [],
    };
    const rendered = await renderer.payslip(doc);
    expect(rendered.contentType).toBe('application/pdf');
    expect(rendered.fileName).toBe('Desprendible_Ana_Perez_marzo_2026.pdf');
    expect(isPdf(rendered.body)).toBe(true);

    const text = JSON.stringify(payslipDefinition(doc, BRANDING));
    expect(text).toContain(malicious); // plain PDF text: nothing is interpreted as markup
    expect(text).toContain('NETO A PAGAR');
    expect(text).toContain('30 de marzo de 2026');
    expect(text).toContain('NIT 900123456-7');
    expect(text).toContain('Banco — AHORROS ****1234');
  });

  it('renders a certificate for current and former employees', async () => {
    const content: EmploymentCertificateContent = {
      institution: TEST_INSTITUTION,
      employeeName: 'Ana Pérez',
      documentLabel: 'cédula de ciudadanía',
      documentNumber: '123',
      position: 'Docente',
      department: null,
      contractLabel: 'término indefinido',
      hireDate: '2024-02-01',
      retirementDate: null,
      currentlyEmployed: true,
      salary: 1_750_905,
      salaryInWords: 'un millón setecientos cincuenta mil novecientos cinco pesos m/cte.',
      addressee: null,
      issuedOn: '2026-03-15',
      verificationCode: 'ABCD-EFGH-JKLM-NPQR',
    };
    const rendered = await renderer.employmentCertificate(content);
    expect(rendered).toMatchObject({ contentType: 'application/pdf', fileName: 'Certificado_Laboral_Ana_Perez.pdf' });
    expect(isPdf(rendered.body)).toBe(true);
    expect(brandingProvider.verificationTarget).toHaveBeenCalledWith('laboral', 'ABCD-EFGH-JKLM-NPQR');

    const definition = employmentCertificateDefinition(content, BRANDING, 'QR-CONTENT');
    const current = JSON.stringify(definition.content);
    expect(current).toContain('labora en esta institución desde el 1 de febrero de 2024');
    expect(current).toContain('Devenga');
    const footer = JSON.stringify((definition.footer as (a: number, b: number) => unknown)(1, 1));
    expect(footer).toContain('ABCD-EFGH-JKLM-NPQR');
    expect(footer).toContain('"qr":"QR-CONTENT"');

    const former = JSON.stringify(
      employmentCertificateDefinition(
        { ...content, currentlyEmployed: false, retirementDate: '2026-01-31', salary: null },
        BRANDING,
        'x',
      ).content,
    );
    expect(former).toContain('hasta el 31 de enero de 2026');
    expect(former).not.toContain('Devenga');
  });

  it('renders the income and withholding certificate', async () => {
    const document = {
      institution: TEST_INSTITUTION,
      issuedOn: '2026-03-15',
      certificate: {
        year: 2025,
        employee: { id: 1, fullName: 'Ana Pérez', document: 'CC 123' },
        payments: 12,
        grossPayments: 24_000_000,
        mandatoryContributions: { health: 960_000, pension: 960_000, solidarityFund: 0, total: 1_920_000 },
        withholding: 0,
        netPaid: 22_080_000,
        note: 'Resumen informativo.',
      },
    };
    const rendered = await renderer.incomeCertificate(document);
    expect(rendered).toMatchObject({
      contentType: 'application/pdf',
      fileName: 'Certificado_Ingresos_2025_Ana_Perez.pdf',
    });
    expect(isPdf(rendered.body)).toBe(true);
    const text = JSON.stringify(incomeCertificateDefinition(document, BRANDING).content);
    expect(text).toContain('Año gravable 2025');
    expect(text).toContain('Total aportes obligatorios');
    expect(text).toContain('Expedido en Bogotá el 15 de marzo de 2026.');
  });
});
