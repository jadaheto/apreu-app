import type { CertificateSnapshot } from '../domain/certificate.js';
import { composeCertificateText, documentLabel } from './certificate-text.js';

const snapshot: CertificateSnapshot = {
  studentName: 'Sofía Gómez',
  studentCode: 'AL20260001',
  documentType: 'TI',
  documentNumber: '1101',
  gradeName: 'Quinto',
  classroomName: 'A',
  academicYear: 2026,
  studentStatus: 'graduated',
  enrollmentDate: '2026-01-20',
};

describe('composeCertificateText', () => {
  it('builds the Spanish certificate text from the snapshot', () => {
    const text = composeCertificateText(snapshot, new Date('2026-03-16T02:00:00Z'));
    expect(text.title).toBe('EL RECTOR CERTIFICA QUE');
    expect(text.paragraphs[0]).toBe(
      'El/la estudiante Sofía Gómez, identificado/a con T.I. No. 1101, código AL20260001, se encuentra matriculado/a y cursa estudios correspondientes al grado Quinto - A en esta institución educativa durante el año lectivo 2026.',
    );
    expect(text.paragraphs[1]).toBe(
      'El/la estudiante se encuentra en estado GRADUADO con fecha de matrícula del 20 de enero de 2026.',
    );
    expect(text.issuedOn).toBe('15 de marzo de 2026');
  });

  it('omits missing grade, document and enrollment date', () => {
    const text = composeCertificateText(
      {
        ...snapshot,
        gradeName: null,
        classroomName: null,
        documentNumber: null,
        enrollmentDate: null,
        studentStatus: 'active',
      },
      new Date('2026-03-15T15:00:00Z'),
    );
    expect(text.paragraphs[0]).toBe(
      'El/la estudiante Sofía Gómez, código AL20260001, se encuentra matriculado/a y cursa estudios en esta institución educativa durante el año lectivo 2026.',
    );
    expect(text.paragraphs[1]).toBe('El/la estudiante se encuentra en estado ACTIVO.');
  });

  it('labels document types', () => {
    expect(documentLabel('PP')).toBe('Pasaporte');
    expect(documentLabel('XX')).toBe('XX');
  });
});
