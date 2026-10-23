import type {
  DocumentBranding,
  DocumentBrandingProvider,
} from '../../../../../shared/infrastructure/documents/document-branding.js';
import { issuerConfig, resolution, signedInvoice } from '../../../testing/fixtures.js';
import { invoicePdfDefinition, PdfInvoiceRenderer } from './pdf-invoice.renderer.js';

const BRANDING: DocumentBranding = {
  institutionName: 'Colegio Demo',
  nit: null,
  logo: null,
  primaryColor: '#123456',
  contact: [],
};

describe('PdfInvoiceRenderer', () => {
  const input = () => ({ document: signedInvoice(), issuer: issuerConfig(), resolution: resolution() });

  it('renders a PDF named after the DIAN file', async () => {
    const branding = { load: vi.fn().mockResolvedValue(BRANDING) } as unknown as DocumentBrandingProvider;
    const file = await new PdfInvoiceRenderer(branding).render(input());
    expect(file).toMatchObject({ fileName: 'fv0900123456000260003b023381.pdf', contentType: 'application/pdf' });
    expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('prints issuer, acquirer, lines, totals, CUFE, DIAN QR and numbering authorization', () => {
    const definition = invoicePdfDefinition(input(), BRANDING);
    const content = JSON.stringify(definition.content);
    expect(content).toContain('Factura electrónica de venta');
    expect(content).toContain('No. SETP990000001');
    expect(content).toContain('900123456-8');
    expect(content).toContain('cufe-1');
    expect(content).toContain('searchqr?documentkey=cufe-1');
    expect(content).toContain('Autorización de numeración DIAN No. 18760000001');
    expect(content).toContain('ambiente de habilitación');
    expect(content).toMatch(/350\.000/);
  });

  it('omits the authorization legend when the resolution is unknown', () => {
    const content = JSON.stringify(invoicePdfDefinition({ ...input(), resolution: null }, BRANDING).content);
    expect(content).not.toContain('Autorización de numeración');
  });
});
