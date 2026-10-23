import { Certificate } from '../../domain/certificate.js';
import { Guardian } from '../../domain/guardian.js';
import { Incident } from '../../domain/incident.js';
import { Student } from '../../domain/student.js';
import { StudentCode } from '../../domain/student-code.js';
import { CertificateOrmEntity } from './certificate.orm-entity.js';
import { GuardianOrmEntity } from './guardian.orm-entity.js';
import { IncidentOrmEntity } from './incident.orm-entity.js';
import { CertificateMapper, GuardianMapper, IncidentMapper, StudentMapper } from './mappers.js';
import { StudentOrmEntity } from './student.orm-entity.js';
import { decimalTransformer } from './transformers.js';

const at = new Date('2026-03-15T15:00:00Z');

describe('persistence mappers', () => {
  it('round-trips a student', () => {
    const student = Student.enroll({
      code: StudentCode.compose(2026, 1),
      details: {
        firstName: 'Sofía',
        lastName: 'Gómez',
        documentNumber: '1',
        notes: 'Asma',
        scholarshipPct: 10,
      },
      classroomId: 10,
      academicYear: 2026,
      enrollmentDate: '2026-01-20',
      guardianId: 3,
      today: '2026-03-15',
    });
    const row = StudentMapper.toPersistence(student);
    expect(row).toMatchObject({
      code: 'AL20260001',
      notes: 'Asma',
      scholarshipPct: 10,
      guardianId: 3,
    });
    row.id = 7;
    const restored = StudentMapper.toDomain(row);
    expect(restored).toMatchObject({
      id: 7,
      fullName: 'Sofía Gómez',
      notes: 'Asma',
      academicYear: 2026,
    });
  });

  it('applies database defaults to legacy rows', () => {
    const row = Object.assign(new StudentOrmEntity(), {
      id: 1,
      code: 'AL20250001',
      firstName: 'A',
      lastName: 'B',
      documentType: null,
      gender: null,
      bloodType: '',
      email: '',
      status: 'active',
      scholarshipPct: null,
      academicYear: '2025',
    });
    expect(StudentMapper.toDomain(row)).toMatchObject({
      documentType: 'TI',
      gender: 'M',
      bloodType: null,
      email: null,
      scholarshipPct: 0,
      academicYear: 2025,
    });
    const guardian = GuardianMapper.toDomain(
      Object.assign(new GuardianOrmEntity(), {
        id: 1,
        documentNumber: '1',
        firstName: 'A',
        lastName: 'B',
        relationship: null,
        email: '',
      }),
    );
    expect(guardian).toMatchObject({
      documentType: 'cc',
      relationship: 'padre',
      email: null,
    });
    const incident = IncidentMapper.toDomain(
      Object.assign(new IncidentOrmEntity(), {
        id: 1,
        title: 'T',
        type: '',
        status: null,
      }),
    );
    expect(incident).toMatchObject({
      type: 'otra',
      priority: 'medium',
      status: 'pending',
    });
  });

  it('round-trips guardians, incidents and certificates', () => {
    const guardian = Guardian.create({
      documentNumber: '5',
      firstName: 'M',
      lastName: 'R',
    });
    guardian.linkUser(4);
    expect(GuardianMapper.toPersistence(guardian)).toMatchObject({
      documentNumber: '5',
      userId: 4,
    });

    const incident = Incident.open({
      studentId: 1,
      requestedBy: 2,
      title: 'T',
      openedAt: at,
    });
    const incidentRow = IncidentMapper.toPersistence(incident);
    incidentRow.id = 3;
    expect(IncidentMapper.toDomain(incidentRow)).toMatchObject({
      id: 3,
      createdAt: at,
      status: 'pending',
    });

    const snapshot = {
      studentName: 'S',
      studentCode: 'AL1',
      documentType: 'TI',
      documentNumber: '1',
      gradeName: null,
      classroomName: null,
      academicYear: 2026,
      studentStatus: 'active',
      enrollmentDate: null,
    };
    const certificate = Certificate.issue({
      studentId: 1,
      createdBy: 2,
      verificationCode: 'c',
      snapshot,
      issuedAt: at,
    });
    const certificateRow = CertificateMapper.toPersistence(certificate);
    certificateRow.id = 9;
    expect(CertificateMapper.toDomain(Object.assign(new CertificateOrmEntity(), certificateRow))).toMatchObject({
      id: 9,
      status: 'approved',
      snapshot,
    });
  });

  it('transforms numeric strings', () => {
    expect(decimalTransformer.from('12.50')).toBe(12.5);
    expect(decimalTransformer.from(null)).toBeNull();
  });
});
