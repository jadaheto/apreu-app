import { Certificate, type CertificateType } from '../../domain/certificate.js';
import { Guardian } from '../../domain/guardian.js';
import { Incident } from '../../domain/incident.js';
import { Student } from '../../domain/student.js';
import { StudentCode } from '../../domain/student-code.js';
import { CertificateOrmEntity } from './certificate.orm-entity.js';
import { GuardianOrmEntity } from './guardian.orm-entity.js';
import { IncidentOrmEntity } from './incident.orm-entity.js';
import { StudentOrmEntity } from './student.orm-entity.js';

/**
 * Translates between rows and aggregates. Nullable legacy columns with a
 * database default are read with that same default.
 */
export const StudentMapper = {
  toDomain(row: StudentOrmEntity): Student {
    return Student.restore(row.id, {
      userId: row.userId,
      code: StudentCode.restore(row.code),
      firstName: row.firstName,
      lastName: row.lastName,
      documentType: row.documentType ?? 'TI',
      documentNumber: row.documentNumber,
      birthDate: row.birthDate,
      gender: row.gender ?? 'M',
      bloodType: row.bloodType || null,
      address: row.address,
      city: row.city,
      neighborhood: row.neighborhood,
      phone: row.phone,
      email: row.email || null,
      status: row.status,
      guardianId: row.guardianId,
      classroomId: row.classroomId,
      academicYear: row.academicYear === null ? null : Number(row.academicYear),
      scholarshipPct: row.scholarshipPct ?? 0,
      notes: row.notes,
      photo: row.photo,
      eps: row.eps,
      enrollmentDate: row.enrollmentDate,
      createdAt: row.createdAt,
    });
  },

  toPersistence(student: Student): StudentOrmEntity {
    const row = new StudentOrmEntity();
    if (student.id !== null) row.id = student.id;
    row.userId = student.userId;
    row.code = student.code.toString();
    row.firstName = student.firstName;
    row.lastName = student.lastName;
    row.documentType = student.documentType;
    row.documentNumber = student.documentNumber;
    row.birthDate = student.birthDate;
    row.gender = student.gender;
    row.bloodType = student.bloodType;
    row.address = student.address;
    row.city = student.city;
    row.neighborhood = student.neighborhood;
    row.phone = student.phone;
    row.email = student.email;
    row.status = student.status;
    row.guardianId = student.guardianId;
    row.classroomId = student.classroomId;
    row.academicYear = student.academicYear;
    row.scholarshipPct = student.scholarshipPct;
    row.notes = student.notes;
    row.photo = student.photo;
    row.eps = student.eps;
    row.enrollmentDate = student.enrollmentDate;
    return row;
  },
};

export const GuardianMapper = {
  toDomain(row: GuardianOrmEntity): Guardian {
    return Guardian.restore(row.id, {
      documentType: row.documentType ?? 'cc',
      documentNumber: row.documentNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      relationship: row.relationship ?? 'padre',
      phone: row.phone,
      mobile: row.mobile,
      email: row.email || null,
      address: row.address,
      city: row.city,
      occupation: row.occupation,
      userId: row.userId,
      createdAt: row.createdAt,
    });
  },

  toPersistence(guardian: Guardian): GuardianOrmEntity {
    const row = new GuardianOrmEntity();
    if (guardian.id !== null) row.id = guardian.id;
    row.documentType = guardian.documentType;
    row.documentNumber = guardian.documentNumber;
    row.firstName = guardian.firstName;
    row.lastName = guardian.lastName;
    row.relationship = guardian.relationship;
    row.phone = guardian.phone;
    row.mobile = guardian.mobile;
    row.email = guardian.email;
    row.address = guardian.address;
    row.city = guardian.city;
    row.occupation = guardian.occupation;
    row.userId = guardian.userId;
    return row;
  },
};

export const IncidentMapper = {
  toDomain(row: IncidentOrmEntity): Incident {
    return Incident.restore(row.id, {
      studentId: row.studentId,
      requestedBy: row.requestedBy,
      reviewedBy: row.reviewedBy,
      type: row.type || 'otra',
      priority: row.priority ?? 'medium',
      title: row.title,
      description: row.description,
      reviewNotes: row.reviewNotes,
      status: row.status ?? 'pending',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(incident: Incident): IncidentOrmEntity {
    const row = new IncidentOrmEntity();
    if (incident.id !== null) row.id = incident.id;
    row.studentId = incident.studentId;
    row.requestedBy = incident.requestedBy;
    row.reviewedBy = incident.reviewedBy;
    row.type = incident.type;
    row.priority = incident.priority;
    row.title = incident.title;
    row.description = incident.description;
    row.reviewNotes = incident.reviewNotes;
    row.status = incident.status;
    row.createdAt = incident.createdAt;
    row.updatedAt = incident.updatedAt;
    return row;
  },
};

export const CertificateMapper = {
  toDomain(row: CertificateOrmEntity): Certificate {
    return Certificate.restore(row.id, {
      studentId: row.studentId,
      type: row.type as CertificateType,
      status: row.status ?? 'pending',
      paymentId: row.paymentId,
      generatedAt: row.generatedAt,
      pdfPath: row.pdfPath,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      verificationCode: row.verificationCode,
      snapshot: row.snapshot,
    });
  },

  toPersistence(certificate: Certificate): CertificateOrmEntity {
    const row = new CertificateOrmEntity();
    if (certificate.id !== null) row.id = certificate.id;
    row.studentId = certificate.studentId;
    row.type = certificate.type;
    row.status = certificate.status;
    row.paymentId = certificate.paymentId;
    row.generatedAt = certificate.generatedAt;
    row.pdfPath = certificate.pdfPath;
    row.notes = certificate.notes;
    row.createdBy = certificate.createdBy;
    row.createdAt = certificate.createdAt;
    row.verificationCode = certificate.verificationCode;
    row.snapshot = certificate.snapshot;
    return row;
  },
};
