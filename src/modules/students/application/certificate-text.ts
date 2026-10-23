import type { CertificateSnapshot } from '../domain/certificate.js';

const DOCUMENT_LABELS: Record<string, string> = {
  TI: 'T.I.',
  RC: 'R.C.',
  CC: 'C.C.',
  PP: 'Pasaporte',
  CE: 'C.E.',
};

/** Every status has its own label; legacy printed "RETIRADO" for anything but active (B21). */
const STATUS_LABELS: Record<string, string> = {
  active: 'ACTIVO',
  inactive: 'INACTIVO',
  graduated: 'GRADUADO',
  withdrawn: 'RETIRADO',
  suspended: 'SUSPENDIDO',
};

const longDate = (date: Date): string =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(date);

/** `YYYY-MM-DD` → "15 de marzo de 2026". */
const longDay = (day: string): string => longDate(new Date(`${day}T12:00:00-05:00`));

export const documentLabel = (type: string): string => DOCUMENT_LABELS[type] ?? type;

export interface CertificateText {
  title: string;
  paragraphs: string[];
  /** "Expedido el …" date in Spanish (no `strftime`/locale dependency, B20). */
  issuedOn: string;
}

/**
 * Text of the study certificate, unifying the two legacy versions
 * (`student/certificate.php` and `students/portal.php`, analysis 03 rules
 * 31-32) and built from the snapshot taken at issuance.
 */
export const composeCertificateText = (snapshot: CertificateSnapshot, issuedAt: Date): CertificateText => {
  const grade = snapshot.gradeName
    ? ` correspondientes al grado ${snapshot.classroomName ? `${snapshot.gradeName} - ${snapshot.classroomName}` : snapshot.gradeName}`
    : '';
  const document = snapshot.documentNumber
    ? `, identificado/a con ${documentLabel(snapshot.documentType)} No. ${snapshot.documentNumber}`
    : '';
  const status = STATUS_LABELS[snapshot.studentStatus] ?? snapshot.studentStatus.toUpperCase();
  const enrollment = snapshot.enrollmentDate ? ` con fecha de matrícula del ${longDay(snapshot.enrollmentDate)}` : '';

  return {
    title: 'EL RECTOR CERTIFICA QUE',
    paragraphs: [
      `El/la estudiante ${snapshot.studentName}${document}, código ${snapshot.studentCode}, se encuentra matriculado/a y cursa estudios${grade} en esta institución educativa durante el año lectivo ${snapshot.academicYear}.`,
      `El/la estudiante se encuentra en estado ${status}${enrollment}.`,
      'Se expide este certificado a solicitud del interesado(a), para los fines que estime pertinentes.',
    ],
    issuedOn: longDate(issuedAt),
  };
};
