import { Injectable } from '@nestjs/common';
import { DocumentBrandingProvider } from '../../../../../shared/infrastructure/documents/document-branding.js';
import {
  dataTable,
  institutionalDocument,
  signatures,
} from '../../../../../shared/infrastructure/documents/institutional-layout.js';
import { renderPdf, type PdfContent } from '../../../../../shared/infrastructure/documents/pdf-document.js';
import type { ReportCardDocument } from '../../application/report-card-document.js';
import type { ReportCardRendererPort } from '../../application/ports/report-card-renderer.port.js';

const score = (value: number): string => value.toFixed(1);
const dateTime = (date: Date): string =>
  date.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' });

/**
 * Report card PDF following the legacy printable layout
 * (`academic/bulletin_view.php`), rendered with pdfmake: school letterhead
 * (logo, NIT, colors), student band, grades table with the 60/30/10
 * components, performance level and observations per subject, absences and
 * signatures. Long report cards flow to several pages with the table header
 * repeated.
 */
@Injectable()
export class PdfReportCardRenderer implements ReportCardRendererPort {
  constructor(private readonly branding: DocumentBrandingProvider) {}

  async render(doc: ReportCardDocument): Promise<Uint8Array> {
    const branding = await this.branding.load();
    const color = branding.primaryColor;
    const studentBand: PdfContent = {
      table: {
        widths: ['auto', '*', 'auto', 'auto'],
        body: [
          [{ text: 'Estudiante', bold: true }, doc.student.fullName, { text: 'Código', bold: true }, doc.student.code],
          [
            { text: 'Grado - Grupo', bold: true },
            doc.classroom ? `${doc.classroom.gradeName} - ${doc.classroom.name}` : 'Sin salón',
            { text: 'Promedio general', bold: true },
            { text: `${doc.averageScore.toFixed(2)} (${doc.averagePerformance.label})`, bold: true, color },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 10],
    };
    const grades = dataTable(
      [
        { header: 'Área / Asignatura', width: '*' },
        { header: 'Docente', width: 110 },
        { header: 'Cog 60%', width: 38, align: 'center' },
        { header: 'Pro 30%', width: 38, align: 'center' },
        { header: 'Act 10%', width: 38, align: 'center' },
        { header: 'Final', width: 34, align: 'center' },
        { header: 'Desempeño', width: 62 },
      ],
      doc.lines.map((line) => [
        `${line.area} · ${line.subjectName}\n${line.observations ?? 'Sin observaciones'}`,
        line.teacherName ?? 'Sin asignar',
        score(line.cognitive),
        score(line.procedural),
        score(line.attitudinal),
        score(line.finalScore),
        line.performance.label,
      ]),
      { color, fontSize: 8 },
    );

    const definition = institutionalDocument({
      branding,
      institution: { name: doc.institution.name, nit: doc.institution.nit, details: [doc.institution.address] },
      title: 'INFORME ACADÉMICO OFICIAL',
      subtitle: `${doc.period.name} · Año lectivo ${doc.period.academicYear}`,
      footerNote: `${doc.institution.name} · Generado por Apreu el ${dateTime(doc.generatedAt)}`,
      content: [
        studentBand,
        grades,
        { text: `Inasistencias en el período: ${doc.absences}`, margin: [0, 10, 0, 0] },
        signatures([
          { name: 'Rectoría / Coordinación', role: doc.institution.name },
          {
            name: doc.groupDirectorName ?? 'Director de grupo',
            role: doc.groupDirectorName ? 'Director de grupo' : '',
          },
        ]),
      ],
    });
    return new Uint8Array(await renderPdf(definition));
  }
}
