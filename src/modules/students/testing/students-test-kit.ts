import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';
import { FakePasswordHasher, FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { CertificateIssuer } from '../application/certificate-issuer.js';
import { CertificateSnapshotFactory } from '../application/certificate-snapshot.factory.js';
import { ClassroomPlacement } from '../application/classroom-placement.js';
import { GuardianViewAssembler } from '../application/guardian-view.assembler.js';
import { IncidentViewAssembler } from '../application/incident-view.assembler.js';
import { PortalAccountProvisioner } from '../application/portal-account-provisioner.js';
import { StudentAccessPolicy } from '../application/student-access.policy.js';
import { StudentViewAssembler } from '../application/student-view.assembler.js';
import type { ClassroomInfo } from '../domain/classroom-directory.port.js';
import { Guardian, type GuardianDetails } from '../domain/guardian.js';
import { Student, type StudentDetails } from '../domain/student.js';
import { StudentCode } from '../domain/student-code.js';
import {
  FakeAcademicPerformance,
  FakeCertificateConceptCatalog,
  FakeClassroomDirectory,
  FakeInstitutionSettings,
  FakeQrSigner,
  FakeStudentFinance,
  InMemoryCodeSequence,
  InMemoryFileStorage,
  InMemoryUserAccounts,
  SequentialSecretGenerator,
} from './fakes.js';
import {
  InMemoryCertificateRepository,
  InMemoryGuardianRepository,
  InMemoryIncidentRepository,
  InMemoryStudentRepository,
} from './in-memory-repositories.js';

export const actorOf = (userId: number, role: Role): AuthenticatedActor => ({
  userId,
  role,
  email: `u${userId}@colegio.co`,
  name: `Usuario ${userId}`,
  tenant: 'colegio-demo',
});

export const CLASSROOM_2026: ClassroomInfo = {
  id: 10,
  name: 'A',
  gradeId: 5,
  gradeName: 'Quinto',
  gradeLevel: 'primaria',
  academicYear: 2026,
};

export const CLASSROOM_2025: ClassroomInfo = {
  ...CLASSROOM_2026,
  id: 11,
  academicYear: 2025,
};

export const studentDetails = (override: Partial<StudentDetails> = {}): StudentDetails => ({
  firstName: 'Sofía',
  lastName: 'Gómez',
  documentType: 'TI',
  documentNumber: '1101814264',
  birthDate: '2015-04-20',
  ...override,
});

export const guardianDetails = (override: Partial<GuardianDetails> = {}): GuardianDetails => ({
  documentNumber: '52123456',
  firstName: 'Marta',
  lastName: 'Ruiz',
  relationship: 'madre',
  mobile: '3001234567',
  email: 'marta@correo.co',
  ...override,
});

/** Wires every in-memory double and application service used by the use case specs. */
export const createStudentsKit = () => {
  const students = new InMemoryStudentRepository();
  const guardians = new InMemoryGuardianRepository();
  const incidents = new InMemoryIncidentRepository();
  const certificates = new InMemoryCertificateRepository();
  const classrooms = new FakeClassroomDirectory([CLASSROOM_2026, CLASSROOM_2025]);
  students.classrooms = classrooms.classrooms;
  const settings = new FakeInstitutionSettings();
  const finance = new FakeStudentFinance();
  const performance = new FakeAcademicPerformance();
  const concepts = new FakeCertificateConceptCatalog();
  const users = new InMemoryUserAccounts();
  const secrets = new SequentialSecretGenerator();
  const signer = new FakeQrSigner();
  const storage = new InMemoryFileStorage();
  const sequence = new InMemoryCodeSequence();
  const hasher = new FakePasswordHasher();
  const clock = new FixedClock();
  const unitOfWork = new FakeUnitOfWork();
  const events = new RecordingEventBus();

  const access = new StudentAccessPolicy(students, guardians);
  const studentViews = new StudentViewAssembler(classrooms, guardians);
  const guardianViews = new GuardianViewAssembler(students);
  const incidentViews = new IncidentViewAssembler(students, users);
  const placement = new ClassroomPlacement(classrooms);
  const provisioner = new PortalAccountProvisioner(users, hasher, secrets);
  const snapshots = new CertificateSnapshotFactory(classrooms, settings, clock);
  const issuer = new CertificateIssuer(certificates, secrets, events, clock, snapshots);

  let sequenceNumber = 0;
  const addStudent = async (
    details: Partial<StudentDetails> = {},
    extra: { classroomId?: number | null; guardianId?: number | null } = {},
  ) => {
    const student = Student.enroll({
      code: StudentCode.compose(2026, ++sequenceNumber + 100),
      details: studentDetails({
        documentNumber: `DOC${sequenceNumber}`,
        ...details,
      }),
      classroomId: extra.classroomId === undefined ? CLASSROOM_2026.id : extra.classroomId,
      academicYear: 2026,
      enrollmentDate: '2026-01-20',
      guardianId: extra.guardianId ?? null,
      today: '2026-03-15',
    });
    await students.save(student);
    return student;
  };

  const addGuardian = async (details: Partial<GuardianDetails> = {}) => {
    const guardian = Guardian.create(guardianDetails(details));
    await guardians.save(guardian);
    return guardian;
  };

  return {
    students,
    guardians,
    incidents,
    certificates,
    classrooms,
    settings,
    finance,
    performance,
    concepts,
    users,
    secrets,
    signer,
    storage,
    sequence,
    hasher,
    clock,
    unitOfWork,
    events,
    access,
    studentViews,
    guardianViews,
    incidentViews,
    placement,
    provisioner,
    snapshots,
    issuer,
    addStudent,
    addGuardian,
  };
};

export type StudentsKit = ReturnType<typeof createStudentsKit>;
