import type { Certificate, CertificateSnapshot } from '../domain/certificate.js';
import type { ClassroomInfo } from '../domain/classroom-directory.port.js';
import type { Guardian } from '../domain/guardian.js';
import type { Incident } from '../domain/incident.js';
import type { Student } from '../domain/student.js';

/** Classroom placement shown next to a student. */
export interface PlacementView {
  classroomId: number;
  classroomName: string;
  gradeId: number;
  gradeName: string;
  gradeLevel: string;
  academicYear: number;
}

/** Guardian data returned by the API (no internal user id). */
export interface GuardianView {
  id: number;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  hasPortalAccount: boolean;
}

/** Row of the student directory. */
export interface StudentSummaryView {
  id: number;
  code: string;
  fullName: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string | null;
  gender: string;
  status: string;
  scholarshipPct: number;
  photoAvailable: boolean;
  placement: PlacementView | null;
  guardian: { id: number; fullName: string; mobile: string | null } | null;
}

/** Full record of a student (personal, health and enrollment data). */
export interface StudentView extends StudentSummaryView {
  documentType: string;
  documentNumber: string | null;
  birthDate: string | null;
  bloodType: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  eps: string | null;
  notes: string | null;
  enrollmentDate: string | null;
  academicYear: number | null;
  hasPortalAccount: boolean;
  guardianDetails: GuardianView | null;
}

export interface IncidentView {
  id: number;
  studentId: number | null;
  requestedBy: number | null;
  reviewedBy: number | null;
  type: string;
  priority: string;
  title: string;
  description: string | null;
  reviewNotes: string | null;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CertificateView {
  id: number;
  studentId: number;
  type: string;
  status: string;
  paymentId: number | null;
  notes: string | null;
  verificationCode: string | null;
  issuedAt: Date | null;
  snapshot: CertificateSnapshot | null;
}

export const toPlacementView = (classroom: ClassroomInfo | null | undefined): PlacementView | null =>
  classroom
    ? {
        classroomId: classroom.id,
        classroomName: classroom.name,
        gradeId: classroom.gradeId,
        gradeName: classroom.gradeName,
        gradeLevel: classroom.gradeLevel,
        academicYear: classroom.academicYear,
      }
    : null;

export const toGuardianView = (guardian: Guardian): GuardianView => ({
  id: guardian.id as number,
  documentType: guardian.documentType,
  documentNumber: guardian.documentNumber,
  firstName: guardian.firstName,
  lastName: guardian.lastName,
  fullName: guardian.fullName,
  relationship: guardian.relationship,
  phone: guardian.phone,
  mobile: guardian.mobile,
  email: guardian.email,
  address: guardian.address,
  city: guardian.city,
  occupation: guardian.occupation,
  hasPortalAccount: guardian.userId !== null,
});

export const toStudentSummaryView = (
  student: Student,
  classroom: ClassroomInfo | null | undefined,
  guardian: Guardian | null | undefined,
): StudentSummaryView => ({
  id: student.id as number,
  code: student.code.toString(),
  fullName: student.fullName,
  firstName: student.firstName,
  lastName: student.lastName,
  initials: student.initials,
  email: student.email,
  gender: student.gender,
  status: student.status,
  scholarshipPct: student.scholarshipPct,
  photoAvailable: student.photo !== null,
  placement: toPlacementView(classroom),
  guardian: guardian
    ? {
        id: guardian.id as number,
        fullName: guardian.fullName,
        mobile: guardian.mobile,
      }
    : null,
});

export const toStudentView = (
  student: Student,
  classroom: ClassroomInfo | null | undefined,
  guardian: Guardian | null | undefined,
): StudentView => ({
  ...toStudentSummaryView(student, classroom, guardian),
  documentType: student.documentType,
  documentNumber: student.documentNumber,
  birthDate: student.birthDate,
  bloodType: student.bloodType,
  address: student.address,
  city: student.city,
  neighborhood: student.neighborhood,
  phone: student.phone,
  eps: student.eps,
  notes: student.notes,
  enrollmentDate: student.enrollmentDate,
  academicYear: student.academicYear,
  hasPortalAccount: student.userId !== null,
  guardianDetails: guardian ? toGuardianView(guardian) : null,
});

export const toIncidentView = (incident: Incident): IncidentView => ({
  id: incident.id as number,
  studentId: incident.studentId,
  requestedBy: incident.requestedBy,
  reviewedBy: incident.reviewedBy,
  type: incident.type,
  priority: incident.priority,
  title: incident.title,
  description: incident.description,
  reviewNotes: incident.reviewNotes,
  status: incident.status,
  createdAt: incident.createdAt,
  updatedAt: incident.updatedAt,
});

export const toCertificateView = (certificate: Certificate): CertificateView => ({
  id: certificate.id as number,
  studentId: certificate.studentId,
  type: certificate.type,
  status: certificate.status,
  paymentId: certificate.paymentId,
  notes: certificate.notes,
  verificationCode: certificate.isValid ? certificate.verificationCode : null,
  issuedAt: certificate.createdAt,
  snapshot: certificate.snapshot,
});
