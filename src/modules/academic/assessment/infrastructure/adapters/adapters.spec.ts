import { inflateRawSync } from 'node:zlib';
import { FixedClock } from '../../../../../shared/testing/fakes.js';
import type { ReportCardDocument } from '../../application/report-card-document.js';
import type { DocumentBrandingProvider } from '../../../../../shared/infrastructure/documents/document-branding.js';
import { PdfReportCardRenderer } from './pdf-report-card.renderer.js';
import { ZipDocumentArchiver } from './zip-document.archiver.js';

const document = (lines = 1): ReportCardDocument => ({
  institution: { name: 'Colegio (Demo)', nit: '900.1', address: 'Calle 1', logo: null },
  student: { id: 1, code: 'E1', fullName: 'PÉREZ ANA', documentNumber: '1' },
  classroom: { name: '5A', gradeName: 'Quinto' },
  groupDirectorName: 'Laura Gómez',
  period: { id: 1, name: 'Primer Período', academicYear: 2026, startDate: '2026-02-01', endDate: '2026-04-15' },
  lines: Array.from({ length: lines }, (_, i) => ({
    subjectId: i,
    subjectName: `Materia ${i}`,
    area: 'Ciencias',
    teacherName: null,
    cognitive: 4,
    procedural: 3,
    attitudinal: 5,
    finalScore: 3.8,
    passing: true,
    performance: { level: 'basico' as const, label: 'Básico' },
    observations: null,
  })),
  averageScore: 3.8,
  averagePerformance: { level: 'basico', label: 'Básico' },
  passing: true,
  absences: 2,
  generatedAt: new Date('2026-04-20T10:00:00Z'),
  viewCount: 0,
});

describe('PdfReportCardRenderer', () => {
  const branding = {
    load: vi.fn().mockResolvedValue({
      institutionName: null,
      nit: null,
      logo: null,
      primaryColor: '#123456',
      contact: [],
    }),
  } as unknown as DocumentBrandingProvider;
  const pageCount = (bytes: Uint8Array) =>
    Buffer.from(bytes)
      .toString('latin1')
      .match(/\/Type \/Page\b/g)?.length ?? 0;

  it('produces a branded PDF report card', async () => {
    const bytes = await new PdfReportCardRenderer(branding).render(document());
    const pdf = Buffer.from(bytes).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(branding.load).toHaveBeenCalled();
    expect(pageCount(bytes)).toBe(1);
  });

  it('breaks long report cards into several pages', async () => {
    expect(pageCount(await new PdfReportCardRenderer(branding).render(document(60)))).toBeGreaterThan(1);
  });
});

describe('ZipDocumentArchiver', () => {
  it('writes a valid deflate ZIP with UTF-8 names', async () => {
    const content = new TextEncoder().encode('contenido del boletín');
    const zip = Buffer.from(
      await new ZipDocumentArchiver(new FixedClock()).archive([
        { fileName: 'a.pdf', content },
        { fileName: 'b.pdf', content: new Uint8Array([1, 2, 3]) },
      ]),
    );
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const end = zip.subarray(zip.length - 22);
    expect(end.readUInt32LE(0)).toBe(0x06054b50);
    expect(end.readUInt16LE(10)).toBe(2);
    const nameLength = zip.readUInt16LE(26);
    const compressedSize = zip.readUInt32LE(18);
    expect(zip.subarray(30, 30 + nameLength).toString()).toBe('a.pdf');
    const data = inflateRawSync(zip.subarray(30 + nameLength, 30 + nameLength + compressedSize));
    expect(new TextDecoder().decode(data)).toBe('contenido del boletín');
  });
});
